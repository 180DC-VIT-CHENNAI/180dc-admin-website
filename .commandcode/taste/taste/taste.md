# Taste
- When given a visual reference (Screenshot/PNG/design template), expects the implementation to reproduce it *exactly* — not an approximation or reinterpretation. Confidence: 0.7
- Cares about the pixel/sharpness quality of generated output (e.g. exported PDFs) and will ask for it to be improved; favours higher-fidelity rendering over smaller files. Confidence: 0.75
- Actively rejects lossy/quality-degrading fixes to output (e.g. exporting PDF pages as compressed JPEG to shrink file size) — "quality gone bad" is treated as a regression to be undone, even if the previously stated problem (file size / upload failure) was solved. Confidence: 0.7
- Prefers reusing the original design asset directly (e.g. embedding/using the provided template image itself) rather than recreating the artwork by hand in code — while still keeping dynamic values editable and exportable to PDF. Confidence: 0.6
- Fidelity is expected to yield to hard platform/infra limits (e.g. upload size caps): exporting/uploading must actually succeed. Confidence: 0.5
- But the size limit must be met *without* visible quality loss — the user pushes back on dropping to lossy encoding/resolution, so prefer quality-preserving reductions (compression, downsampling only when imperceptible) or fixing the pipeline over trading away output fidelity. Confidence: 0.65
