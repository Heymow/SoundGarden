
import os
print("Starting script...")

file_path = r"c:\Projets\SoundGarden\collabwarz\collabwarz.py"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Ranges to delete (1-indexed, inclusive)
ranges = [
    (4117, 4236),
    (632, 720),
    (463, 522)
]

# Sort ranges descending by start line to avoid index shifting
ranges.sort(key=lambda x: x[0], reverse=True)

for start, end in ranges:
    # Convert to 0-indexed
    # start line L means index L-1
    # end line L means we want to exclude index L (so slice up to L)
    # But we want to delete lines[start-1 : end]
    # e.g. delete line 1 to 1: lines[0:1]
    idx_start = start - 1
    idx_end = end
    print(f"Deleting lines {start} to {end} (indices {idx_start}:{idx_end})")
    del lines[idx_start:idx_end]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Done.")
