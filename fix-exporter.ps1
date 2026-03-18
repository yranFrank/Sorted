$c = Get-Content 'src\main\exporter.ts'
$c[2] = 'import * as XLSX from ''xlsx'';'
Set-Content 'src\main\exporter.ts' $c
