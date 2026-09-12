import base64
import copy
import gzip
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import candidate as c
from publish_candidate import validate_report


class CandidateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.root = self.folder / 'project'
        self.root.mkdir()
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Test')
        self.git('config', 'user.email', 'test@example.invalid')
        (self.root / 'src').mkdir()
        (self.root / 'src/main.ts').write_text('export const before = true;\n')
        (self.root / 'guards').mkdir()
        (self.root / 'guards/pg-mode.test.ts').write_text('import {test} from "vitest";\ntest("existing", () => {});\n')
        self.git('add', '.')
        self.git('commit', '-m', 'base')
        self.base = self.git('rev-parse', 'HEAD')
        self.packet = {'schema': 1, 'project': 'plinth', 'ticket': 'T-P3-v2', 'base_sha': self.base,
                       'model': 'Test model', 'pr_body': 'Pending review evidence',
                       'files': [{'path': 'src/main.ts', 'content': 'export const image = true;\n'}]}

    def git(self, *args):
        return c.git(self.root, *args)

    def prepare(self):
        return c.prepare(self.root, self.packet, self.folder / 'artifact')

    def test_packet_roundtrip(self):
        self.assertEqual(c.decode(c.encode(self.packet)), self.packet)

    def test_bounded_decompression(self):
        text = base64.b64encode(gzip.compress(b' ' * (c.MAX_RAW + 1))).decode()
        with self.assertRaisesRegex(ValueError, 'Expanded'):
            c.decode(text)

    def test_write_set_and_paths(self):
        for path in ['PLINTH_SPEC.md', 'fixtures/pg/x.png', 'guards/no-network.test.ts',
                     '../src/main.ts', '/src/main.ts', 'src/screen/../main.ts', 'src//screen/x.ts',
                     'src/screen/.secret.ts', 'src/screen/package.json', 'src/screen/a\\b.ts']:
            with self.subTest(path=path), self.assertRaises(ValueError):
                c.safe_path(path)

    def test_duplicate_and_unknown_fields(self):
        self.packet['files'] *= 2
        with self.assertRaises(ValueError):
            c.validate(self.packet)
        self.packet['files'] = self.packet['files'][:1]
        self.packet['command'] = ['true']
        with self.assertRaises(ValueError):
            c.validate(self.packet)

    def test_reject_guard_removal_before_writes(self):
        self.packet['files'].append({'path': 'guards/pg-mode.test.ts', 'content': '// removed\n'})
        with self.assertRaisesRegex(ValueError, 'guard lines'):
            self.prepare()
        self.assertFalse(self.git('status', '--porcelain'))

    def test_allow_guard_additions_and_exact_git_bundle(self):
        before = (self.root / 'guards/pg-mode.test.ts').read_text()
        self.packet['files'].append({'path': 'guards/pg-mode.test.ts', 'content': before + 'test("new", () => {});\n'})
        meta = self.prepare()
        self.assertEqual(self.git('rev-parse', 'HEAD'), meta['tested_sha'])
        packet, checked = c.verify(self.root, self.folder / 'artifact')
        self.assertEqual(packet, self.packet)
        self.assertEqual(meta, checked)

    def test_empty_candidate_rejected(self):
        self.packet['files'][0]['content'] = (self.root / 'src/main.ts').read_text()
        with self.assertRaisesRegex(ValueError, 'Empty'):
            self.prepare()

    def test_symlink_ancestor_rejected(self):
        (self.root / 'src/screen').symlink_to(self.folder, target_is_directory=True)
        self.git('add', '.')
        self.git('commit', '-m', 'symlink')
        self.packet['base_sha'] = self.git('rev-parse', 'HEAD')
        self.packet['files'] = [{'path': 'src/screen/escape.ts', 'content': 'bad'}]
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            self.prepare()
        self.assertFalse((self.folder / 'escape.ts').exists())

    def test_tampered_bundle_rejected(self):
        self.prepare()
        with (self.folder / 'artifact/candidate.bundle').open('ab') as f:
            f.write(b'bad')
        with self.assertRaisesRegex(ValueError, 'Bundle hash'):
            c.verify(self.root, self.folder / 'artifact')

    def test_stale_main_rejected(self):
        remote = self.folder / 'remote.git'
        subprocess.run(['git', 'init', '--bare', str(remote)], check=True, capture_output=True)
        self.git('remote', 'add', 'origin', str(remote))
        self.git('push', 'origin', 'main')
        c.current_base(self.root, self.base)
        with self.assertRaisesRegex(ValueError, 'main changed'):
            c.current_base(self.root, 'a' * 40)

    def test_failing_ci_never_passes(self):
        self.prepare()
        def fail(argv, root, log, seconds):
            return {'command': argv, 'exit_code': 1 if argv == ['npm', 'run', 'ci'] else 0, 'seconds': 0, 'log': str(log)}
        with patch.object(c, 'current_base'), patch.object(c, 'command', side_effect=fail):
            with self.assertRaisesRegex(ValueError, 'failed'):
                c.test_candidate(self.root, self.folder / 'artifact', self.folder / 'report')
        report = json.loads((self.folder / 'report/report.json').read_text())
        self.assertEqual(report['status'], 'FAIL')
        self.assertTrue(all(x['phase'] == 'base' for x in report['commands']))

    def test_secrets_not_in_project_environment(self):
        with patch.dict(os.environ, {'PLINTH_WRITE_TOKEN': 'secret', 'GITHUB_TOKEN': 'secret',
                                     'ACTIONS_RUNTIME_TOKEN': 'secret', 'GITHUB_ENV': 'inject'}):
            self.assertFalse(set(c.clean_env()) & {'PLINTH_WRITE_TOKEN', 'GITHUB_TOKEN', 'ACTIONS_RUNTIME_TOKEN', 'GITHUB_ENV'})

    def test_publication_proof_rejects_wrong_run_attempt_and_failed_command(self):
        meta = self.prepare()
        run = {'id': 12, 'event': 'workflow_dispatch', 'head_branch': 'main',
               'path': '.github/workflows/candidate-test.yml', 'status': 'completed',
               'conclusion': 'success', 'head_sha': 'b' * 40, 'run_attempt': 1}
        report = {**meta, 'status': 'PASS', 'runner_sha': 'b' * 40, 'run_id': '12', 'run_attempt': '1',
                  'commands': [{'phase': p, 'command': a, 'exit_code': 0} for p in ('base', 'candidate') for a in
                               (['npm', 'ci'], ['npx', '--no-install', 'playwright', 'install', 'chromium'],
                                ['npm', 'run', 'ci'], ['npm', 'run', 'build'])]}
        jobs = [{'name': 'test-candidate', 'conclusion': 'success'}]
        validate_report(run, jobs, report, meta, 12, 'b' * 40)
        for field, value in [('run_attempt', '2'), ('tested_sha', 'c' * 40), ('status', 'FAIL')]:
            altered = {**report, field: value}
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_report(run, jobs, altered, meta, 12, 'b' * 40)
        report['commands'][-1]['exit_code'] = 1
        with self.assertRaises(ValueError):
            validate_report(run, jobs, report, meta, 12, 'b' * 40)


if __name__ == '__main__':
    unittest.main()
