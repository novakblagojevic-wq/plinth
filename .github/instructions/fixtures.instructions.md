---
applyTo: "fixtures/**"
---
Read-only ground truth: PG baselines (§7). Fix the implementation, never
the baseline. A baseline is blessed only by Novak, from the CI
`pg-candidates` artifact (SwiftShader is the reference GPU; a local render
is never a candidate), in a standalone commit carrying the PG-3(b)
rationale line.
