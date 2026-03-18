const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/Frank/Downloads/living expense.xlsx', { cellFormula: true, cellNF: true, cellText: true });
const sheet = wb.Sheets[wb.SheetNames[0]];
