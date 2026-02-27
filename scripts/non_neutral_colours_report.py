#!/usr/bin/env python3
"""
Non-Neutral Colour Scanner
Scans src/** for Tailwind color utilities that are NOT neutral/gray/slate.
Outputs summary, by-file, by-class, and occurrences reports.
"""

import os
import re
import subprocess
from collections import defaultdict, Counter
from datetime import datetime, timezone
from pathlib import Path

# Tailwind color utilities to scan for
COLOR_UTILITIES = [
    'bg', 'text', 'ring', 'fill', 'stroke', 'placeholder',
    'accent', 'caret', 'decoration', 'outline', 'from', 'via',
    'to', 'shadow', 'divide', 'border'
]

# Neutral families (allowed)
NEUTRAL_FAMILIES = ['slate', 'gray', 'neutral', 'ui', 'brand', 'risk']

# Non-color values (allowed)
ALLOWED_VALUES = ['transparent', 'current', 'inherit', 'white', 'black']

def get_git_commit():
    """Get current git commit hash (short form)."""
    try:
        result = subprocess.run(
            ['git', 'rev-parse', '--short', 'HEAD'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return 'unknown'

def scan_file(filepath):
    """Scan a single file for non-neutral color classes."""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception:
        return []

    matches = []

    # Build pattern: (bg|text|ring...)-(\w+)-(50|100|200|...)
    utilities_pattern = '|'.join(COLOR_UTILITIES)
    pattern = rf'\b(?:{utilities_pattern})-(\w+)-(\d{{2,3}})\b'

    for match in re.finditer(pattern, content):
        utility = match.group(0).split('-')[0]
        family = match.group(1)
        shade = match.group(2)

        # Skip neutral families
        if family.lower() in NEUTRAL_FAMILIES:
            continue

        # Skip allowed values
        if family.lower() in ALLOWED_VALUES:
            continue

        full_class = match.group(0)
        matches.append({
            'file': str(filepath),
            'class': full_class,
            'utility': utility,
            'family': family,
            'shade': shade
        })

    return matches

def scan_directory(base_path):
    """Recursively scan directory for TypeScript/React files."""
    all_matches = []

    src_path = Path(base_path) / 'src'
    if not src_path.exists():
        print(f"Warning: {src_path} does not exist")
        return all_matches

    for filepath in src_path.rglob('*'):
        if filepath.suffix in ['.ts', '.tsx', '.js', '.jsx']:
            matches = scan_file(filepath)
            all_matches.extend(matches)

    return all_matches

def generate_reports(matches, output_dir):
    """Generate all report outputs."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Summary
    summary_path = output_path / 'non-neutral-colours.summary.txt'
    by_file_path = output_path / 'non-neutral-colours.by-file.csv'
    by_class_path = output_path / 'non-neutral-colours.by-class.csv'
    occurrences_path = output_path / 'non-neutral-colours.occurrences.csv'

    # Count by file
    by_file = defaultdict(int)
    for m in matches:
        by_file[m['file']] += 1

    # Count by class
    by_class = Counter(m['class'] for m in matches)

    # Count by family
    by_family = Counter(m['family'] for m in matches)

    # Generate summary
    with open(summary_path, 'w', encoding='utf-8') as f:
        # Metadata header
        generated_at = datetime.now(timezone.utc).isoformat()
        git_commit = get_git_commit()
        f.write(f"Generated at: {generated_at}\n")
        f.write(f"Git commit: {git_commit}\n\n")

        f.write("=== NON-NEUTRAL COLOUR USAGE SUMMARY ===\n\n")
        f.write(f"Total non-neutral color matches: {len(matches)}\n")
        f.write(f"Files with non-neutral colors: {len(by_file)}\n")
        f.write(f"Unique non-neutral classes: {len(by_class)}\n\n")

        f.write("Top 20 non-neutral classes:\n")
        for cls, count in by_class.most_common(20):
            f.write(f"  {cls}: {count}\n")

        f.write("\nBy color family:\n")
        for family, count in by_family.most_common():
            f.write(f"  {family}: {count}\n")

        f.write("\nTop 20 files with most non-neutral colors:\n")
        for filepath, count in sorted(by_file.items(), key=lambda x: -x[1])[:20]:
            rel_path = filepath.replace(str(Path.cwd()), '').lstrip('/')
            f.write(f"  {count:4d}  {rel_path}\n")

    # Generate by-file CSV
    with open(by_file_path, 'w', encoding='utf-8') as f:
        f.write("file,count\n")
        for filepath, count in sorted(by_file.items(), key=lambda x: -x[1]):
            rel_path = filepath.replace(str(Path.cwd()), '').lstrip('/')
            f.write(f'"{rel_path}",{count}\n')

    # Generate by-class CSV
    with open(by_class_path, 'w', encoding='utf-8') as f:
        f.write("class,count\n")
        for cls, count in by_class.most_common():
            f.write(f'"{cls}",{count}\n')

    # Generate occurrences CSV
    with open(occurrences_path, 'w', encoding='utf-8') as f:
        f.write("file,class,utility,family,shade\n")
        for m in sorted(matches, key=lambda x: (x['file'], x['class'])):
            rel_path = m['file'].replace(str(Path.cwd()), '').lstrip('/')
            f.write(f'"{rel_path}","{m["class"]}","{m["utility"]}","{m["family"]}","{m["shade"]}"\n')

    return summary_path, by_file_path, by_class_path, occurrences_path

def main():
    """Main entry point."""
    base_path = Path.cwd()

    print("Scanning src/** for non-neutral color utilities...")
    matches = scan_directory(base_path)

    print(f"Found {len(matches)} non-neutral color matches\n")

    output_dir = base_path / 'docs'
    print(f"Generating reports in {output_dir}...")
    summary_path, by_file_path, by_class_path, occurrences_path = generate_reports(matches, output_dir)

    print(f"\nGenerated reports:")
    print(f"  - {summary_path}")
    print(f"  - {by_file_path}")
    print(f"  - {by_class_path}")
    print(f"  - {occurrences_path}")

    print(f"\nFirst 30 lines of summary:\n")
    with open(summary_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()[:30]
        for line in lines:
            print(line, end='')

if __name__ == '__main__':
    main()
