# Test fixtures

Synthetic Necesse-like `.lang` files for CI and unit tests. They are **not**
copied from the game and are safe to commit.

| File                    | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `synthetic-en.lang`     | Small English-style reference                 |
| `synthetic-target.lang` | Partial target with SAME/MISSING markers      |
| `synthetic-large.lang`  | ~6500-line stress fixture for alignment tests |

Regenerate after changing the builders:

```bash
node --experimental-strip-types scripts/generate-fixtures.mjs
```

Copyrighted game localizations belong only under `test/locals/` (gitignored).
