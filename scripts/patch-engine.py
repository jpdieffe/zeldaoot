from pathlib import Path
import sys, shutil
source = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parent.parent
bridge = root / 'native/together.cpp'
if bridge.exists():
    target = source / 'soh/soh/web/together.cpp'
    shutil.copyfile(bridge, target)
    cmake = source / 'soh/CMakeLists.txt'
    text = cmake.read_text()
    text += '\nif(BUILD_FOR_WEB)\n target_sources(soh PRIVATE soh/web/together.cpp)\nendif()\n'
    cmake.write_text(text)
print('Engine source prepared.')
