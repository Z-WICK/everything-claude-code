# Factory Sidecar

This directory is the Factory/Droid adapter layer for ECC.

## Design

- Keep the upstream shared core as the source of truth:
  - `agents/`
  - `commands/`
  - `skills/`
- Keep Factory-specific files isolated under `.factory/` to reduce merge conflicts
- Regenerate managed files after upstream updates instead of hand-editing copies
- New upstream commands are auto-discovered unless they match the sidecar's exclusion rules

## Managed Outputs

- `.factory/droids/` mirrors `agents/`
- `.factory/commands/` mirrors the shared workflows used in Droid and preserves slash-command arguments via `$ARGUMENTS`
- `.factory/skills/` mirrors only the skills referenced by the mirrored droids
- `.factory/plans/` is reserved for Factory-side plan artifacts and examples

## Maintenance

Regenerate the managed files:

```bash
node .factory/_ecc/sync.js
```

Validate that the sidecar is still in sync:

```bash
node .factory/_ecc/validate.js
```

Adjust auto-discovery without editing the sync logic:

```bash
$EDITOR .factory/_ecc/config.json
```

If upstream updates change prompt content, rerun sync instead of editing generated files directly.
