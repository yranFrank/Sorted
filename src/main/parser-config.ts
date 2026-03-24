import type { BankParserConfig } from "./parser-types";

export const bankConfigs: BankParserConfig[] = [
  {
    name: "Westpac",
    aliases: ["westpac"],
    headingHints: ["transaction description"],
    stopPhrases: ["westpac banking corporation", "please check all entries", "statement no.", "transactions"],
    defaultAccountName: "Westpac Choice",
    metadataLabels: ["account name", "statement period"]
  },
  {
    name: "CBA",
    aliases: ["commonwealth bank", "commbank", "cba"],
    headingHints: ["description", "details", "debit", "credit"],
    stopPhrases: ["opening balance", "closing balance", "statement summary"],
    defaultAccountName: "CBA account",
    metadataLabels: ["account name", "account", "statement period"]
  },
  {
    name: "ANZ",
    aliases: ["australia and new zealand banking group", "anz"],
    headingHints: ["details", "transaction details", "withdrawals", "deposits"],
    stopPhrases: ["summary of accounts", "fees summary"],
    defaultAccountName: "ANZ account",
    metadataLabels: ["account name", "account", "statement period"]
  },
  {
    name: "NAB",
    aliases: ["national australia bank", "nab"],
    headingHints: ["details", "transaction details", "debit", "credit"],
    stopPhrases: ["opening balance", "closing balance", "fees and charges"],
    defaultAccountName: "NAB account",
    metadataLabels: ["account name", "account", "statement period"]
  },
  {
    name: "Bank of Melbourne",
    aliases: ["bank of melbourne"],
    headingHints: ["details", "transaction description"],
    stopPhrases: ["bank of melbourne"],
    defaultAccountName: "Bank of Melbourne account",
    metadataLabels: ["account name", "statement period"]
  },
  {
    name: "ING",
    aliases: ["ing"],
    headingHints: ["details", "description"],
    stopPhrases: ["ing"],
    defaultAccountName: "ING account",
    metadataLabels: ["account name", "statement period"]
  },
  {
    name: "BOQ",
    aliases: ["bank of queensland", "boq"],
    headingHints: ["details", "description"],
    stopPhrases: ["bank of queensland", "boq"],
    defaultAccountName: "BOQ account",
    metadataLabels: ["account name", "statement period"]
  }
];

export function detectBank(rawText: string) {
  const lower = rawText.toLowerCase();
  for (const config of bankConfigs) {
    for (const alias of config.aliases) {
      if (lower.includes(alias)) {
        return config.name;
      }
    }
  }
  return "Unknown bank";
}

export function getBankConfig(bankName: string) {
  return (
    bankConfigs.find((item) => item.name === bankName) || {
      name: bankName,
      aliases: [],
      headingHints: ["transaction description", "details", "description"],
      stopPhrases: ["statement summary"],
      defaultAccountName: bankName === "Unknown bank" ? "Statement account" : bankName + " account",
      metadataLabels: ["account name", "account", "statement period"]
    }
  );
}
