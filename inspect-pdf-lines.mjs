import { readFile } from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const data = await readFile('C:/Users/Frank/Downloads/eStatement (2).pdf');
const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
const page = await doc.getPage(1);
const textContent = await page.getTextContent();
const rows = {};
for (const item of textContent.items) { const y = String(Math.round(item.transform[5])); if (!rows[y]) { rows[y] = []; } if (item.str) { rows[y].push(item.str); } }
const keys = Object.keys(rows).sort(function (a, b) { return Number(b) - Number(a); });
console.log(JSON.stringify(keys.slice(0, 40).map(function (key) { return { y: key, text: rows[key].join(' / ') }; }), null, 2));
