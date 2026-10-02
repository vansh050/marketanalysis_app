"""Repair Live Activity file references without replacing a tenant's native shell."""
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
project = root / 'ios/AlphaQuark.xcodeproj/project.pbxproj'
text = project.read_text()
for name in ('TradeActivityAttributes.swift', 'TradeLiveActivityModule.swift', 'TradeLiveActivityBridge.m'):
    assert (root / 'ios/AlphaQuark' / name).is_file(), name
    text = re.sub(r'path = "?' + re.escape(name) + r'"?;', f'path = "AlphaQuark/{name}";', text)

# The widget and test target must not share one group-relative Info.plist.
group = re.search(r'\t\t[A-F0-9]+ /\* TradeLiveActivity \*/ = \{\n\s*isa = PBXGroup;.*?\n\t\t\};', text, re.S)
assert group, 'Missing widget group'
old_ref = '00E356F11AD99517003FC87E /* Info.plist */'
new_id = 'F314A53BFA204A16BC178233'
if old_ref in group.group():
    text = text[:group.start()] + group.group().replace(old_ref, f'{new_id} /* Info.plist */') + text[group.end():]
    reference = f'\t\t{new_id} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; }};\n'
    text = text.replace('/* End PBXFileReference section */', reference + '/* End PBXFileReference section */')
# Embed the widget before scripts that read the app plist. Otherwise Firebase's
# configuration script, plist processing and extension embedding form a cycle.
phases = re.search(r'(13B07F861A680F5B00A75B9A /\* AlphaQuark \*/ = \{.*?buildPhases = \(\n)(.*?)(\n\s*\);)', text, re.S)
assert phases, 'Missing app build phases'
lines = phases.group(2).splitlines()
embed = [line for line in lines if '/* Copy Files */' in line]
assert len(embed) == 1, 'Expected one widget embed phase'
lines.remove(embed[0])
position = next(i for i, line in enumerate(lines) if '/* Bundle React Native code and images */' in line)
lines.insert(position, embed[0])
text = text[:phases.start(2)] + '\n'.join(lines) + text[phases.end(2):]

project.write_text(text)
print('Repaired Live Activity source paths and widget plist reference.')
