$p = 'src\main\parser.ts'
$c = Get-Content $p -Raw
$c = $c.Replace('raw.match(/\d\d\/\d\d\/\d\d/)', 'raw.match(/\d\d\/\d\d\/\d\d/)')
$c = $c.Replace('line.match(/\d\d\/\d\d\/\d\d/)', 'line.match(/\d\d\/\d\d\/\d\d/)')
Set-Content $p $c
