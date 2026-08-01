import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const directory = resolve("src/scripts/i18n/locales");
const files = (await readdir(directory))
  .filter(name => name.endsWith(".js"))
  .sort((a, b) => a === "en.js" ? -1 : b === "en.js" ? 1 : a.localeCompare(b));

if (!files.length) throw new Error("No split JavaScript locale files were found.");

const converted = [];

for (const filename of files) {
  const source = await readFile(resolve(directory, filename), "utf8");
  let captured = null;
  const context = {
    globalThis: null,
    NecesseLocales: {
      register(locale) {
        if (captured) throw new Error(filename + ": locale was registered more than once");
        captured = locale;
      }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename });

  if (!captured || typeof captured !== "object" || Array.isArray(captured)) {
    throw new Error(filename + ": did not register a locale object");
  }
  if (typeof captured.code !== "string" || !captured.code) {
    throw new Error(filename + ": missing locale code");
  }
  if (filename !== captured.code + ".js") {
    throw new Error(filename + ": filename does not match locale code " + captured.code);
  }
  if (typeof captured.name !== "string" || typeof captured.nativeName !== "string") {
    throw new Error(filename + ": invalid locale names");
  }
  if (typeof captured.reviewed !== "boolean") {
    throw new Error(filename + ": reviewed must be boolean");
  }
  if (!captured.messages || typeof captured.messages !== "object" || Array.isArray(captured.messages)) {
    throw new Error(filename + ": messages must be an object");
  }

  const output = {
    code: captured.code,
    name: captured.name,
    nativeName: captured.nativeName,
    reviewed: captured.reviewed,
    messages: captured.messages
  };
  const jsonPath = resolve(directory, captured.code + ".json");
  const serialized = JSON.stringify(output, null, 2) + "\n";
  await writeFile(jsonPath, serialized, "utf8");

  const roundTrip = JSON.parse(await readFile(jsonPath, "utf8"));
  if (roundTrip.code !== captured.code || !roundTrip.messages || typeof roundTrip.messages !== "object") {
    throw new Error(filename + ": JSON round-trip validation failed");
  }

  converted.push({ js: resolve(directory, filename), code: captured.code });
}

for (const item of converted) await unlink(item.js);

console.log("Converted " + converted.length + " locale files to JSON: " + converted.map(item => item.code).join(", "));
