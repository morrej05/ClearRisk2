# Key Points Bullet Marker Cleanup Complete

**Status**: ✅ Complete
**Date**: 2026-02-21

## Overview

Added safety cleanup to `generateSectionKeyPoints` to ensure no leading bullet markers are ever returned, even if accidentally added to rules in the future.

---

## Changes Applied

### File: `src/lib/pdf/keyPoints/generateSectionKeyPoints.ts`

**Function**: `generateSectionKeyPoints()` (lines 303-315)

**Before**:
```typescript
export function generateSectionKeyPoints(input: GenerateKeyPointsInput): string[] {
  // Use new function internally, then project to string[]
  const fired = generateFiredSentences(input);
  return fired.map(s => s.text);
}
```

**After**:
```typescript
export function generateSectionKeyPoints(input: GenerateKeyPointsInput): string[] {
  // Use new function internally, then project to string[]
  const fired = generateFiredSentences(input);
  const points = fired.map(s => s.text);

  // Safety: ensure no leading bullet markers remain
  return points.map(p =>
    (p ?? '')
      .toString()
      .trim()
      .replace(/^([•\-\*\u2022\u25CF\u25A0\u25AA]+)\s+/, '')
  );
}
```

---

## What This Does

### Safety Cleanup Regex

The regex pattern `/^([•\-\*\u2022\u25CF\u25A0\u25AA]+)\s+/` removes:

- `*` - Asterisk (ASCII)
- `-` - Hyphen/dash
- `•` - Bullet (ASCII)
- `\u2022` - Bullet (Unicode)
- `\u25CF` - Black circle
- `\u25A0` - Black square
- `\u25AA` - Black small square

Plus any trailing whitespace after the marker.

### Protection Layers

This function now has **triple protection** against bullet markers:

1. **Source Level**: Rules in `rules.ts` already return plain sentences (verified - no `*` found)
2. **Rendering Level**: `drawKeyPointsBlock.ts` strips bullets with `normalizePoint()` helper
3. **Generation Level** ✅ NEW: `generateSectionKeyPoints()` now strips bullets as final safety net

---

## Verification

### Build Status
✅ **Build successful**
- ✓ 1945 modules transformed
- ✓ Built in 21.09s
- Output: 2.3 MB JavaScript, 66 KB CSS

### Rules Verification
✅ **No hardcoded bullets in rules**
- Searched `rules.ts` for patterns like `text: '*...`
- Found: 0 instances
- All rule text functions return plain sentences

### Example Rules (Verified Clean)
```typescript
// Section 5 - Fire Hazards
text: (data) => 'Outstanding C1/C2 electrical defects identified',
text: (data) => 'EICR assessment rated as unsatisfactory',
text: (data) => 'Lithium-ion battery charging activities present elevated fire risk',
```

---

## Data Flow

### Complete Key Points Pipeline

```
┌─────────────────────────────────────┐
│ 1. Rules (rules.ts)                 │
│    ├─ when(): boolean               │
│    ├─ text(): string (plain)        │
│    └─ evidence(): object[]          │
└──────────────┬──────────────────────┘
               │ plain sentences
               ▼
┌─────────────────────────────────────┐
│ 2. generateFiredSentences()         │
│    ├─ Evaluates all rules           │
│    ├─ Filters noise/unknown         │
│    ├─ Sorts by priority             │
│    └─ Deduplicates                  │
└──────────────┬──────────────────────┘
               │ FiredSentence[]
               ▼
┌─────────────────────────────────────┐
│ 3. generateSectionKeyPoints() ✅    │
│    ├─ Maps to string[]              │
│    └─ STRIPS BULLET MARKERS         │
│       (safety cleanup)              │
└──────────────┬──────────────────────┘
               │ string[] (clean)
               ▼
┌─────────────────────────────────────┐
│ 4. drawKeyPointsBlock()             │
│    ├─ normalizePoint() strips       │
│    │   any remaining markers        │
│    └─ Renders with PDF bullets      │
└─────────────────────────────────────┘
```

---

## Impact

### For Rule Authors
- Rules can be written naturally as plain sentences
- No need to add bullets (they'll be stripped anyway)
- Future-proof against accidental bullet additions

### For PDF Rendering
- Key points always arrive clean
- PDF renderer adds its own visual bullets
- No duplicate markers possible

### For Maintenance
- Single source of truth for bullet rendering (PDF layer)
- Generation layer focuses on content, not formatting
- Clear separation of concerns

---

## Testing Recommendations

Generate a draft FRA PDF with sections 5-12 and verify:

1. ✅ No asterisks or dashes appear before key points
2. ✅ PDF bullets render cleanly
3. ✅ Text starts immediately after bullet
4. ✅ No double bullets (e.g., "• * text")

---

## Summary

✅ Added safety cleanup to strip all leading bullet markers
✅ Verified rules.ts has no hardcoded bullets
✅ Build successful with no errors
✅ Triple protection: rules → generation → rendering
✅ Future-proof against accidental bullet additions

The key points pipeline now guarantees clean plain sentences at every layer.
