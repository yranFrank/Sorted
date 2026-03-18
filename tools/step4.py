from pathlib import Path 
p=Path('src/renderer/src/styles.css') 
t=p.read_text(encoding='utf-8') 
t=t.replace('.review-grid, .summary-grid, .action-grid { grid-template-columns: 1fr; }','.review-grid, .summary-grid, .action-grid, .classification-grid, .classification-footer { grid-template-columns: 1fr; }') 
p.write_text(t,encoding='utf-8') 
