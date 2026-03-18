$c = Get-Content 'src\main\parser.ts'
$c[85] = '  const dateMatch = raw.match(/\d\d\/\d\d\/\d\d/);'
$c[87] = '  const amountMatches = Array.from(raw.matchAll(/\d{1,3}(?:,\d{3})*\.\d{2}/g));'
$c[112] = '    if (line.match(/\d\d\/\d\d\/\d\d/)) {'
$c[126] = '    const period = line.match(/\d\d\s[A-Za-z]+\s\d\d\d\d\s-\s\d\d\s[A-Za-z]+\s\d\d\d\d/);'
Set-Content 'src\main\parser.ts' $c
