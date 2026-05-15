export function normalizeMarkdownContent(content?: string) {
  let value = content || "";

  value = value.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      value = JSON.parse(trimmed);
    } catch {
      value = trimmed.slice(1, -1);
    }
  }

  if (value.includes("\\n")) {
    value = value.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  }

  value = unwrapMarkdownFence(value);

  const lines = value.split("\n");
  const nonEmptyLines = lines.filter((line) => line.trim() !== "");
  const commonIndent = nonEmptyLines.reduce((indent, line) => {
    const match = line.match(/^[ \t]+/);
    const currentIndent = match ? match[0].replace(/\t/g, "    ").length : 0;
    return Math.min(indent, currentIndent);
  }, Number.POSITIVE_INFINITY);

  if (Number.isFinite(commonIndent) && commonIndent >= 4) {
    value = lines
      .map((line) => line.replace(new RegExp(`^[ \\t]{0,${commonIndent}}`), ""))
      .join("\n");
  }

  return value.trim();
}

function unwrapMarkdownFence(content: string) {
  const trimmed = content.trim();
  const match = trimmed.match(/^```(?:markdown|md|mdx|text)?[ \t]*\n([\s\S]*?)\n```[ \t]*$/i);

  return match?.[1] || content;
}
