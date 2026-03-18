$p = 'src\main\parser.ts'
$c = Get-Content $p -Raw
$c = $c.Replace('const dateMatch = raw.match(/\d\d\/\d\d\/\d\d/);', 'const dateMatch = raw.match(/\d\d\/\d\d\/\d\d/);')
$c = $c.Replace('if (line.match(/\d\d\/\d\d\/\d\d/)) {', 'if (line.match(/\d\d\/\d\d\/\d\d/)) {')
Set-Content $p $c
