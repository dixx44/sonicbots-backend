import os
from pathlib import Path

def get_size(path):
    total = 0
    for root, dirs, files in os.walk(path, topdown=True):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total

root = Path('C:/')
items = []
for entry in root.iterdir():
    if entry.is_dir():
        items.append((entry, get_size(entry))) 
items.sort(key=lambda x: x[1], reverse=True)
for entry, size in items[:15]:
    print(entry, round(size/2**30, 2))

user_root = Path(r'C:/Users/AKAM')
if user_root.exists():
    print('---')
    items = []
    for entry in user_root.iterdir():
        if entry.is_dir():
            items.append((entry, get_size(entry)))
    items.sort(key=lambda x: x[1], reverse=True)
    for entry, size in items[:15]:
        print(entry, round(size/2**30, 2))
