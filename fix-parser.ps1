$p = 'src\main\parser.ts'
$c = Get-Content $p -Raw
$bad1 = @'
function inferCategory(description: string, direction: string) {
  const lower = description.toLowerCase();
function inferCategory(description: string, direction: string) {
  const lower = description.toLowerCase();
'@
$good1 = @'
function inferCategory(description: string, direction: string) {
  const lower = description.toLowerCase();
'@
$bad2 = @'
for (const line of lines) {
  for (const line of lines) {
'@
$good2 = @'
for (const line of lines) {
'@
$c = $c.Replace($bad1, $good1)
$c = $c.Replace($bad2, $good2)
Set-Content $p $c
