"""Publish exactly a passing immutable candidate; never execute project code."""
import argparse
import io
import json
import os
from pathlib import Path
import re
import tempfile
import urllib.error
import urllib.request
import zipfile

from candidate import REPOSITORY, current_base, git, require, verify
from candidate_profiles import PROFILES, profile_for

RUNNER = REPOSITORY  # Public workflow and publication share this repository.


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def api(repo, path, token, method='GET', body=None):
    require(repo in (RUNNER, REPOSITORY) and path.startswith('/'), 'Invalid API target')
    request = urllib.request.Request('https://api.github.com/repos/' + repo + path,
        headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
                 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'},
        data=json.dumps(body).encode() if body is not None else None, method=method)
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        return json.load(response)


def artifact_files(run_id, attempt, name, token, wanted):
    results = api(RUNNER, f'/actions/runs/{run_id}/artifacts?per_page=100', token)
    require(results['total_count'] <= 100, 'Too many artifacts')
    matches = [a for a in results['artifacts'] if a['name'] == f'{name}-{run_id}-{attempt}' and not a['expired']]
    require(len(matches) == 1, 'Expected one immutable current-attempt artifact')
    item = matches[0]
    require(item['size_in_bytes'] <= 40 * 1024 * 1024, 'Artifact too large')
    url = f'https://api.github.com/repos/{RUNNER}/actions/artifacts/{int(item["id"])}/zip'
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token})
    try:
        response = urllib.request.build_opener(NoRedirect).open(request, timeout=30)
    except urllib.error.HTTPError as error:
        require(error.code == 302, 'Artifact download was refused')
        location = error.headers.get('Location', '')
        require(location.startswith('https://'), 'Invalid artifact redirect')
        # Deliberately no Authorization on GitHub's signed artifact location.
        response = urllib.request.urlopen(location, timeout=60)
    with response:
        content = response.read(40 * 1024 * 1024 + 1)
    require(len(content) <= 40 * 1024 * 1024, 'Artifact too large')
    files = {}
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        for name in wanted:
            entries = [i for i in archive.infolist() if i.filename == name]
            require(len(entries) == 1 and entries[0].file_size <= 4 * 1024 * 1024, 'Missing or oversized artifact member')
            files[name] = archive.read(entries[0])
    return files


def validate_report(run, jobs, report, meta, run_id, runner_sha, expected_ticket='T-P3-v2'):
    profile = profile_for(expected_ticket)
    require(meta.get('ticket', 'T-P3-v2') == report.get('ticket', 'T-P3-v2') == profile.ticket,
            'Report/candidate ticket mismatch')
    require(run['id'] == run_id and run['event'] == 'workflow_dispatch' and run['head_branch'] == 'main'
            and run['path'] == profile.test_workflow
            and run['status'] == 'completed' and run['conclusion'] == 'success', 'Not a successful candidate workflow')
    require(run['head_sha'] == runner_sha == report['runner_sha'], 'Runner changed; retest candidate')
    require(report['run_id'] == str(run_id) and report['run_attempt'] == str(run['run_attempt']), 'Attempt mismatch')
    require(report['status'] == 'PASS', 'Candidate did not pass')
    for key in ('repository', 'base_sha', 'tested_sha', 'tree_sha', 'packet_sha256', 'bundle_sha256'):
        require(report[key] == meta[key], 'Report/candidate identity mismatch: ' + key)
    test_jobs = [j for j in jobs if j['name'] == 'test-candidate']
    require(len(test_jobs) == 1 and test_jobs[0]['conclusion'] == 'success', 'Test job did not succeed')
    expected = [(phase, argv) for phase in ('base', 'candidate') for argv in
                (['npm', 'ci'], ['npx', '--no-install', 'playwright', 'install', 'chromium'],
                 ['npm', 'run', 'ci'], ['npm', 'run', 'build'])]
    actual = [(c['phase'], c['command']) for c in report['commands']]
    require(actual == expected and all(c['exit_code'] == 0 for c in report['commands']), 'Required commands missing or failed')


def publish(root, run_id, runner_token, write_token, runner_sha, expected_ticket='T-P3-v2'):
    profile = profile_for(expected_ticket)
    require(re.fullmatch('[1-9][0-9]{0,18}', str(run_id)), 'Invalid run ID')
    require(runner_token and write_token, 'Configure PLINTH_WRITE_TOKEN for Contents/PR write on Plinth only')
    run = api(RUNNER, f'/actions/runs/{run_id}', runner_token)
    require(run['path'] == profile.test_workflow and run['conclusion'] == 'success'
            and run['head_branch'] == 'main' and run['head_sha'] == runner_sha, 'Untrusted or stale candidate run')
    attempt = run['run_attempt']
    jobs_response = api(RUNNER, f'/actions/runs/{run_id}/attempts/{attempt}/jobs?per_page=100', runner_token)
    require(jobs_response['total_count'] <= 100, 'Too many jobs')
    files = artifact_files(run_id, attempt, 'candidate', runner_token, ['packet.json', 'candidate.json', 'candidate.bundle'])
    report_files = artifact_files(run_id, attempt, 'candidate-test', runner_token, ['report.json'])
    with tempfile.TemporaryDirectory() as folder:
        artifact = Path(folder)
        for name, data in files.items():
            (artifact / name).write_bytes(data)
        packet, meta = verify(root, artifact, expected_ticket)
    report = json.loads(report_files['report.json'])
    validate_report(run, jobs_response['jobs'], report, meta, run_id, runner_sha, expected_ticket)
    current_base(root, meta['base_sha'])
    branch = f'{profile.branch_prefix}-{run_id}-{attempt}'
    remote = api(REPOSITORY, '/git/ref/heads/main', write_token)
    require(remote['object']['sha'] == meta['base_sha'], 'main changed before publication')
    # Idempotent retry: only reuse our branch when it is exactly the tested SHA.
    try:
        existing = api(REPOSITORY, '/git/ref/heads/' + branch, write_token)
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        existing = None
    if existing:
        require(existing['object']['sha'] == meta['tested_sha'], 'Existing branch differs; refusing to overwrite')
    else:
        with tempfile.TemporaryDirectory() as folder:
            askpass = Path(folder) / 'askpass.py'
            askpass.write_text('#!/usr/bin/env python3\nimport os,sys\nprint("x-access-token" if "Username" in sys.argv[1] else os.environ["ASTRA_PUBLISH_TOKEN"])\n')
            askpass.chmod(0o700)
            git(root, '-c', 'credential.helper=', 'push',
                'https://github.com/' + REPOSITORY + '.git', meta['tested_sha'] + ':refs/heads/' + branch,
                env={**os.environ, 'GIT_ASKPASS': str(askpass), 'GIT_TERMINAL_PROMPT': '0', 'ASTRA_PUBLISH_TOKEN': write_token})
    require(api(REPOSITORY, '/git/ref/heads/' + branch, write_token)['object']['sha'] == meta['tested_sha'], 'Remote SHA mismatch')
    require(api(REPOSITORY, '/git/ref/heads/main', write_token)['object']['sha'] == meta['base_sha'], 'main changed; branch exists but needs retest')
    prs = api(REPOSITORY, '/pulls?state=all&head=thohared:' + branch, write_token)
    if prs:
        require(len(prs) == 1 and prs[0]['head']['sha'] == meta['tested_sha'], 'Existing PR differs')
        return prs[0]['html_url']
    evidence = f'https://github.com/{RUNNER}/actions/runs/{run_id}'
    capture_requirement = 'all twenty pg-candidates'
    if profile.ticket == 'T-P5':
        capture_requirement += ' plus ticket-specific pose/aspect captures'
    body = (packet['pr_body'] + '\n\n## Automated pre-push evidence\n'
            f'- Implementing model: {packet["model"]}\n- Tested commit: `{meta["tested_sha"]}`\n'
            f'- Base: `{meta["base_sha"]}`\n- [Candidate run]({evidence}), attempt {attempt}\n'
            '- Base and candidate: npm ci, pinned Chromium installation, npm run ci, npm run build passed.\n'
            f'- Draft only. PR CI and {capture_requirement}, '
            'contact-sheet inspection, complete ticket evidence, '
            'Novak baseline blessing and independent fresh-context review remain required.\n'
            '- No merge or baseline change performed.\n')
    result = api(REPOSITORY, '/pulls', write_token, 'POST',
                 {'title': profile.title, 'head': branch, 'base': 'main', 'body': body, 'draft': True})
    return result['html_url']


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--checkout', required=True)
    parser.add_argument('--ticket', choices=tuple(PROFILES), default='T-P3-v2')
    args = parser.parse_args()
    runner_token = os.environ.pop('GH_TOKEN', '')
    write_token = os.environ.pop('PLINTH_WRITE_TOKEN', '')
    print(publish(args.checkout, int(os.environ['CANDIDATE_RUN_ID']), runner_token, write_token, os.environ['GITHUB_SHA'], args.ticket))
