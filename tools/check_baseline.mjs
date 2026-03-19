import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function check(label, ok, note = "") {
  const status = ok ? "PASS" : "WARN";
  console.log(`[${status}] ${label}${note ? " - " + note : ""}`);
  return ok;
}

const packageJson = JSON.parse(read("package.json"));
const appTsx = read("src/renderer/src/App.tsx");
const parserTs = read("src/main/parser.ts");
const databaseTs = read("src/main/database.ts");
const exporterTs = read("src/main/exporter.ts");
const baselineDoc = fs.existsSync(path.join(root, "docs/baseline-v2.1.md"));

let passCount = 0;
let checkCount = 0;

function run(label, ok, note = "") {
  checkCount += 1;
  if (check(label, ok, note)) {
    passCount += 1;
  }
}

run("Baseline document present", baselineDoc);
run("Build script present", Boolean(packageJson.scripts?.build));
run("Dev script present", Boolean(packageJson.scripts?.dev));
run("PDF preview library installed", Boolean(packageJson.dependencies?.["react-pdf"]));
run("PDF parsing library installed", Boolean(packageJson.dependencies?.["pdfreader"]));
run("Import page exists", appTsx.includes("Import Statements"));
run("Review page exists", appTsx.includes("Parse / Review"));
run("Classification page exists", appTsx.includes("Classification"));
run("Summary page exists", appTsx.includes("Summary"));
run("Export page exists", appTsx.includes("Export"));
run("Review metadata gate exists", appTsx.includes("Complete all required metadata fields before continuing."));
run("Classification unresolved gate exists", appTsx.includes("Summary is gated until all transactions are resolved."));
run("Monthly summary mode exists", appTsx.includes('setSummaryMode("monthly")'));
run("Monthly export mode exists", appTsx.includes('value="monthly"'));
run("Export history persistence exists", databaseTs.includes("export_history"));
run("Adjustments persistence exists", databaseTs.includes("adjustments"));
run("Rule persistence exists", databaseTs.includes("CREATE TABLE IF NOT EXISTS rules"));
run("Rule application flow exists", databaseTs.includes("reapplyRulesAcrossTransactions"));
run("Bank detection exists", parserTs.includes("detectBank("));
run("Multiple bank configs exist", parserTs.includes("name: 'CBA'") && parserTs.includes("name: 'ANZ'") && parserTs.includes("name: 'NAB'"));
run("Workbook exports summary sheet", exporterTs.includes("'Summary'"));
run("Workbook exports adjustments sheet", exporterTs.includes("'Adjustments'"));

console.log("");
console.log(`Baseline check: ${passCount}/${checkCount} passed`);
if (passCount !== checkCount) {
  process.exitCode = 1;
}
