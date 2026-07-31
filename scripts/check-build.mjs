import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const original = await readFile(resolve("legacy/necesse-lang-translator.original.html"), "utf8");
const built = await readFile(resolve("dist/necesse-lang-translator.html"), "utf8");

const normalize = value => value.replace(/\r\n/g, "\n").replace(/>\s+</g, "><").trim();

if (normalize(original) !== normalize(built)) {
  console.error("The standalone build differs from the original baseline.");
  process.exitCode = 1;
} else {
  console.log("Standalone build matches the original baseline.");
}
