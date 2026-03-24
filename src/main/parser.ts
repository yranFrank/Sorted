import { readFile } from "node:fs/promises";
import { detectBank } from "./parser-config";
import { buildPageLines } from "./parser-layout";
import { extractMetadata, extractStatementWindow } from "./parser-heuristics";
import type { PdfTextItem, PositionedLine, StatementAnalysis } from "./parser-types";

export type ParserResult = { filePath: string; pages: number; rawText: string };

async function collectPdfContent(filePath: string) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = await readFile(filePath);
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
  const document = await loadingTask.promise;
  const pageTexts: string[] = [];
  const lines: PositionedLine[] = [];

  let pageNumber = 1;
  while (pageNumber !== document.numPages + 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageLines = buildPageLines(textContent.items as PdfTextItem[]);
    pageTexts.push(
      `Page ${pageNumber}\n${pageLines
        .map(function (line) {
          return line.text;
        })
        .join("\n")}`
    );
    for (const line of pageLines) {
      lines.push(line);
    }
    pageNumber += 1;
  }

  await loadingTask.destroy();
  return { pages: document.numPages, pageTexts, lines };
}

export async function parseStatement(filePath: string): Promise<ParserResult> {
  const content = await collectPdfContent(filePath);
  return {
    filePath,
    pages: content.pages,
    rawText: content.pageTexts.join("\n\n=== PAGE BREAK ===\n\n")
  };
}

export async function extractWestpacLines(filePath: string): Promise<PositionedLine[]> {
  const content = await collectPdfContent(filePath);
  return content.lines;
}

export async function analyzeStatement(filePath: string): Promise<StatementAnalysis> {
  const content = await collectPdfContent(filePath);
  const rawText = content.pageTexts.join("\n\n=== PAGE BREAK ===\n\n");
  const bankName = detectBank(rawText);
  const transactions = extractStatementWindow(content.lines, bankName);
  const metadata = extractMetadata(content.lines, bankName);
  return {
    filePath,
    pages: content.pages,
    rawText,
    bankName,
    accountName: metadata.accountName,
    bsb: metadata.bsb,
    accountNumber: metadata.accountNumber,
    statementStartDate: metadata.startDate,
    statementEndDate: metadata.endDate,
    transactions
  };
}
