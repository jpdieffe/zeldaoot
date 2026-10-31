from pathlib import Path
import sys
root = Path(__file__).resolve().parent.parent
source = root / '.build/shipwright/soh/soh/web/shell.html'
html = source.read_text(encoding='utf-8')
html = html.replace('width=device-width, initial-scale=1.0','width=device-width, initial-scale=1.0, viewport-fit=cover')
html = html.replace('<title>Ship of Harkinian - Web</title>','<title>Ocarina of Time Together · Play</title>')
html = html.replace('</head>','<link rel="icon" href="./icon.svg"><link rel="stylesheet" href="./play.css"><script src="./vendor/peerjs.min.js"></script></head>')
html = html.replace("var OTR_DB_NAME = 'soh_otr_files';", "var OTR_DB_NAME = 'zeldaoot-together-assets-v1';")
html = html.replace("xhr.open('GET', 'soh.o2r', true);", "xhr.open('GET', './engine/soh.o2r', true);")
html = html.replace('{{{ SCRIPT }}}','<script type="module" src="./play.js"></script>')
if '{{{' in html: raise RuntimeError('Unreplaced shell template')
(root / 'site/play.html').write_text(html,encoding='utf-8',newline='\n')
