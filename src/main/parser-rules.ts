import type { KeywordInferenceRule } from "./parser-types";

const creditDirectionRules: KeywordInferenceRule[] = [
  { keywords: ["deposit", "interest", "credit", "refund", "reversal", "salary", "payroll", "wage"], value: "credit" },
  { keywords: ["pay "], value: "credit" },
  { keywords: ["pay "], value: "credit", startsWith: true }
];

const debitDirectionRules: KeywordInferenceRule[] = [
  { keywords: ["purchase", "withdrawal", "fee", "direct debit", "debit card", "atm", "bill"], value: "debit" }
];

const channelRules: KeywordInferenceRule[] = [
  { keywords: ["debit card"], value: "card" },
  { keywords: ["atm"], value: "atm" },
  { keywords: ["osko", "transfer"], value: "transfer" }
];

const expenseCategoryRules: KeywordInferenceRule[] = [
  { keywords: ["coles", "asian grocery", "vegetables", "market boys"], value: "Grocery + eating out" },
  { keywords: ["vodafone"], value: "Internet / phone" },
  { keywords: ["uber", "7-eleven"], value: "Transport" },
  { keywords: ["pickleball", "youtube"], value: "Entertainment" },
  { keywords: ["jb hi fi", "taobao"], value: "Cloth + shopping" },
  { keywords: ["microsoft"], value: "Education" }
];

function matchesRule(lowerText: string, rule: KeywordInferenceRule) {
  return rule.keywords.some((keyword) =>
    rule.startsWith ? lowerText.startsWith(keyword) : lowerText.includes(keyword)
  );
}

function pickRuleValue(lowerText: string, rules: KeywordInferenceRule[]) {
  const match = rules.find((rule) => matchesRule(lowerText, rule));
  return match?.value || null;
}

export function inferDirection(description: string) {
  const lower = description.toLowerCase();
  return (
    pickRuleValue(lower, creditDirectionRules) ||
    pickRuleValue(lower, debitDirectionRules) ||
    "unknown"
  );
}

export function inferChannel(description: string) {
  const lower = description.toLowerCase();
  return pickRuleValue(lower, channelRules) || "unknown";
}

export function inferCategory(description: string, direction: string) {
  const lower = description.toLowerCase();
  if (direction === "credit") {
    if (lower.includes("interest")) return "Interest income";
    if (lower.includes("cash")) return "Cash deposit";
    return "PAYG income";
  }
  return pickRuleValue(lower, expenseCategoryRules) || "Other (Raise concern)";
}
