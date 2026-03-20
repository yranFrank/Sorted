import { readFile } from 'node:fs/promises';

export type ParserResult = { filePath: string; pages: number; rawText: string };

type PdfTextItem = {
  str?: string;
  transform: number[];
};

type PositionedText = {
  text: string;
  x: number;
};

type PositionedLine = {
  text: string;
  cells: PositionedText[];
};

type ColumnLayout = {
  debitX: number | null;
  creditX: number | null;
  balanceX: number | null;
};

function buildPageLines(items: PdfTextItem[]): PositionedLine[] {
  const rows = new Map<string, Array<{ text: string; x: number }>>();
  for (const item of items) {
    if (!item.str || item.str.trim() === '') { continue; }
    const y = String(Math.round(item.transform[5]));
    if (!rows.has(y)) { rows.set(y, []); }
    rows.get(y)?.push({ text: item.str, x: item.transform[4] });
  }
  return Array.from(rows.entries())
    .sort(function (a, b) { return Number(b[0]) - Number(a[0]); })
    .map(function (entry) {
      const cells = entry[1]
        .sort(function (a, b) { return a.x - b.x; })
        .map(function (item) { return { text: item.text.trim(), x: item.x }; })
        .filter(function (item) { return item.text !== ''; });
      return {
        text: cells.map(function (item) { return item.text; }).join(' ').replace(/\s+/g, ' ').trim(),
        cells
      };
    })
    .filter(function (line) { return line.text !== ''; });
}

export async function parseStatement(filePath: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = await readFile(filePath);
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
  const document = await loadingTask.promise;
  const pageTexts: string[] = [];
  let pageNumber = 1;
  while (pageNumber != document.numPages + 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageLines = buildPageLines(textContent.items as PdfTextItem[]);
    pageTexts.push(`Page ${pageNumber}\n${pageLines.map(function (line) { return line.text; }).join('\n')}`);
    pageNumber += 1;
  }
  await loadingTask.destroy();
  return { filePath: filePath, pages: document.numPages, rawText: pageTexts.join('\n\n=== PAGE BREAK ===\n\n') };
}

export async function extractWestpacLines(filePath: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = await readFile(filePath);
  const document = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const lines: string[] = [];
  let pageNumber = 1;
  while (pageNumber != document.numPages + 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageLines = buildPageLines(textContent.items as PdfTextItem[]);
    for (const line of pageLines) { lines.push(line); }
    pageNumber += 1;
  }
  return lines;
}

type BankParserConfig = {
  name: string;
  aliases: string[];
  headingHints: string[];
  stopPhrases: string[];
  defaultAccountName: string;
  metadataLabels: string[];
};

const bankConfigs: BankParserConfig[] = [
  {
    name: 'Westpac',
    aliases: ['westpac'],
    headingHints: ['transaction description'],
    stopPhrases: ['westpac banking corporation', 'please check all entries', 'statement no.', 'transactions'],
    defaultAccountName: 'Westpac Choice',
    metadataLabels: ['account name', 'statement period']
  },
  {
    name: 'CBA',
    aliases: ['commonwealth bank', 'commbank', 'cba'],
    headingHints: ['description', 'details', 'debit', 'credit'],
    stopPhrases: ['opening balance', 'closing balance', 'statement summary'],
    defaultAccountName: 'CBA account',
    metadataLabels: ['account name', 'account', 'statement period']
  },
  {
    name: 'ANZ',
    aliases: ['australia and new zealand banking group', 'anz'],
    headingHints: ['details', 'transaction details', 'withdrawals', 'deposits'],
    stopPhrases: ['summary of accounts', 'fees summary'],
    defaultAccountName: 'ANZ account',
    metadataLabels: ['account name', 'account', 'statement period']
  },
  {
    name: 'NAB',
    aliases: ['national australia bank', 'nab'],
    headingHints: ['details', 'transaction details', 'debit', 'credit'],
    stopPhrases: ['opening balance', 'closing balance', 'fees and charges'],
    defaultAccountName: 'NAB account',
    metadataLabels: ['account name', 'account', 'statement period']
  },
  {
    name: 'Bank of Melbourne',
    aliases: ['bank of melbourne'],
    headingHints: ['details', 'transaction description'],
    stopPhrases: ['bank of melbourne'],
    defaultAccountName: 'Bank of Melbourne account',
    metadataLabels: ['account name', 'statement period']
  },
  {
    name: 'ING',
    aliases: ['ing'],
    headingHints: ['details', 'description'],
    stopPhrases: ['ing'],
    defaultAccountName: 'ING account',
    metadataLabels: ['account name', 'statement period']
  },
  {
    name: 'BOQ',
    aliases: ['bank of queensland', 'boq'],
    headingHints: ['details', 'description'],
    stopPhrases: ['bank of queensland', 'boq'],
    defaultAccountName: 'BOQ account',
    metadataLabels: ['account name', 'statement period']
  }
];

function detectBank(rawText: string) {
  const lower = rawText.toLowerCase();
  for (const config of bankConfigs) {
    for (const alias of config.aliases) {
      if (lower.includes(alias)) {
        return config.name;
      }
    }
  }
  return 'Unknown bank';
}

function getBankConfig(bankName: string) {
  return bankConfigs.find((item) => item.name === bankName) || {
    name: bankName,
    aliases: [],
    headingHints: ['transaction description', 'details', 'description'],
    stopPhrases: ['statement summary'],
    defaultAccountName: bankName === 'Unknown bank' ? 'Statement account' : bankName + ' account',
    metadataLabels: ['account name', 'account', 'statement period']
  };
}

export type ParsedTransaction = { date: string; description: string; amount: number; debit_credit: string; balance: number; channel: string; category: string; status: string; raw_text: string; transaction_reference: string };
export type StatementAnalysis = { filePath: string; pages: number; rawText: string; bankName: string; accountName: string; bsb: string; accountNumber: string; statementStartDate: string; statementEndDate: string; transactions: ParsedTransaction[] };

function cleanAmount(text: string) { return Number(text.replace(/,/g, '')); }
function inferDirection(description: string) {
  const lower = description.toLowerCase();
  if (lower.includes('deposit')) { return 'credit'; }
  if (lower.includes('interest')) { return 'credit'; }
  if (lower.includes('credit')) { return 'credit'; }
  if (lower.includes('refund')) { return 'credit'; }
  if (lower.includes('reversal')) { return 'credit'; }
  if (lower.includes('salary')) { return 'credit'; }
  if (lower.includes('payroll')) { return 'credit'; }
  if (lower.includes('wage')) { return 'credit'; }
  if (lower.includes('pay ')) { return 'credit'; }
  if (lower.startsWith('pay ')) { return 'credit'; }
  if (lower.includes('purchase')) { return 'debit'; }
  if (lower.includes('withdrawal')) { return 'debit'; }
  if (lower.includes('fee')) { return 'debit'; }
  if (lower.includes('direct debit')) { return 'debit'; }
  if (lower.includes('debit card')) { return 'debit'; }
  if (lower.includes('atm')) { return 'debit'; }
  if (lower.includes('bill')) { return 'debit'; }
  return 'unknown';
}
function inferChannel(description: string) {
  const lower = description.toLowerCase();
  if (lower.includes('debit card')) { return 'card'; }
  if (lower.includes('atm')) { return 'atm'; }
  if (lower.includes('osko')) { return 'transfer'; }
  if (lower.includes('transfer')) { return 'transfer'; }
  return 'unknown';
}
function inferCategory(description: string, direction: string) {
  const lower = description.toLowerCase();
  if (direction == 'credit') {
    if (lower.includes('interest')) { return 'Interest income'; }
    if (lower.includes('cash')) { return 'Cash deposit'; }
    return 'PAYG income';
  }
  if (lower.includes('coles')) { return 'Grocery + eating out'; }
  if (lower.includes('asian grocery')) { return 'Grocery + eating out'; }
  if (lower.includes('vegetables')) { return 'Grocery + eating out'; }
  if (lower.includes('market boys')) { return 'Grocery + eating out'; }
  if (lower.includes('vodafone')) { return 'Internet / phone'; }
  if (lower.includes('uber')) { return 'Transport'; }
  if (lower.includes('7-eleven')) { return 'Transport'; }
  if (lower.includes('pickleball')) { return 'Entertainment'; }
  if (lower.includes('youtube')) { return 'Entertainment'; }
  if (lower.includes('jb hi fi')) { return 'Cloth + shopping'; }
  if (lower.includes('taobao')) { return 'Cloth + shopping'; }
  if (lower.includes('microsoft')) { return 'Education'; }
  return 'Other (Raise concern)';
}

function detectColumnLayout(line: PositionedLine): ColumnLayout | null {
  const lowerCells = line.cells.map(function (cell) { return { ...cell, lower: cell.text.toLowerCase() }; });
  const debit = lowerCells.find(function (cell) { return cell.lower === 'debit'; });
  const credit = lowerCells.find(function (cell) { return cell.lower === 'credit'; });
  const balance = lowerCells.find(function (cell) { return cell.lower === 'balance'; });
  if (!debit && !credit && !balance) { return null; }
  return {
    debitX: debit ? debit.x : null,
    creditX: credit ? credit.x : null,
    balanceX: balance ? balance.x : null
  };
}

function determineDirectionFromColumns(amountX: number, columns: ColumnLayout | null) {
  if (!columns) { return null; }
  const distances = [
    columns.debitX == null ? null : { direction: 'debit', distance: Math.abs(amountX - columns.debitX) },
    columns.creditX == null ? null : { direction: 'credit', distance: Math.abs(amountX - columns.creditX) }
  ].filter(function (item): item is { direction: string; distance: number } { return item !== null; });
  if (distances.length === 0) { return null; }
  distances.sort(function (a, b) { return a.distance - b.distance; });
  return distances[0].distance <= 28 ? distances[0].direction : null;
}

function parseGenericTransactionLines(lines: PositionedLine[], columns: ColumnLayout | null) {
  const raw = lines.map(function (line) { return line.text; }).join(' ');
  if (raw.includes('STATEMENT OPENING BALANCE')) { return null; }
  const firstLine = lines[0];
  const dateCell = firstLine.cells.find(function (cell) { return /^\d\d\/\d\d\/\d\d$/.test(cell.text); });
  if (!dateCell) { return null; }
  const allCells = lines.flatMap(function (line) { return line.cells; });
  const amountCells = allCells
    .filter(function (cell) { return /^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(cell.text); })
    .map(function (cell) { return { ...cell, value: cleanAmount(cell.text) }; });
  if (amountCells.length < 2) { return null; }

  let balanceCell = amountCells[amountCells.length - 1];
  if (columns && columns.balanceX != null) {
    const matchingBalance = amountCells
      .slice()
      .sort(function (a, b) {
        return Math.abs(a.x - columns.balanceX!) - Math.abs(b.x - columns.balanceX!);
      })[0];
    if (matchingBalance && Math.abs(matchingBalance.x - columns.balanceX) <= 28) {
      balanceCell = matchingBalance;
    }
  }

  const valueCells = amountCells.filter(function (cell) {
    return !(cell.x === balanceCell.x && cell.text === balanceCell.text);
  });
  if (valueCells.length === 0) { return null; }
  const amountCell = valueCells.sort(function (a, b) { return b.x - a.x; })[0];

  const descriptionCells = allCells.filter(function (cell) {
    return cell.x > dateCell.x && cell.x < amountCell.x && !/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(cell.text);
  });
  const description = descriptionCells.map(function (cell) { return cell.text; }).join(' ').replace(/\s+/g, ' ').trim();
  if (description === '') { return null; }

  const directionFromColumns = determineDirectionFromColumns(amountCell.x, columns);
  const direction = directionFromColumns || inferDirection(description);
  const category = inferCategory(description, direction);
  return { date: dateCell.text, description: description, amount: amountCell.value, debit_credit: direction, balance: balanceCell.value, channel: inferChannel(description), category: category, status: category === '' ? 'needs_review' : 'reviewed', raw_text: raw, transaction_reference: raw };
}

function extractStatementWindow(lines: PositionedLine[], bankName: string) {
  const config = getBankConfig(bankName);
  const transactions: ParsedTransaction[] = [];
  let started = false;
  let current: PositionedLine[] = [];
  let columns: ColumnLayout | null = null;
  for (const line of lines) {
    const normalized = line.text.trim();
    const lower = normalized.toLowerCase();
    if (!started && lower.includes('date') && config.headingHints.some((hint) => lower.includes(hint))) {
      columns = detectColumnLayout(line);
      started = true;
      continue;
    }
    if (!started) { continue; }
    if (config.stopPhrases.some((phrase) => lower.includes(phrase))) { continue; }
    if (normalized.match(/^\d\d\/\d\d\/\d\d/)) {
      if (current.length !== 0) {
        const tx = parseGenericTransactionLines(current, columns);
        if (tx) { transactions.push(tx); }
      }
      current = [line];
      continue;
    }
    if (current.length !== 0) { current.push(line); }
  }
  if (current.length !== 0) {
    const tx = parseGenericTransactionLines(current, columns);
    if (tx) { transactions.push(tx); }
  }
  return transactions;
}

function extractMetadata(lines: PositionedLine[], bankName: string) {
  const config = getBankConfig(bankName);
  let startDate = '';
  let endDate = '';
  let accountName = config.defaultAccountName;
  let bsb = '';
  let accountNumber = '';
  for (const line of lines) {
    const text = line.text;
    const period = text.match(/\d\d\s[A-Za-z]+\s\d\d\d\d\s-\s\d\d\s[A-Za-z]+\s\d\d\d\d|\d\d\/\d\d\/\d\d(?:\d\d)?\s-\s\d\d\/\d\d\/\d\d(?:\d\d)?/);
    if (period) { const pieces = period[0].split(' - '); startDate = pieces[0]; endDate = pieces[1]; }
    const bsbMatch = text.match(/\d\d\d-\d\d\d/);
    const accountMatch = text.match(/\d\d\d\s\d\d\d|\d{4,12}/);
    if (bsbMatch) { bsb = bsbMatch[0]; }
    if (accountMatch && accountNumber === '') { accountNumber = accountMatch[0]; }
    if (config.metadataLabels.some((label) => text.toLowerCase().includes(label))) { accountName = text.split(':').slice(1).join(':').trim() || accountName; }
  }
  return { startDate, endDate, accountName, bsb, accountNumber };
}
export async function analyzeStatement(filePath: string) {
  const parsed = await parseStatement(filePath);
  const lines = await extractWestpacLines(filePath);
  const bankName = detectBank(parsed.rawText);
  const transactions = extractStatementWindow(lines, bankName);
  const metadata = extractMetadata(lines, bankName);
  return { filePath: parsed.filePath, pages: parsed.pages, rawText: parsed.rawText, bankName: bankName, accountName: metadata.accountName, bsb: metadata.bsb, accountNumber: metadata.accountNumber, statementStartDate: metadata.startDate, statementEndDate: metadata.endDate, transactions: transactions };
}



