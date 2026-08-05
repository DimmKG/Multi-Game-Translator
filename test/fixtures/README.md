# Test fixtures

Synthetic Necesse-like `.lang` files for CI and unit tests. They are **not**
copied from the game and are safe to commit.

| File                    | Purpose                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `synthetic-en.lang`     | English reference with reference-only comments                                                      |
| `synthetic-target.lang` | Target with different translator comments, SAME/MISSING markers, and duplicate keys across sections |
| `synthetic-large.lang`  | ~6500-line stress fixture for alignment tests                                                       |

Comments intentionally differ between `synthetic-en.lang` and
`synthetic-target.lang`, and both include the same key (`title`) under
`[item]` and `[npc]` so reference loading is exercised by section+key rather
than line index.

Regenerate after changing the builders:

```bash
node --experimental-strip-types scripts/generate-fixtures.mjs
```

Copyrighted game localizations belong only under `test/locals/` (gitignored).
