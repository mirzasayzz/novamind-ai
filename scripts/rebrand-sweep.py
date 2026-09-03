"""Protect @novamind scoped-package strings, run the full rebrand sweep, restore them."""
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__ + '/..'))
PKG = '@pocketpalai/react-native-speech'
GUARD = '@pocketpalai/react-native-speech'
SKIP_DIRS = {'.git', 'node_modules', 'Pods', 'build'}
SKIP_FILES = {'yarn.lock'}
# Files whose only novamind mention is the scoped package: content sweep
# would hit them, so they are placeholder-guarded like every other file.
TEXT_EXT = {
    '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.kt', '.java', '.swift',
    '.m', '.mm', '.h', '.cpp', '.cmake', '.txt', '.xml', '.gradle', '.plist',
    '.entitlements', '.storyboard', '.xcconfig', '.yml', '.yaml', '.rb',
    '.env', '', '.py', '.sh', '.pbxproj', '.xcscheme', '.xcworkspacedata',
    '.xcsettings', '.strings', '.xcprivacy',
}

REPLACEMENTS = [
    (re.compile(r'NOVAHUB'), 'NOVAHUB'),
    (re.compile(r'NovaHub'), 'NovaHub'),
    (re.compile(r'novahub'), 'novahub'),
    (re.compile(r'NovaMind'), 'NovaMind'),
    (re.compile(r'novamind'), 'novamind'),
    (re.compile(r'ai\.novamind'), 'ai.novamind'),
    (re.compile(r'novamind'), 'novamind'),
]

changed = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    for name in filenames:
        if name in SKIP_FILES or name.endswith('.lock'):
            continue
        path = os.path.join(dirpath, name)
        if os.path.islink(path) or os.path.getsize(path) > 4_000_000:
            continue
        ext = os.path.splitext(name)[1]
        if ext not in TEXT_EXT and name != '.env.example':
            continue
        try:
            with open(path, encoding='utf-8') as f:
                src = f.read()
        except (UnicodeDecodeError, PermissionError):
            continue
        if 'novamind' not in src.lower() and 'novahub' not in src.lower():
            continue
        out = src.replace(PKG, GUARD)
        for pattern, repl in REPLACEMENTS:
            out = pattern.sub(repl, out)
        out = out.replace(GUARD, PKG)
        if out != src:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(out)
            changed.append(os.path.relpath(path, ROOT))

print(f'content-swept {len(changed)} files')
