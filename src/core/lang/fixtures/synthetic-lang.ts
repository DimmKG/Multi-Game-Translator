// SPDX-License-Identifier: AGPL-3.0-or-later
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
        {
          // Same key as [npc].title — reference must match by section, not key alone.
          key: "title",
          english: "Item Title",
          translated: "Gegenstandstitel",
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
      name: "[npc]",
      entries: [
        {
          key: "title",
          english: "Npc Title",
          translated: "NSC-Titel",
        },
        {
          key: "greeting",
          english: "Well met, traveler",
          translated: "Sei gegrüßt, Reisender",
        },
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

type RenderOptions = {
  /** Extra comment lines inserted after each section header (file-specific). */
  sectionNotes?: Readonly<Record<string, readonly string[]>>;
  /** Extra comment lines inserted after a specific key inside a section. */
  entryNotes?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
};

function renderDocument(
  sections: SyntheticSection[],
  renderEntry: (entry: SyntheticEntry) => string,
  langHeader: string[],
  options: RenderOptions = {},
): string {
  const chunks: string[] = [HEADER, ...langHeader, ""];
  for (const section of sections) {
    chunks.push(section.name);
    for (const note of options.sectionNotes?.[section.name] ?? []) {
      chunks.push(note);
    }
    for (const entry of section.entries) {
      chunks.push(renderEntry(entry));
      for (const note of options.entryNotes?.[section.name]?.[entry.key] ?? []) {
        chunks.push(note);
      }
    }
    chunks.push("");
  }
  return chunks.join("\n").trimEnd() + "\n";
}

/** English-style reference document. */
export function buildSyntheticEnglishReference(): string {
  return renderDocument(
    syntheticCatalog(),
    renderEnglishEntry,
    [
      "// Reference language: English (synthetic)",
      "// Reference-only notes: intentional comment drift vs the target file.",
    ],
    {
      sectionNotes: {
        "[tile]": ["// Reference tile catalog notes (not present in target)."],
        "[item]": ["// Reference designers left item lore comments here."],
      },
      entryNotes: {
        "[tile]": {
          watertile: ["// ref: water is the alignment canary for comment drift"],
        },
        "[npc]": {
          title: ["// ref: npc title must not pick up the item title value"],
        },
      },
    },
  );
}

/** Partial target translation with SAME / MISSING markers. */
export function buildSyntheticTargetTranslation(): string {
  return renderDocument(
    syntheticCatalog(),
    renderTargetEntry,
    [
      "// Target language: Synthetic German-like mix",
      "// Translator notes differ from the English reference comments.",
    ],
    {
      sectionNotes: {
        "[lang]": ["// Translator: keep metadata keys in sync with en.lang"],
        "[ui]": ["// Translator UI pass — comments only, no entries moved"],
      },
      entryNotes: {
        "[item]": {
          greeting: ["// TODO: verify <name> placeholder tone"],
          title: ["// target: item title is distinct from npc title"],
        },
        "[npc]": {
          title: ["// target: npc title duplicate-key canary"],
        },
      },
    },
  );
}

export function countSyntheticEntries(): number {
  return syntheticCatalog().reduce((sum, section) => sum + section.entries.length, 0);
}

/**
 * A multi-thousand-line synthetic document for alignment / virtual-list stress
 * tests. Shape mirrors a real Necesse file (header, sections, keys) without
 * copying any game strings — so CI never needs `test/locals/`.
 */
export function buildSyntheticLargeLangFile(entryCount = 6500): string {
  const count = Math.max(100, entryCount);
  const chunks: string[] = [
    "// Synthetic large localization fixture for Necesse-Lang-Translator tests.",
    "// Not an official game file. Safe to commit; regenerate via buildSyntheticLargeLangFile().",
    "",
    "[lang]",
    "localname=Synthetic",
    "engname=Synthetic",
    "credits=Fixture authors",
    "",
  ];

  const sectionSize = 250;
  let remaining = count - 3; // localname/engname/credits already emitted
  let section = 0;
  while (remaining > 0) {
    const take = Math.min(sectionSize, remaining);
    section += 1;
    chunks.push(`[pad${section}]`);
    for (let i = 1; i <= take; i++) {
      const id = (section - 1) * sectionSize + i;
      // Mix lengths and a few tokens so wrap/diff paths stay interesting.
      if (id % 17 === 0) {
        chunks.push(`pad${id}=Label ${id} with <token> and [item/input=use]`);
      } else if (id % 11 === 0) {
        chunks.push(`pad${id}=Short ${id}`);
      } else {
        chunks.push(`pad${id}=Synthetic entry number ${id} for alignment stress tests`);
      }
    }
    chunks.push("");
    remaining -= take;
  }

  return chunks.join("\n").trimEnd() + "\n";
}
