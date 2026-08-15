// SPDX-License-Identifier: LGPL-3.0-or-later

export interface FileLoaderInput {
  files: Array<{ name: string; text?: string; bytes?: Uint8Array }>;
}

export class FileLoaderParseError extends Error {
  loaderId: string;

  constructor(loaderId: string, message: string) {
    super(message);
    this.name = "FileLoaderParseError";
    this.loaderId = loaderId;
  }
}

export interface FileLoader<TRaw = unknown> {
  id: string;
  displayName: string;
  extensions: string[];
  detect(input: FileLoaderInput): number | boolean;
  /** Throws FileLoaderParseError on malformed input. */
  parse(input: FileLoaderInput): TRaw;
  /** Inverse of parse(); should be maximally round-trip-preserving. */
  serialize(raw: TRaw): FileLoaderInput;
}
