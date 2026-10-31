from pathlib import Path
import json,hashlib,shutil,sys
root=Path(__file__).resolve().parent.parent
archive=(root/'.build/oot.o2r').read_bytes()
assets=root/'site/assets';assets.mkdir(exist_ok=True)
(assets/'oot.o2r').write_bytes(archive)
manifest=json.loads((root/'site/game-manifest.json').read_text())
manifest['archive']={'bytes':len(archive),'sha256':hashlib.sha256(archive).hexdigest(),'parts':['assets/oot.o2r']}
(root/'site/game-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
print(f'Prepared game archive: {len(archive):,} bytes')
