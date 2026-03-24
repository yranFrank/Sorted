import type { PdfTextItem, PositionedLine } from "./parser-types";

export function buildPageLines(items: PdfTextItem[]): PositionedLine[] {
  const rows = new Map<string, Array<{ text: string; x: number }>>();
  for (const item of items) {
    if (!item.str || item.str.trim() === "") {
      continue;
    }
    const y = String(Math.round(item.transform[5]));
    if (!rows.has(y)) {
      rows.set(y, []);
    }
    rows.get(y)?.push({ text: item.str, x: item.transform[4] });
  }
  return Array.from(rows.entries())
    .sort(function (a, b) {
      return Number(b[0]) - Number(a[0]);
    })
    .map(function (entry) {
      const cells = entry[1]
        .sort(function (a, b) {
          return a.x - b.x;
        })
        .map(function (item) {
          return { text: item.text.trim(), x: item.x };
        })
        .filter(function (item) {
          return item.text !== "";
        });
      return {
        text: cells
          .map(function (item) {
            return item.text;
          })
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
        cells
      };
    })
    .filter(function (line) {
      return line.text !== "";
    });
}
