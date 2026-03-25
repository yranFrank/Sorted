export type PdfTextItem = {
  str?: string;
  transform: number[];
};

export type PositionedText = {
  text: string;
  x: number;
};

export type PositionedLine = {
  text: string;
  cells: PositionedText[];
};

export type ColumnLayout = {
  debitX: number | null;
  creditX: number | null;
  balanceX: number | null;
};

export type BankParserConfig = {
  name: string;
  aliases: string[];
  headingHints: string[];
  stopPhrases: string[];
  defaultAccountName: string;
  metadataLabels: string[];
};

export type ParsedTransaction = {
  date: string;
  description: string;
  amount: number;
  debit_credit: string;
  balance: number;
  channel: string;
  category: string;
  status: string;
  raw_text: string;
  transaction_reference: string;
};

export type KeywordInferenceRule = {
  keywords: string[];
  value: string;
  startsWith?: boolean;
};

export type StatementAnalysis = {
  filePath: string;
  pages: number;
  rawText: string;
  bankName: string;
  accountName: string;
  bsb: string;
  accountNumber: string;
  statementStartDate: string;
  statementEndDate: string;
  transactions: ParsedTransaction[];
};
