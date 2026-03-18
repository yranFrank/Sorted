from pathlib import Path 
p=Path('src/renderer/src/App.tsx') 
t=p.read_text(encoding='utf-8') 
t=t.replace('const tabs = [''import'', ''review'', ''summary'', ''export''];','const tabs = [''import'', ''review'', ''classify'', ''summary'', ''export''];') 
t=t.replace('''Continue to Summary''','''Continue to Classification''',1) 
t=t.replace('setPage(''summary'');','setPage(''classify'');',1) 
t=t.replace('if (page == ''summary'') { body = summaryView(); } if (page == ''export'') { body = exportView(); }','if (page == ''classify'') { body = classifyView(); } if (page == ''summary'') { body = summaryView(); } if (page == ''export'') { body = exportView(); }') 
p.write_text(t,encoding='utf-8') 
