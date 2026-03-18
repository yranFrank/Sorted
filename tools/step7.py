from pathlib import Path 
p = Path('src/renderer/src/App.tsx') 
lines = p.read_text(encoding='utf-8').splitlines() 
out = [] 
for line in lines: 
  if \"if (page != 'summary') { return; }\" in line: line = line.replace(\"if (page != 'summary') { return; }\", \"if (page != 'summary') { if (page != 'classify') { return; } }\") 
  if \"const tabs = ['import', 'review', 'summary', 'export'];\" in line: line = line.replace(\"const tabs = ['import', 'review', 'summary', 'export'];\", \"const tabs = ['import', 'review', 'classify', 'summary', 'export'];\") 
  if \"setPage('summary');\" in line and \"Continue to Classification\" in line: line = line.replace(\"setPage('summary');\", \"setPage('classify');\") 
  if \"if (page == 'summary') { body = summaryView(); } if (page == 'export') { body = exportView(); }\" in line: line = line.replace(\"if (page == 'summary') { body = summaryView(); } if (page == 'export') { body = exportView(); }\", \"if (page == 'classify') { body = classifyView(); } if (page == 'summary') { body = summaryView(); } if (page == 'export') { body = exportView(); }\") 
  out.append(line) 
  if \"const incomeTotals = useMemo(\" in line: 
    out.append(\"  const identifiedTransactions = useMemo(function () { return reviewTransactions.filter(function (item: any) { return item.status == 'reviewed'; }); }, [reviewTransactions]);\") 
    out.append(\"  const pendingTransactions = useMemo(function () { return reviewTransactions.filter(function (item: any) { return item.status != 'reviewed'; }); }, [reviewTransactions]);\") 
p.write_text('\n'.join(out) + '\n', encoding='utf-8') 
