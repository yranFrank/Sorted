from pathlib import Path 
p=Path('src/renderer/src/App.tsx') 
t=p.read_text(encoding='utf-8') 
t=t.replace('if (page != ''summary'') { return; }','if (page != ''summary'') { if (page != ''classify'') { return; } }') 
old='const incomeTotals = useMemo(function () { return categoryTotals(allTransactions.filter(function (item: any) { return item.debit_credit == ''credit''; }), workspace.categories.income); }, [allTransactions, workspace]);' 
new=old+'\n  const identifiedTransactions = useMemo(function () { return reviewTransactions.filter(function (item: any) { return item.status == ''reviewed''; }); }, [reviewTransactions]);\n  const pendingTransactions = useMemo(function () { return reviewTransactions.filter(function (item: any) { return item.status != ''reviewed''; }); }, [reviewTransactions]);' 
t=t.replace(old,new) 
p.write_text(t,encoding='utf-8') 
