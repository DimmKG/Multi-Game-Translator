/**
 * Synthetic Necesse-like `.lang` fixtures for integration tests.
 * Intentionally not derived from copyrighted game localization files.
 */

export type SyntheticEntry = {
  key: string;
  english: string;
  /** Target translation when fully translated (no status prefix). */
  translated?: string;
  /** Emit SAME_TRANSLATION in the target file. */
  sameAsEnglish?: boolean;
  /** Emit MISSING_TRANSLATION in the target file. */
  missing?: boolean;
};

type SyntheticSection = {
  name: string;
  entries: SyntheticEntry[];
};

const HEADER = [
  "// Synthetic localization fixture for Necesse-Lang-Translator tests.",
  "// Not an official game file. Placeholders: <text>, [newline], [item/input=...].",
  "// MISSING_TRANSLATION / SAME_TRANSLATION prefixes mirror Necesse conventions.",
  "",
].join("\n");

function numberedEntries(
  prefix: string,
  count: number,
  englishFactory: (index: number) => string,
  targetFactory?: (index: number) => Omit<SyntheticEntry, "key" | "english">,
): SyntheticEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return {
      key: `${prefix}${n}`,
      english: englishFactory(n),
      ...(targetFactory?.(n) ?? {}),
    };
  });
}

/** Shared catalog used by both English reference and target translation. */
export function syntheticCatalog(): SyntheticSection[] {
  return [
    {
      name: "[lang]",
      entries: [
        {
          key: "localname",
          english: "English",
          translated: "Synthetisch",
        },
        {
          key: "engname",
          english: "English",
          translated: "Synthetic",
        },
        {
          key: "credits",
          english: "By the fixture authors",
          translated: "Von den Fixture-Autoren",
        },
        {
          key: "extrasymbols",
          english: "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz",
          sameAsEnglish: true,
        },
      ],
    },
    {
      name: "[tile]",
      entries: [
        { key: "watertile", english: "Water", translated: "Wasser" },
        { key: "grasstile", english: "Grass", translated: "Gras" },
        { key: "sandtile", english: "Sand", sameAsEnglish: true },
        { key: "lavatile", english: "Lava", sameAsEnglish: true },
        { key: "mudtile", english: "Mud", translated: "Schlamm" },
        { key: "rocktile", english: "Rock", translated: "Fels" },
        {
          key: "spiritwatertile",
          english: "Spirit Water",
          translated: "Geisterwasser",
        },
        {
          key: "dungeonfloor",
          english: "Dungeon Floor",
          missing: true,
        },
        ...numberedEntries(
          "tilepad",
          24,
          (n) => `Tile Pad ${n}`,
          (n) =>
            n % 5 === 0
              ? { sameAsEnglish: true }
              : n % 7 === 0
                ? { missing: true }
                : { translated: `Kachel Pad ${n}` },
        ),
      ],
    },
    {
      name: "[item]",
      entries: [
        {
          key: "greeting",
          english: "Hello <name>",
          translated: "Hallo <name>",
        },
        {
          key: "tooltip",
          english: "Press [item/input=interact] to use",
          translated: "Drücke [item/input=interact] zum Nutzen",
        },
        {
          key: "multiline",
          english: "Line one[newline]Line two",
          translated: "Zeile eins[newline]Zeile zwei",
        },
        {
          key: "oreformat",
          english: "<rock> <ore>",
          sameAsEnglish: true,
        },
        {
          key: "brandnewrelic",
          english: "Brand New Relic",
          missing: true,
        },
        ...numberedEntries(
          "loot",
          30,
          (n) => `Loot Drop ${n}`,
          (n) =>
            n % 4 === 0
              ? { missing: true }
              : n % 6 === 0
                ? { sameAsEnglish: true }
                : { translated: `Beute ${n}` },
        ),
      ],
    },
    {
      name: "[ui]",
      entries: [
        {
          key: "timerticks",
          english: "Ticks: <value>",
          sameAsEnglish: true,
        },
        {
          key: "saveprompt",
          english: "Save changes?",
          translated: "Änderungen speichern?",
        },
        {
          key: "unsavedfeature",
          english: "Unsaved Feature Label",
          missing: true,
        },
        ...numberedEntries(
          "menuitem",
          20,
          (n) => `Menu Item ${n}`,
          (n) => (n % 3 === 0 ? { missing: true } : { translated: `Menüpunkt ${n}` }),
        ),
      ],
    },
  ];
}

function renderEnglishEntry(entry: SyntheticEntry): string {
  return `${entry.key}=${entry.english}`;
}

function renderTargetEntry(entry: SyntheticEntry): string {
  if (entry.missing) {
    return `MISSING_TRANSLATION:${entry.key}=${entry.english}`;
  }
  if (entry.sameAsEnglish) {
    return `SAME_TRANSLATION:${entry.key}=${entry.english}`;
  }
  return `${entry.key}=${entry.translated ?? entry.english}`;
}

function renderDocument(
  sections: SyntheticSection[],
  renderEntry: (entry: SyntheticEntry) => string,
  langHeader: string[],
): string {
  const chunks: string[] = [HEADER, ...langHeader, ""];
  for (const section of sections) {
    chunks.push(section.name);
    for (const entry of section.entries) {
      chunks.push(renderEntry(entry));
    }
    chunks.push("");
  }
  return chunks.join("\n").trimEnd() + "\n";
}

/** English-style reference document. */
export function buildSyntheticEnglishReference(): string {
  return renderDocument(syntheticCatalog(), renderEnglishEntry, [
    "// Reference language: English (synthetic)",
  ]);
}

/** Partial target translation with SAME / MISSING markers. */
export function buildSyntheticTargetTranslation(): string {
  return renderDocument(syntheticCatalog(), renderTargetEntry, [
    "// Target language: Synthetic German-like mix",
  ]);
}

export function countSyntheticEntries(): number {
  return syntheticCatalog().reduce((sum, section) => sum + section.entries.length, 0);
}
