"""Package source/evidence without node_modules, keys or runtime data."""
from pathlib import Path
import hashlib
import zipfile

root = Path(__file__).resolve().parents[1]
archive = root.parent / 'AlphaVault-MVP.zip'
excluded = {'node_modules', 'data', '.git', '__pycache__'}
files = []
for path in root.rglob('*'):
    rel = path.relative_to(root)
    if not path.is_file() or any(p in excluded for p in rel.parts):
        continue
    if path.name == '.DS_Store' or (path.name.startswith('.env') and path.name != '.env.example'):
        continue
    files.append(path)
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted(files):
        z.write(path, Path('alphavault') / path.relative_to(root))
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(f'{digest}  {archive.name}\n')
print(f'{archive.name}: {len(files)} files, {archive.stat().st_size:,} bytes')
