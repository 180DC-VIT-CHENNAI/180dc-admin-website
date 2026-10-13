# Taste

## Output fidelity & design
- When given a visual reference (Screenshot/PNG/design template), expects the implementation to reproduce it *exactly* — not an approximation or reinterpretation. Confidence: 0.7
- Cares about the pixel/sharpness quality of generated output (e.g. exported PDFs) and will ask for it to be improved; favours higher-fidelity rendering over smaller files. Confidence: 0.5
- Prefers reusing the original design asset directly (e.g. embedding/using the provided template image itself) rather than recreating the artwork by hand in code — while still keeping dynamic values editable and exportable to PDF. Confidence: 0.6
