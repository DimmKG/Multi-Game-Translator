import fs from "node:fs";

const sha = "d4bf92ba0cfb462ac791da5cd755d506cca5015f";

const files = [
  [
    "docs/pre-react-release.md",
    "Final tagged commit SHA: **to be recorded after merge**.",
    `Final tagged commit SHA: \`${sha}\`.`
  ],
  [
    "docs/react-migration-contract.md",
    "Final tagged baseline commit: **to be recorded after the release-preparation PR is merged**.",
    `Final tagged baseline commit: \`${sha}\`.`
  ]
];

for (const [path, before, after] of files) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(before)) throw new Error(`Expected placeholder not found in ${path}`);
  fs.writeFileSync(path, source.replace(before, after));
}
