"""T-P5 policy boundaries using real temporary Git objects; no network or tokens."""
import copy
from dataclasses import replace
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import candidate as c
from candidate_profiles import PROFILES, profile_for
import publish_candidate as pub


class TP5Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.root = self.folder / 'project'
        self.root.mkdir()
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Test')
        self.git('config', 'user.email', 'test@example.invalid')
        for name, text in {
            'src/main.ts': 'export const before = true;\n',
            'guards/pg-mode.test.ts': 'test("keep", () => expect(true).toBe(true));\n',
            'src/scene.test.ts': 'test("existing stage", () => {});\n',
            'scripts/pg-capture.mjs': 'await captureExistingCases();\n',
            'PLINTH_SPEC.md': 'Reviewed fixture contract\n',
            'docs/tickets/T-P5.md': 'Reviewed fixture ticket\n',
        }.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
        self.git('add', '.')
        self.git('commit', '-m', 'reviewed contract fixture')
        reviewed = self.git('rev-parse', 'HEAD')
        self.original_profile = profile_for('T-P5')
        fixture = replace(self.original_profile, required_ancestor=reviewed,
            required_blobs=tuple((p, self.git('rev-parse', reviewed + ':' + p))
                                for p, _ in self.original_profile.required_blobs))
        policy = patch.dict(PROFILES, {'T-P5': fixture})
        policy.start()
        self.addCleanup(policy.stop)
        self.git('commit', '--allow-empty', '-m', 'main after approved contract')
        self.base = self.git('rev-parse', 'HEAD')
        self.packet = {'schema': 1, 'project': 'plinth', 'ticket': 'T-P5',
                       'base_sha': self.base, 'model': 'Test model', 'pr_body': 'Test evidence',
                       'files': [{'path': 'src/camera/poses.ts', 'content': 'export const pose = 1;\n'}]}
        self.artifact = self.folder / 'artifact'

    def git(self, *args):
        return c.git(self.root, *args)

    def prepare(self):
        return c.prepare(self.root, self.packet, self.artifact, 'T-P5')

    def proof(self, meta, ticket='T-P5'):
        run = {'id': 12, 'event': 'workflow_dispatch', 'head_branch': 'main',
               'path': profile_for(ticket).test_workflow, 'status': 'completed',
               'conclusion': 'success', 'head_sha': 'b' * 40, 'run_attempt': 1}
        report = {**meta, 'status': 'PASS', 'runner_sha': 'b' * 40, 'run_id': '12', 'run_attempt': '1',
                  'commands': [{'phase': phase, 'command': argv, 'exit_code': 0}
                               for phase in ('base', 'candidate') for argv in
                               (['npm', 'ci'], ['npx', '--no-install', 'playwright', 'install', 'chromium'],
                                ['npm', 'run', 'ci'], ['npm', 'run', 'build'])]}
        return run, [{'name': 'test-candidate', 'conclusion': 'success'}], report

    def test_exact_reviewed_write_set_and_no_cross_profile_union(self):
        # Literal contract from Plinth PR #9, not a generated copy of PROFILES.
        expected = {
            'src/camera/poses.ts', 'src/camera/poses.test.ts',
            'src/camera/controller.ts', 'src/camera/controller.test.ts',
            'src/scene.ts', 'src/scene.test.ts', 'src/main.ts',
            'src/scene/contactShadow.ts', 'src/scene/contactShadow.test.ts',
            'src/scene/studio.ts', 'src/scene/studio.test.ts',
            'guards/pg-mode.test.ts', 'guards/camera-posing.test.ts',
            'scripts/pg-capture.mjs', 'docs/tickets/T-P5.md',
            'docs/tickets/T-P5-environment.md', 'README.md',
        }
        self.assertEqual(profile_for('T-P5').paths, expected)
        for path in expected:
            self.assertEqual(c.safe_path(path, 'T-P5'), path)
        for path in ['PLINTH_SPEC.md', 'fixtures/pg/x.png', 'package.json', 'package-lock.json',
                     'src/devices/build.ts', 'src/scene/pipeline.ts', 'src/screen/load.ts',
                     'index.html', 'src/camera/extra.ts', 'guards/no-network.test.ts',
                     '../README.md', '/README.md', 'src//scene.ts', '.github/workflows/x.yml']:
            with self.subTest(path=path), self.assertRaises(ValueError):
                c.safe_path(path, 'T-P5')
        with self.assertRaises(ValueError):
            c.safe_path('src/camera/poses.ts', 'T-P3-v2')
        self.assertEqual(c.safe_path('src/screen/load.ts'), 'src/screen/load.ts')

    def test_unknown_ticket_and_input_supplied_permissions_rejected(self):
        for ticket in ['T-P6', '', None, {'paths': ['PLINTH_SPEC.md']}]:
            with self.subTest(ticket=ticket), self.assertRaises(ValueError):
                c.validate({**self.packet, 'ticket': ticket})
        with self.assertRaises(ValueError):
            c.validate({**self.packet, 'paths': ['PLINTH_SPEC.md']})
        altered = copy.deepcopy(self.packet)
        altered['files'][0]['path'] = 'src/screen/load.ts'
        with self.assertRaises(ValueError):
            c.validate(altered)

    def test_exact_bundle_and_ticket_identity(self):
        self.assertEqual(c.decode(c.encode(self.packet)), self.packet)
        meta = self.prepare()
        self.assertEqual(meta['ticket'], 'T-P5')
        self.assertEqual(c.verify(self.root, self.artifact, 'T-P5'), (self.packet, meta))
        with self.assertRaisesRegex(ValueError, 'workflow'):
            c.verify(self.root, self.artifact)
        meta['ticket'] = 'T-P3-v2'
        (self.artifact / 'candidate.json').write_text(json.dumps(meta))
        with self.assertRaisesRegex(ValueError, 'ticket mismatch'):
            c.verify(self.root, self.artifact, 'T-P5')

    def test_wrong_prepare_workflow_fails_before_any_write(self):
        with self.assertRaisesRegex(ValueError, 'workflow'):
            c.prepare(self.root, self.packet, self.artifact)
        self.assertFalse(self.git('status', '--porcelain'))
        self.assertFalse(self.artifact.exists())

    def test_real_review_pin_cannot_be_satisfied_by_unrelated_fixture(self):
        with patch.dict(PROFILES, {'T-P5': self.original_profile}):
            with self.assertRaisesRegex(ValueError, 'requires merged'):
                self.prepare()
        self.assertFalse(self.git('status', '--porcelain'))
        self.assertFalse(self.artifact.exists())

    def test_commit_on_unmerged_side_branch_is_not_approval_on_main(self):
        self.git('checkout', '-b', 'proposal')
        self.git('commit', '--allow-empty', '-m', 'unmerged proposal')
        proposal = self.git('rev-parse', 'HEAD')
        self.git('checkout', 'main')
        unmerged = replace(profile_for('T-P5'), required_ancestor=proposal)
        with patch.dict(PROFILES, {'T-P5': unmerged}), self.assertRaisesRegex(ValueError, 'requires merged'):
            self.prepare()
        self.assertFalse(self.git('status', '--porcelain'))

    def test_reverted_or_changed_spec_and_ticket_require_profile_review(self):
        for path, _ in profile_for('T-P5').required_blobs:
            with self.subTest(path=path):
                self.git('reset', '--hard', self.base)
                (self.root / path).write_text('Changed contract\n')
                self.git('add', path)
                self.git('commit', '-m', 'changed contract')
                self.packet['base_sha'] = self.git('rev-parse', 'HEAD')
                with self.assertRaisesRegex(ValueError, 'contract changed'):
                    self.prepare()
                self.assertFalse(self.git('status', '--porcelain'))
                self.assertFalse(self.artifact.exists())

    def test_new_guard_is_allowed_and_existing_guard_is_insertion_only(self):
        before = (self.root / 'guards/pg-mode.test.ts').read_text()
        self.packet['files'] += [
            {'path': 'guards/camera-posing.test.ts', 'content': 'test("camera", () => {});\n'},
            {'path': 'guards/pg-mode.test.ts', 'content': before + 'test("pose", () => {});\n'},
        ]
        meta = self.prepare()
        self.assertEqual(c.verify(self.root, self.artifact, 'T-P5')[1], meta)

    def test_existing_guard_removal_fails_before_any_write(self):
        self.packet['files'].append({'path': 'guards/pg-mode.test.ts', 'content': '// deleted assertion\n'})
        with self.assertRaisesRegex(ValueError, 'guard lines'):
            self.prepare()
        self.assertFalse(self.git('status', '--porcelain'))
        self.assertFalse(self.artifact.exists())

    def test_preexisting_camera_guard_cannot_be_replaced(self):
        path = self.root / 'guards/camera-posing.test.ts'
        path.write_text('test("original camera assertion", () => {});\n')
        self.git('add', '.')
        self.git('commit', '-m', 'existing camera guard')
        self.packet['base_sha'] = self.git('rev-parse', 'HEAD')
        self.packet['files'] = [{'path': 'guards/camera-posing.test.ts', 'content': '// replacement\n'}]
        with self.assertRaisesRegex(ValueError, 'guard lines'):
            self.prepare()

    def test_new_source_symlink_ancestor_rejected(self):
        (self.root / 'src/camera').symlink_to(self.folder, target_is_directory=True)
        self.git('add', '.')
        self.git('commit', '-m', 'symlink')
        self.packet['base_sha'] = self.git('rev-parse', 'HEAD')
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            self.prepare()
        self.assertFalse((self.folder / 'poses.ts').exists())

    def test_existing_unit_and_capture_cases_cannot_be_removed(self):
        for path in ['src/scene.test.ts', 'scripts/pg-capture.mjs']:
            with self.subTest(path=path):
                self.packet['files'] = [{'path': path, 'content': '// replacement\n'}]
                with self.assertRaisesRegex(ValueError, 'test/capture lines'):
                    self.prepare()
                self.assertFalse(self.git('status', '--porcelain'))

    def test_existing_unit_and_capture_cases_can_be_extended(self):
        self.packet['files'] = [
            {'path': path, 'content': (self.root / path).read_text() + '// additive case\n'}
            for path in ['src/scene.test.ts', 'scripts/pg-capture.mjs']]
        meta = self.prepare()
        self.assertEqual(c.verify(self.root, self.artifact, 'T-P5')[1], meta)

    def test_wrong_test_workflow_never_executes_project_commands(self):
        self.prepare()
        with patch.object(c, 'command') as command, self.assertRaisesRegex(ValueError, 'workflow'):
            c.test_candidate(self.root, self.artifact, self.folder / 'report')
        command.assert_not_called()

    def test_candidate_ci_failure_cannot_publish_base_only_success(self):
        meta = self.prepare()
        def run(argv, root, log, seconds):
            failed = self.git('rev-parse', 'HEAD') == meta['tested_sha'] and argv == ['npm', 'run', 'ci']
            return {'command': argv, 'exit_code': 1 if failed else 0, 'seconds': 0, 'log': str(log)}
        with patch.object(c, 'current_base'), patch.object(c, 'command', side_effect=run):
            with self.assertRaisesRegex(ValueError, 'candidate:.*failed'):
                c.test_candidate(self.root, self.artifact, self.folder / 'report', 'T-P5')
        report = json.loads((self.folder / 'report/report.json').read_text())
        self.assertEqual(report['ticket'], 'T-P5')
        self.assertEqual(report['status'], 'FAIL')
        self.assertEqual(len(report['commands']), 7)

    def test_publication_proof_binds_workflow_ticket_and_all_commands(self):
        meta = self.prepare()
        run, jobs, report = self.proof(meta)
        pub.validate_report(run, jobs, report, meta, 12, 'b' * 40, 'T-P5')
        for change in [
            {'run': {**run, 'path': '.github/workflows/candidate-test.yml'}},
            {'run': {**run, 'head_branch': 'proposal'}},
            {'report': {**report, 'ticket': 'T-P3-v2'}},
            {'report': {k: v for k, v in report.items() if k != 'ticket'}},
            {'meta': {**meta, 'ticket': 'T-P3-v2'}},
            {'report': {**report, 'commands': report['commands'][:4]}},
        ]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                pub.validate_report(change.get('run', run), jobs, change.get('report', report),
                                    change.get('meta', meta), 12, 'b' * 40, 'T-P5')

    def test_ci_budget_changes_only_the_two_tp5_ci_commands(self):
        for ticket, ci_deadline in [('T-P5', 1200), ('T-P3-v2', 900)]:
            with self.subTest(ticket=ticket):
                self.git('reset', '--hard', self.base)
                artifact = self.folder / ('budget-' + ticket)
                packet = {**self.packet, 'ticket': ticket,
                          'files': [{'path': 'src/main.ts', 'content': 'export const after = true;\n'}]}
                c.prepare(self.root, packet, artifact, ticket)
                calls = []
                def run(argv, root, log, seconds):
                    calls.append((argv, seconds))
                    return {'command': argv, 'exit_code': 0, 'seconds': 0, 'log': str(log)}
                with patch.object(c, 'current_base'), patch.object(c, 'command', side_effect=run):
                    report = c.test_candidate(self.root, artifact, self.folder / ('report-' + ticket), ticket)
                self.assertEqual(calls, [
                    (['npm', 'ci'], 600),
                    (['npx', '--no-install', 'playwright', 'install', 'chromium'], 600),
                    (['npm', 'run', 'ci'], ci_deadline),
                    (['npm', 'run', 'build'], 300),
                ] * 2)
                self.assertEqual(report['status'], 'PASS')
                self.assertEqual(len(report['commands']), 8)

    def test_publish_uses_exact_tested_branch_and_draft_without_project_execution(self):
        body = self.publish_fixture('T-P5', 'astra/t-p5-12-1', 'T-P5: camera and posing')
        self.assertIn('all twenty pg-candidates plus ticket-specific pose/aspect captures, ', body)

    def test_legacy_publication_preserves_original_capture_requirements(self):
        self.packet = {**self.packet, 'ticket': 'T-P3-v2',
                       'files': [{'path': 'src/main.ts', 'content': 'export const legacy = true;\n'}]}
        body = self.publish_fixture('T-P3-v2', 'astra/t-p3-v2-12-1', 'T-P3 v2: screenshot to screen')
        self.assertIn('- Draft only. PR CI and all twenty pg-candidates, contact-sheet inspection, '
                      'complete ticket evidence, Novak baseline blessing and independent fresh-context '
                      'review remain required.\n', body)
        self.assertNotIn('pose/aspect', body)

    def publish_fixture(self, ticket, branch, title):
        meta = c.prepare(self.root, self.packet, self.artifact, ticket)
        run, jobs, report = self.proof(meta, ticket)
        requests = []
        def api(repo, path, token, method='GET', body=None):
            self.assertEqual(repo, c.REPOSITORY)  # No private runner API in the public route.
            requests.append((repo, path, method, body))
            if path == '/actions/runs/12': return run
            if path == '/actions/runs/12/attempts/1/jobs?per_page=100':
                return {'total_count': 1, 'jobs': jobs}
            if path == '/git/ref/heads/main': return {'object': {'sha': meta['base_sha']}}
            if path == '/git/ref/heads/' + branch: return {'object': {'sha': meta['tested_sha']}}
            if path.startswith('/pulls?'): return []
            if path == '/pulls' and method == 'POST': return {'html_url': 'https://example.invalid/pull/1'}
            raise AssertionError(path)
        def artifacts(run_id, attempt, name, token, wanted):
            if name == 'candidate-test': return {'report.json': json.dumps(report).encode()}
            return {name: (self.artifact / name).read_bytes() for name in wanted}
        with patch.object(pub, 'api', side_effect=api), patch.object(pub, 'artifact_files', side_effect=artifacts), \
             patch.object(pub, 'current_base'), patch.object(c, 'command') as command:
            result = pub.publish(self.root, 12, 'fake-runner', 'fake-write', 'b' * 40, ticket)
        command.assert_not_called()
        self.assertEqual(result, 'https://example.invalid/pull/1')
        posts = [r for r in requests if r[2] == 'POST']
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0][3]['head'], branch)
        self.assertEqual(posts[0][3]['base'], 'main')
        self.assertTrue(posts[0][3]['draft'])
        self.assertEqual(posts[0][3]['title'], title)
        return posts[0][3]['body']

    def test_wrong_run_rejected_before_artifact_or_write_access(self):
        run = {'path': '.github/workflows/candidate-test.yml', 'conclusion': 'success',
               'head_branch': 'main', 'head_sha': 'b' * 40}
        with patch.object(pub, 'api', return_value=run) as api, patch.object(pub, 'artifact_files') as files:
            with self.assertRaisesRegex(ValueError, 'Untrusted'):
                pub.publish(self.root, 12, 'fake-runner', 'fake-write', 'b' * 40, 'T-P5')
        files.assert_not_called()
        self.assertEqual(api.call_count, 1)

    def test_legacy_tp3_artifact_without_ticket_metadata_still_verifies(self):
        packet = {**self.packet, 'ticket': 'T-P3-v2',
                  'files': [{'path': 'src/main.ts', 'content': 'export const oldProfile = true;\n'}]}
        meta = c.prepare(self.root, packet, self.artifact)
        del meta['ticket']
        (self.artifact / 'candidate.json').write_text(json.dumps(meta))
        self.assertEqual(c.verify(self.root, self.artifact), (packet, meta))

    def test_dedicated_workflows_bind_ticket_in_trusted_commands(self):
        workflows = Path(__file__).resolve().parents[3] / '.github/workflows'
        text = (workflows / 'candidate-tp5-test.yml').read_text()
        self.assertIn('candidate.py prepare --ticket T-P5 --checkout', text)
        self.assertIn('candidate.py test --ticket T-P5 --checkout', text)
        self.assertIn('publish_candidate.py --ticket T-P5 --checkout',
                      (workflows / 'candidate-tp5-publish.yml').read_text())
        self.assertFalse((workflows / 'candidate-test.yml').exists())
        self.assertFalse((workflows / 'candidate-publish.yml').exists())


if __name__ == '__main__':
    unittest.main()
