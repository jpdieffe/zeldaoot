from pathlib import Path
import zipfile, hashlib, json
root = Path(__file__).resolve().parent.parent
source = next(root.parent.glob('*Ocarina*.zip'))
with zipfile.ZipFile(source) as archive:
    candidates = [i for i in archive.infolist() if i.filename.lower().endswith(('.z64','.n64','.v64'))]
    if len(candidates) != 1: raise RuntimeError('Expected exactly one ROM')
    rom = bytearray(archive.read(candidates[0]))
if rom[:4] == bytes.fromhex('37804012'):
    rom[0::2],rom[1::2] = rom[1::2],rom[0::2]
elif rom[:4] == bytes.fromhex('40123780'):
    for i in range(0,len(rom),4): rom[i:i+4] = rom[i:i+4][::-1]
digest = hashlib.sha1(rom).hexdigest()
if digest != '41b3bdc48d98c48529219919015a1af22f5057c2': raise RuntimeError('Unexpected ROM SHA-1: '+digest)
(root / '.build/rom.z64').write_bytes(rom)
(root / 'site/game-manifest.json').write_text(json.dumps({'name':'Ocarina of Time (US 1.2)','romSha1':digest,'romBytes':len(rom)},indent=2)+'\n')
print(f'Validated US 1.2 ROM: {len(rom):,} bytes, SHA-1 {digest}')
