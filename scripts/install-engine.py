from pathlib import Path
import sys,zipfile,json,hashlib
root=Path(__file__).resolve().parent.parent
source=root/'.build/compiled';source.mkdir(exist_ok=True)
with zipfile.ZipFile(sys.argv[1]) as archive:
    for name in ['soh.js','soh.wasm','soh.data','soh.o2r','upstream.html','build-commit.txt','library-notices.txt']:
        matches=[i for i in archive.namelist() if Path(i).name==name]
        if len(matches)!=1: raise RuntimeError('Missing/ambiguous artifact '+name)
        (source/name).write_bytes(archive.read(matches[0]))
engine=root/'site/engine';engine.mkdir(exist_ok=True)
js=(source/'soh.js').read_text(encoding='utf-8')
for export in ['_together_state','_together_restart','_together_meet','_together_debug']:
    if export not in js: raise RuntimeError('Artifact does not contain the custom co-op bridge: '+export)
# Extraction has already run against the supplied ROM. XML and extractor-only
# assets are not used during gameplay; omit their 35 MB preload package.
start=js.index('loadPackage({')+len('loadPackage(')
metadata,length=json.JSONDecoder().raw_decode(js[start:])
metadata['files']=[];metadata['remote_package_size']=1
js=js[:start]+json.dumps(metadata,separators=(',',':'))+js[start+length:]
(engine/'soh.js').write_text(js,encoding='utf-8',newline='\n')
(engine/'soh.data').write_bytes(b'\0')
for name in ['soh.wasm','soh.o2r']:(engine/name).write_bytes((source/name).read_bytes())
(root/'site/ENGINE_NOTICES.txt').write_bytes((source/'library-notices.txt').read_bytes())
manifest={'source':'https://github.com/zalo/Shipwright','sourceCommit':'f81ff64afdd8e0489237bd03c6b026582f6dc70d','projectBuildCommit':(source/'build-commit.txt').read_text().strip(),'emscripten':'3.1.64','files':{}}
for name in ['soh.js','soh.wasm','soh.data','soh.o2r']:
    data=(engine/name).read_bytes();manifest['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
(root/'site/engine-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
print('Installed native co-op engine:',manifest['projectBuildCommit'])
