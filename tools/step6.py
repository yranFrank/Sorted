from pathlib import Path 
p=Path('src/renderer/src/App.tsx') 
t=p.read_text(encoding='utf-8') 
t=t.replace('if (page != ''summary'') { return; }','if (page != ''summary'') { if (page != ''classify'') { return; } }') 
t=t.replace('const tabs = [''import'', ''review'', ''summary'', ''export''];','const tabs = [''import'', ''review'', ''classify'', ''summary'', ''export''];') 
t=t.replace('setPage(''summary''); } }, ''Continue to Classification''','setPage(''classify''); } }, ''Continue to Classification''') 
t=t.replace('if (page == ''summary'') { body = summaryView(); } if (page == ''export'') { body = exportView(); }','if (page == ''classify'') { body = classifyView(); } if (page == ''summary'') { body = summaryView(); } if (page == ''export'') { body = exportView(); }') 
key='const incomeTotals = useMemo(function () { return categoryTotals(allTransactions.filter(function (item: any) { return item.debit_credit == ''credit''; }), workspace.categories.income); }, [allTransactions, workspace]);' 
add='const incomeTotals = useMemo(function () { return categoryTotals(allTransactions.filter(function (item: any) { return item.debit_credit == ''credit''; }), workspace.categories.income); }, [allTransactions, workspace]);\n  const identifiedTransactions = useMemo(function () { return reviewTransactions.filter(function (item: any) { return item.status == ''reviewed''; }); }, [reviewTransactions]);\n  const pendingTransactions = useMemo(function () { return reviewTransactions.filter(function (item: any) { return item.status != ''reviewed''; }); }, [reviewTransactions]);' 
t=t.replace(key,add) 
p.write_text(t,encoding='utf-8') 
