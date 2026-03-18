from pathlib import Path 
p = Path('src/renderer/src/App.tsx') 
lines = p.read_text(encoding='utf-8').splitlines() 
p.write_text('\n'.join(lines[:76]) + '\n', encoding='utf-8') 
