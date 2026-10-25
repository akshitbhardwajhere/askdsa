export interface CodeChunk {
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  chunkIndex: number;
}

export interface ChunkOptions {
  maxLines?: number;
  overlapLines?: number;
  maxCharacters?: number;
}

const DEFAULT_MAX_LINES = 80;
const DEFAULT_OVERLAP_LINES = 10;
const DEFAULT_MAX_CHARACTERS = 12_000;

export function chunkCode(
  filePath: string,
  source: string,
  options: ChunkOptions = {},
): CodeChunk[] {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const overlapLines = options.overlapLines ?? DEFAULT_OVERLAP_LINES;
  const maxCharacters =
    options.maxCharacters ?? DEFAULT_MAX_CHARACTERS;

  if (!filePath.trim()) {
    throw new Error("filePath must not be empty");
  }

  if (!Number.isInteger(maxLines) || maxLines < 1) {
    throw new Error("maxLines must be a positive integer");
  }

  if (
    !Number.isInteger(overlapLines) ||
    overlapLines < 0 ||
    overlapLines >= maxLines
  ) {
    throw new Error("overlapLines must be an integer >= 0 and < maxLines");
  }

  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) {
    throw new Error("maxCharacters must be a positive integer");
  }

  if (source.length === 0) {
    return [];
  }

  const lines = source.split(/\r\n|\n|\r/);
  const chunks: CodeChunk[] = [];
  let start = 0;

  while (start < lines.length) {
    let end = start;
    let characters = 0;

    while (end < lines.length && end - start < maxLines) {
      const lineLength = lines[end]!.length;
      const separatorLength = end === start ? 0 : 1;

      if (
        end > start &&
        characters + separatorLength + lineLength > maxCharacters
      ) {
        break;
      }

      // A single long line is kept intact rather than silently truncated.
      characters += separatorLength + lineLength;
      end += 1;

      if (characters >= maxCharacters) {
        break;
      }
    }

    const content = lines.slice(start, end).join("\n");

    if (content.trim().length > 0) {
      chunks.push({
        filePath,
        content,
        startLine: start + 1,
        endLine: end,
        chunkIndex: chunks.length,
      });
    }

    if (end >= lines.length) {
      break;
    }

    const nextStart = end - overlapLines;

    // Ensure forward progress, even with unusual option combinations.
    start = nextStart > start ? nextStart : end;
  }

  return chunks;
}
