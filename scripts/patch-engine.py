from pathlib import Path
import sys, shutil
source = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parent.parent
# On a second configure, find_package can discover exported build packages
# instead of the original static targets. Keep the web build using its pinned
# source dependencies, with identical compiler definitions on every run.
dependency_cmake = source / 'libultraship/src/CMakeLists.txt'
dependencies = dependency_cmake.read_text()
for package in ['spdlog', 'tinyxml2']:
    find = f'find_package({package} QUIET)'
    if dependencies.count(find) != 1:
        raise RuntimeError('Unexpected pinned dependency configuration: '+package)
    dependencies = dependencies.replace(find, f'set({package}_FOUND FALSE)')
dependency_cmake.write_text(dependencies)
bridge = root / 'native/together.cpp'
if bridge.exists():
    target = source / 'soh/soh/web/together.cpp'
    shutil.copyfile(bridge, target)
    cmake = source / 'soh/CMakeLists.txt'
    text = cmake.read_text()
    text += '\nif(BUILD_FOR_WEB)\n target_sources(soh PRIVATE soh/web/together.cpp)\nendif()\n'
    cmake.write_text(text)
print('Engine source prepared.')
