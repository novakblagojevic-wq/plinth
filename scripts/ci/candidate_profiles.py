"""Trusted candidate policies. Packets select a ticket, never its permissions."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Profile:
    ticket: str
    paths: frozenset[str]
    branch_prefix: str
    title: str
    test_workflow: str
    source_prefix: str = ''
    required_ancestor: str = ''
    required_blobs: tuple[tuple[str, str], ...] = ()
    ci_timeout_seconds: int = 900

    def allows(self, path):
        return path in self.paths or bool(self.source_prefix and
            path.startswith(self.source_prefix) and path.endswith(('.ts', '.glsl')))


PROFILES = {
    'T-P3-v2': Profile(
        ticket='T-P3-v2',
        paths=frozenset({'src/devices/build.ts', 'src/scene.ts', 'src/main.ts', 'index.html',
                         'guards/screen-exempt.test.ts', 'guards/pg-mode.test.ts'}),
        source_prefix='src/screen/',
        branch_prefix='astra/t-p3-v2',
        title='T-P3 v2: screenshot to screen',
        test_workflow='.github/workflows/candidate-test.yml',
    ),
    # Reviewed Plinth PR #9. It must be merged with its standalone P-11 history
    # before this profile can prepare, test or publish any application candidate.
    # The spec blob includes owner-approved P-12. Until that exact amendment is
    # on the current Plinth main, normal prepare/test/publish remains blocked.
    'T-P5': Profile(
        ticket='T-P5',
        paths=frozenset({
            'src/camera/poses.ts', 'src/camera/poses.test.ts',
            'src/camera/controller.ts', 'src/camera/controller.test.ts',
            'src/scene.ts', 'src/scene.test.ts', 'src/main.ts',
            'src/scene/contactShadow.ts', 'src/scene/contactShadow.test.ts',
            'src/scene/studio.ts', 'src/scene/studio.test.ts',
            'guards/pg-mode.test.ts', 'guards/camera-posing.test.ts',
            'scripts/pg-capture.mjs', 'docs/tickets/T-P5.md',
            'docs/tickets/T-P5-environment.md', 'README.md',
        }),
        branch_prefix='astra/t-p5',
        title='T-P5: camera and posing',
        test_workflow='.github/workflows/candidate-tp5-test.yml',
        ci_timeout_seconds=1200,
        required_ancestor='ae5672180bb1c46c181f36594e99260cdab5c37a',
        required_blobs=(
            ('PLINTH_SPEC.md', '0da49b9adf4eb9a5e89c5789fb41de14de38b047'),
            ('docs/tickets/T-P5.md', '62559514ded79fb8d06956bf628ff04b9c9479e0'),
        ),
    ),
}


def profile_for(ticket):
    if not isinstance(ticket, str) or ticket not in PROFILES:
        raise ValueError('Unsupported project or ticket')
    return PROFILES[ticket]
