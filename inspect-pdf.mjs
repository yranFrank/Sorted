import { readFile } from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const filePath = 'C:/Users/Frank/Downloads/eStatement (2).pdf';
const data = await readFile(filePath);
const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
const doc = await loadingTask.promise;
const pages = [];
for (let i = 1; i != doc.numPages + 1; i += 1) { const page = await doc.getPage(i); const textContent = await page.getTextContent(); const parts = []; for (const item of textContent.items) { if (item.str) { parts.push(item.str); } } pages.push({ page: i, text: parts.join(' ') }); }
console.log(JSON.stringify({ numPages: doc.numPages, preview: pages.slice(0, 2) }, null, 2));
