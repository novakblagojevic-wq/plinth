"""Owner-authored Plinth candidates: pack, prepare and test without a remote push.

The packet is data, never a command/configuration source. This is not a sandbox
for hostile code. Publication runs on a separate clean worker (publish_candidate.py).
"""
import argparse
import base64
import difflib
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import signal
import subprocess
import time

from candidate_profiles import PROFILES, profile_for

REPOSITORY = 'novakblagojevic-wq/plinth'
MAX_RAW = 2 * 1024 * 1024
MAX_ENCODED = 60000  # one workflow input, below GitHub's total dispatch budget
FIXED_PATHS = profile_for('T-P3-v2').paths  # legacy T-P3 policy, not a union


def require(condition, message):
    if not condition:
        raise ValueError(message)


def safe_path(path, ticket='T-P3-v2'):
    profile = profile_for(ticket)
    require(isinstance(path, str) and len(path) <= 240, 'Invalid path')
    require(re.fullmatch(r'[A-Za-z0-9_./-]+', path) is not None, 'Invalid path characters')
    require(not path.startswith('/') and all(p and not p.startswith('.') for p in path.split('/')),
            'Absolute, hidden or traversal path')
    require(profile.allows(path), 'Path is outside ' + ticket + ' write set: ' + path)
    return path


def validate(packet):
    require(isinstance(packet, dict) and set(packet) ==
            {'schema', 'project', 'ticket', 'base_sha', 'model', 'pr_body', 'files'}, 'Invalid packet fields')
    require(type(packet['schema']) is int and packet['schema'] == 1 and packet['project'] == 'plinth',
            'Unsupported project or ticket')
    profile_for(packet['ticket'])
    require(isinstance(packet['base_sha'], str) and re.fullmatch('[0-9a-f]{40}', packet['base_sha']), 'Full base SHA required')
    require(isinstance(packet['model'], str) and 1 <= len(packet['model']) <= 120
            and '\n' not in packet['model'], 'Actual implementing model required')
    require(isinstance(packet['pr_body'], str) and 1 <= len(packet['pr_body']) <= 30000, 'PR evidence draft required')
    require(isinstance(packet['files'], list) and 1 <= len(packet['files']) <= 50, 'Expected 1–50 files')
    paths = set()
    for entry in packet['files']:
        require(isinstance(entry, dict) and set(entry) == {'path', 'content'}, 'Invalid file entry')
        path = safe_path(entry['path'], packet['ticket'])
        require(path not in paths, 'Duplicate path')
        paths.add(path)
        require(isinstance(entry['content'], str) and '\0' not in entry['content'], 'UTF-8 text files only')
    require(len(canonical(packet)) <= MAX_RAW, 'Uncompressed packet exceeds 2 MiB')
    return packet


def canonical(packet):
    return json.dumps(packet, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')


def encode(packet):
    text = base64.b64encode(gzip.compress(canonical(validate(packet)), mtime=0)).decode('ascii')
    require(len(text) <= MAX_ENCODED, 'Compressed packet exceeds dispatch capacity; no files were sent')
    return text


def decode(text):
    require(isinstance(text, str) and 1 <= len(text) <= MAX_ENCODED, 'Invalid encoded size')
    data = base64.b64decode(text, validate=True)
    with gzip.GzipFile(fileobj=io.BytesIO(data)) as stream:
        raw = stream.read(MAX_RAW + 1)
    require(len(raw) <= MAX_RAW, 'Expanded packet exceeds 2 MiB')
    return validate(json.loads(raw))


def git(root, *args, env=None):
    return subprocess.check_output(['git', '-c', 'core.hooksPath=/dev/null', *args],
                                   cwd=root, env=env, stderr=subprocess.PIPE).decode().strip()


def current_base(root, expected):
    git(root, 'fetch', 'origin', 'main')
    require(git(root, 'rev-parse', 'origin/main') == expected, 'main changed: prepare a new packet and retest')


def require_contract(root, base, ticket):
    """Fail before a write/command when the reviewed contract is not on the base."""
    profile = profile_for(ticket)
    if not profile.required_ancestor:
        return
    try:
        git(root, 'merge-base', '--is-ancestor', profile.required_ancestor, base)
        for path, blob in profile.required_blobs:
            require(git(root, 'rev-parse', base + ':' + path) == blob,
                    'T-P5 contract changed; review the profile again: ' + path)
    except subprocess.CalledProcessError as error:
        raise ValueError('T-P5 requires merged Plinth PR #9 and its reviewed P-11 contract') from error


def check_file(root, base, entry, ticket='T-P3-v2'):
    path = safe_path(entry['path'], ticket)
    for parent in [PurePosixPath(path), *PurePosixPath(path).parents]:
        if str(parent) == '.':
            continue
        record = git(root, 'ls-tree', base, '--', str(parent))
        if record:
            require(record.split()[0] in ('100644', '100755', '040000'), 'Symlinks/submodules are forbidden')
        require(not (Path(root) / parent).is_symlink(), 'Symlink in worktree')
    is_guard = path.startswith('guards/')
    if is_guard or (ticket == 'T-P5' and (path.endswith('.test.ts') or path == 'scripts/pg-capture.mjs')):
        # T-P5 adds a new guard; an absent allowed guard has no old lines.
        # Existing guards keep exactly the same insertion-only check as T-P3.
        exists = git(root, 'ls-tree', base, '--', path)
        new_test = ticket == 'T-P5' and path.endswith('.test.ts') and path not in {
            'guards/pg-mode.test.ts', 'src/scene.test.ts'}
        require(exists or new_test, 'Expected existing test/capture on base: ' + path)
        before = (git_bytes(root, 'show', base + ':' + path).decode('utf-8') if exists else '').splitlines(keepends=True)
        after = entry['content'].splitlines(keepends=True)
        require(all(tag in ('equal', 'insert') for tag, *_ in
                    difflib.SequenceMatcher(a=before, b=after, autojunk=False).get_opcodes()),
                'Existing guard lines may not be changed or removed' if is_guard
                else 'Existing test/capture lines may not be changed or removed')


def git_bytes(root, *args):
    return subprocess.check_output(['git', '-c', 'core.hooksPath=/dev/null', *args], cwd=root, stderr=subprocess.PIPE)


def prepare(root, packet, output, expected_ticket='T-P3-v2'):
    validate(packet)
    require(packet['ticket'] == profile_for(expected_ticket).ticket, 'Ticket does not match this workflow')
    root, output = Path(root).resolve(), Path(output).resolve()
    require(not output.exists(), 'Output directory already exists')
    require(not git(root, 'status', '--porcelain'), 'Checkout must be clean')
    base = packet['base_sha']
    require(git(root, 'rev-parse', 'HEAD') == base, 'Checkout does not match packet base')
    require_contract(root, base, packet['ticket'])
    # Validate every entry before writing any entry.
    for entry in packet['files']:
        check_file(root, base, entry, packet['ticket'])
    for entry in packet['files']:
        path = root / entry['path']
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(entry['content'].encode('utf-8'))
    git(root, 'add', '--', *[e['path'] for e in packet['files']])
    tree = git(root, 'write-tree')
    require(tree != git(root, 'rev-parse', base + '^{tree}'), 'Empty candidate')
    stamp = str(int(git(root, 'show', '-s', '--format=%ct', base)) + 1) + ' +0000'
    env = {**os.environ, 'GIT_AUTHOR_NAME': 'Astra candidate', 'GIT_AUTHOR_EMAIL': 'candidate@astra.invalid',
           'GIT_COMMITTER_NAME': 'Astra candidate', 'GIT_COMMITTER_EMAIL': 'candidate@astra.invalid',
           'GIT_AUTHOR_DATE': stamp, 'GIT_COMMITTER_DATE': stamp}
    subject = ('T-P3-v2: screenshot to screen candidate' if packet['ticket'] == 'T-P3-v2'
               else profile_for(packet['ticket']).title + ' candidate')
    sha = git(root, 'commit-tree', tree, '-p', base, '-m', subject, env=env)
    git(root, 'update-ref', 'refs/heads/astra-candidate', sha)
    git(root, 'reset', '--hard', sha)
    output.mkdir(parents=True)
    (output / 'packet.json').write_bytes(canonical(packet))
    git(root, 'bundle', 'create', str(output / 'candidate.bundle'), base + '..refs/heads/astra-candidate')
    metadata = {'schema': 1, 'repository': REPOSITORY, 'ticket': packet['ticket'], 'base_sha': base, 'tested_sha': sha,
                'tree_sha': tree, 'packet_sha256': hashlib.sha256(canonical(packet)).hexdigest(),
                'bundle_sha256': hashlib.sha256((output / 'candidate.bundle').read_bytes()).hexdigest()}
    (output / 'candidate.json').write_text(json.dumps(metadata, indent=2) + '\n')
    return metadata


def verify(root, artifact, expected_ticket='T-P3-v2'):
    artifact = Path(artifact)
    packet = validate(json.loads((artifact / 'packet.json').read_text()))
    require(packet['ticket'] == profile_for(expected_ticket).ticket, 'Ticket does not match this workflow')
    meta = json.loads((artifact / 'candidate.json').read_text())
    require(meta.get('ticket', 'T-P3-v2') == packet['ticket'], 'Candidate ticket mismatch')
    require(meta['repository'] == REPOSITORY and meta['base_sha'] == packet['base_sha'], 'Candidate identity mismatch')
    require_contract(root, packet['base_sha'], packet['ticket'])
    require(re.fullmatch('[0-9a-f]{40}', meta['tested_sha']) and re.fullmatch('[0-9a-f]{40}', meta['tree_sha']), 'Invalid SHA')
    require(hashlib.sha256(canonical(packet)).hexdigest() == meta['packet_sha256'], 'Packet hash mismatch')
    require(hashlib.sha256((artifact / 'candidate.bundle').read_bytes()).hexdigest() == meta['bundle_sha256'], 'Bundle hash mismatch')
    git(root, 'bundle', 'verify', str(artifact.resolve() / 'candidate.bundle'))
    git(root, 'fetch', str(artifact.resolve() / 'candidate.bundle'), 'refs/heads/astra-candidate')
    sha = git(root, 'rev-parse', 'FETCH_HEAD')
    require(sha == meta['tested_sha'], 'Candidate SHA mismatch')
    require(git(root, 'show', '-s', '--format=%P', sha) == packet['base_sha'], 'Unexpected candidate parent')
    require(git(root, 'rev-parse', sha + '^{tree}') == meta['tree_sha'], 'Tree mismatch')
    changed = set(git(root, 'diff', '--name-only', packet['base_sha'], sha).splitlines())
    require(changed and changed <= {e['path'] for e in packet['files']}, 'Unexpected changed files')
    for entry in packet['files']:
        check_file(root, packet['base_sha'], entry, packet['ticket'])
        require(git_bytes(root, 'show', sha + ':' + entry['path']) == entry['content'].encode('utf-8'), 'File content mismatch')
        before = git(root, 'ls-tree', packet['base_sha'], '--', entry['path'])
        after = git(root, 'ls-tree', sha, '--', entry['path'])
        require(after.split()[0] == (before.split()[0] if before else '100644'), 'File mode changed')
    return packet, meta


def clean_env():
    return {k: v for k, v in os.environ.items() if k in
            {'PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'PLAYWRIGHT_BROWSERS_PATH'}} | {'CI': 'true'}


def command(argv, root, log, seconds):
    started = time.monotonic()
    with open(log, 'wb') as out:
        p = subprocess.Popen(argv, cwd=root, env=clean_env(), stdout=out, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = p.wait(timeout=seconds)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGKILL)
            p.wait()
            code = 124
    return {'command': argv, 'exit_code': code, 'seconds': round(time.monotonic() - started, 3), 'log': Path(log).name}


def test_candidate(root, artifact, output, expected_ticket='T-P3-v2'):
    root, output = Path(root).resolve(), Path(output).resolve()
    require(not output.exists(), 'Report directory already exists')
    packet, meta = verify(root, artifact, expected_ticket)
    output.mkdir(parents=True)
    report = {**meta, 'status': 'FAIL', 'commands': [], 'run_id': os.environ.get('GITHUB_RUN_ID'),
              'run_attempt': os.environ.get('GITHUB_RUN_ATTEMPT'), 'runner_sha': os.environ.get('GITHUB_SHA')}
    try:
        current_base(root, meta['base_sha'])
        for phase, sha in [('base', meta['base_sha']), ('candidate', meta['tested_sha'])]:
            git(root, 'checkout', '--detach', sha)
            commands = [(['npm', 'ci'], 600), (['npx', '--no-install', 'playwright', 'install', 'chromium'], 600),
                        (['npm', 'run', 'ci'], profile_for(expected_ticket).ci_timeout_seconds),
                        (['npm', 'run', 'build'], 300)]
            for index, (argv, deadline) in enumerate(commands):
                result = command(argv, root, output / f'{phase}-{index}.log', deadline)
                report['commands'].append({'phase': phase, **result})
                require(result['exit_code'] == 0, f'{phase}: {argv} failed ({result["exit_code"]})')
            require(git(root, 'rev-parse', 'HEAD') == sha and not git(root, 'status', '--porcelain'),
                    phase + ': tests changed the checkout')
        current_base(root, meta['base_sha'])
        verify(root, artifact, expected_ticket)
        report['status'] = 'PASS'
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
        (output / 'report.md').write_text(f'# Candidate {report["status"]}\n\nTested: `{meta["tested_sha"]}`\n'
            f'Base: `{meta["base_sha"]}`\n\nNo push performed. PG evidence and independent review remain required.\n')
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['pack', 'prepare', 'test'])
    parser.add_argument('--checkout', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--artifact', type=Path)
    parser.add_argument('--base')
    parser.add_argument('--model')
    parser.add_argument('--body-file', type=Path)
    parser.add_argument('--ticket', choices=tuple(PROFILES), default='T-P3-v2')
    args = parser.parse_args()
    if args.action == 'pack':
        require(args.base and args.model and args.body_file, 'pack needs base, model and body-file')
        require_contract(args.checkout, args.base, args.ticket)
        paths = sorted(set(git(args.checkout, 'diff', '--name-only', args.base).splitlines() +
                           git(args.checkout, 'ls-files', '--others', '--exclude-standard').splitlines()))
        for path in paths:
            safe_path(path, args.ticket)
            require((args.checkout / path).is_file() and not (args.checkout / path).is_symlink(), 'Deletion/symlink not supported')
        packet = validate({'schema': 1, 'project': 'plinth', 'ticket': args.ticket, 'base_sha': args.base,
                           'model': args.model, 'pr_body': args.body_file.read_text(),
                           'files': [{'path': p, 'content': (args.checkout / p).read_text()} for p in paths]})
        encode(packet)  # fail before saving if it cannot be dispatched
        require(not args.output.exists(), 'Output already exists')
        args.output.write_bytes(canonical(packet))
    elif args.action == 'prepare':
        packet = decode(os.environ.pop('CANDIDATE_PACKET', ''))
        require(packet['ticket'] == args.ticket, 'Ticket does not match this workflow')
        current_base(args.checkout, packet['base_sha'])
        git(args.checkout, 'checkout', '--detach', packet['base_sha'])
        prepare(args.checkout, packet, args.output, args.ticket)
    else:
        require(args.artifact, 'test needs --artifact')
        test_candidate(args.checkout, args.artifact, args.output, args.ticket)


if __name__ == '__main__':
    main()
