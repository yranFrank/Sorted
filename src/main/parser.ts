import { readFile } from 'node:fs/promises';

export type ParserResult = { filePath: string; pages: number; rawText: string };

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
    const parts: string[] = [];
    for (const item of textContent.items as any[]) {
      if (item.str) { parts.push(item.str); }
    }
    pageTexts.push(parts.join(' '));
    pageNumber += 1;
  }
  await loadingTask.destroy();
  return { filePath: filePath, pages: document.numPages, rawText: pageTexts.join('\n\n') };
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
    const rows: any = {};
    for (const item of textContent.items as any[]) { const y = String(Math.round(item.transform[5])); if (!rows[y]) { rows[y] = []; } if (item.str) { rows[y].push(item.str); } }
    const keys = Object.keys(rows).sort(function (a, b) { return Number(b) - Number(a); });
    for (const key of keys) { lines.push(rows[key].join(' ')); }
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
  return 'debit';
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
function parseGenericTransactionLine(raw: string) {
  if (raw.includes('STATEMENT OPENING BALANCE')) { return null; }
  const dateMatch = raw.match(/\d\d\/\d\d\/\d\d/);
  if (!dateMatch) { return null; }
  const amountMatches = Array.from(raw.matchAll(/\d{1,3}(?:,\d{3})*\.\d{2}/g));
  if (amountMatches.length == 0) { return null; }
  if (amountMatches.length == 1) { return null; }
  const balanceText = amountMatches[amountMatches.length - 1][0];
  const amountText = amountMatches[amountMatches.length - 2][0];
  const description = raw.slice(dateMatch[0].length, Number(amountMatches[amountMatches.length - 2].index)).trim();
  const direction = inferDirection(description);
  const category = inferCategory(description, direction);
  return { date: dateMatch[0], description: description, amount: cleanAmount(amountText), debit_credit: direction, balance: cleanAmount(balanceText), channel: inferChannel(description), category: category, status: category === '' ? 'needs_review' : 'reviewed', raw_text: raw, transaction_reference: raw };
}

function extractStatementWindow(lines: string[], bankName: string) {
  const config = getBankConfig(bankName);
  const transactions: ParsedTransaction[] = [];
  let started = false;
  let current = '';
  for (const line of lines) {
    const normalized = line.trim();
    const lower = normalized.toLowerCase();
    if (!started && lower.includes('date') && config.headingHints.some((hint) => lower.includes(hint))) {
      started = true;
      continue;
    }
    if (!started) { continue; }
    if (config.stopPhrases.some((phrase) => lower.includes(phrase))) { continue; }
    if (normalized.match(/^\d\d\/\d\d\/\d\d/)) {
      if (current !== '') {
        const tx = parseGenericTransactionLine(current);
        if (tx) { transactions.push(tx); }
      }
      current = normalized;
      continue;
    }
    if (current !== '') { current = current + ' ' + normalized; }
  }
  if (current !== '') {
    const tx = parseGenericTransactionLine(current);
    if (tx) { transactions.push(tx); }
  }
  return transactions;
}

function extractMetadata(lines: string[], bankName: string) {
  const config = getBankConfig(bankName);
  let startDate = '';
  let endDate = '';
  let accountName = config.defaultAccountName;
  let bsb = '';
  let accountNumber = '';
  for (const line of lines) {
    const period = line.match(/\d\d\s[A-Za-z]+\s\d\d\d\d\s-\s\d\d\s[A-Za-z]+\s\d\d\d\d|\d\d\/\d\d\/\d\d(?:\d\d)?\s-\s\d\d\/\d\d\/\d\d(?:\d\d)?/);
    if (period) { const pieces = period[0].split(' - '); startDate = pieces[0]; endDate = pieces[1]; }
    const bsbMatch = line.match(/\d\d\d-\d\d\d/);
    const accountMatch = line.match(/\d\d\d\s\d\d\d|\d{4,12}/);
    if (bsbMatch) { bsb = bsbMatch[0]; }
    if (accountMatch && accountNumber === '') { accountNumber = accountMatch[0]; }
    if (config.metadataLabels.some((label) => line.toLowerCase().includes(label))) { accountName = line.split(':').slice(1).join(':').trim() || accountName; }
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



