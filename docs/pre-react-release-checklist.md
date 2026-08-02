# Pre-React release preparation

This checklist freezes the current HTML application as the stable behavioral baseline before the React and TypeScript migration begins.

## Documentation

- [ ] Update `README.md` to describe the complete current feature set, including Compact view, workspace actions, machine-translation tools, recovery, settings, fonts, glossary QA, review and compare workflows.
- [ ] Add the permanent React migration contract under `docs/` from Issue #51.
- [ ] Review existing guides for stale paths, commands, screenshots and behavior.
- [ ] Document hosted versus standalone behavior explicitly.
- [ ] Record the exact pre-React commit SHA after the release-preparation PR is merged.

## Version and release metadata

- [ ] Choose and apply the pre-release version in `package.json`.
- [ ] Add or update `CHANGELOG.md` with the complete HTML baseline.
- [ ] Prepare GitHub pre-release notes.
- [ ] Choose the annotated pre-React tag name.
- [ ] Attach the generated standalone HTML file to the pre-release.

## Verification

- [ ] Run the full automated verification suite from a clean checkout.
- [ ] Confirm GitHub Pages uses the same generated application behavior.
- [ ] Open the standalone build directly through `file://`.
- [ ] Verify a representative `.lang` round trip without unintended text changes.
- [ ] Verify progress save/load and session recovery.
- [ ] Verify reference-file, Review and Compare workflows.
- [ ] Verify Compact view in Editor, Review and Compare.
- [ ] Verify machine-translation provider and target selection rules.
- [ ] Verify glossary and terminology QA.
- [ ] Verify Settings, font preferences and encrypted credential handling.
- [ ] Check English, Bulgarian, Russian and one RTL interface locale.
- [ ] Check narrow width and 80%, 100% and 125% browser zoom.

## Migration handoff

- [ ] Preserve the final HTML source and standalone artifact.
- [ ] Finalize Issue #51 with the baseline tag and commit SHA.
- [ ] Treat the current test suite as the behavioral specification.
- [ ] Require feature parity before new React-only features.
- [ ] Begin the React/TypeScript migration only after this checklist is complete.
