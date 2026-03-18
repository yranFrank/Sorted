const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/Frank/Downloads/living expense.xlsx');
const sheet = wb.Sheets['90 days transactions'];
const keys = Object.keys(sheet).filter(function (key) { return key[0] !== '!'; }).sort();
for (const key of keys) { console.log(key + ' = ' + sheet[key].v); }
