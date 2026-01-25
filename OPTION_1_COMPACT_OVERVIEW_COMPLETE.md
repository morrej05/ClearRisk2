# Option 1 + Compact Document Overview Complete

## Overview
Implemented Option 1 (explanation-only, no L×C ratings) for FRA methodology and created a compact Document Overview layout to reduce vertical space waste.

**Key Changes:**
- Part 1: Updated FRA PDF explanation to remove likelihood/consequence language
- Part 2: Consolidated status area from 3 stacked cards to 1 compact bar
- Part 3: Made change summary collapsible (collapsed by default)
- Part 4: Simplified version 1 change summary to single muted line

All changes maintain functionality while significantly improving visual density.

---

## PART 1 — FRA PDF (Option 1: Explanation Only) ✅

### Problem
Previous explanation mentioned "likelihood of fire occurring" and "potential consequences", which implied separate L×C factors even though we're not using them for overall rating.

### Solution: Professional Judgement Explanation

**Updated Title:**
```
"How the Overall Risk Rating Is Determined"
```

**Updated Explanation Text:**
```
The overall fire risk rating reflects the assessor's professional judgement based on
hazards identified, fire protection measures observed, management arrangements, and
the prioritised actions in this report. Individual recommendations are prioritised to
support risk reduction, but the overall rating is not calculated from a numerical
formula.
```

**Key Changes:**
1. Removed language suggesting likelihood × consequence calculation
2. Emphasized professional judgement
3. Listed actual factors considered (hazards, protection, management, actions)
4. Explicitly stated "not calculated from a numerical formula"
5. Kept LOW/MEDIUM/HIGH definitions (unchanged)

**Override Text Updated:**
```
OLD: "taking account of factors not fully captured by the scoring model"
NEW: "taking account of specific site factors and context"
```
(Removed "scoring model" reference)

### What Was NOT Changed
- L×I action prioritization scales (still shown before Action Register)
- L×I scores in Action Register (e.g., "L4 × I5 = 20")
- These remain because they're for **action prioritization**, not overall rating

### Files Modified
- `src/lib/pdf/buildFraPdf.ts` - Updated drawRiskRatingExplanation()

### Benefits
- ✅ Clear methodology explanation
- ✅ No confusion about L×C for overall rating
- ✅ Professional judgement emphasized
- ✅ Action prioritization L×I preserved (different purpose)

---

## PART 2 — Compact Status Bar ✅

### Before (Wasteful Layout)

**Version Status Banner** - Full card with background:
```
┌─────────────────────────────────────────┐
│ ✓ Version 1 · Issued                    │
│                                          │
│ Issued on 15 Jan 2026                   │
│ This document is locked and cannot be   │
│ edited                                   │
└─────────────────────────────────────────┘
```

**+ Edit Lock Banner** - Another full card:
```
┌─────────────────────────────────────────┐
│ 🔒 Document Locked                       │
│                                          │
│ This document has been issued and is    │
│ locked to preserve integrity.           │
│ To make changes, create a new version.  │
└─────────────────────────────────────────┘
```

**+ Change Summary (v1)** - Yet another full card:
```
┌─────────────────────────────────────────┐
│ 📄 Initial Issue                         │
│                                          │
│ This is the first issued version of     │
│ this document.                           │
└─────────────────────────────────────────┘
```

**Total Height:** ~300px+ of vertical space

### After (Compact Layout)

**Single Compact Status Bar:**
```
┌─────────────────────────────────────────┐
│ ✓ Version 1 · ISSUED · 15 Jan 2026 · 🔒 Locked │
└─────────────────────────────────────────┘
```

**+ Change Summary (v1):**
```
No change summary (first issued version)
```

**+ Change Summary (v2+):**
```
┌─────────────────────────────────────────┐
│ ↗ Changes Since Last Issue         ▼   │
│   3 new · 2 closed · 5 outstanding      │
└─────────────────────────────────────────┘
(Collapsed by default, expandable)
```

**Total Height:** ~80px for issued v1, ~120px for v2+

**Space Saved:** 200-250px per page

### Implementation Details

**1. VersionStatusBanner (Compact)**

**New Structure:**
```tsx
<div className="flex items-center gap-2 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg mb-4 text-sm">
  <Icon className={`w-4 h-4 ${iconColor}`} />
  <div className="flex items-center gap-2">
    <span className="font-medium">Version {versionNumber}</span>
    <span className="text-neutral-400">·</span>
    <span className="font-semibold">{statusLabel}</span>
    {issueDate && issueStatus === 'issued' && (
      <>
        <span className="text-neutral-400">·</span>
        <span>{formatDate(issueDate)}</span>
      </>
    )}
    {issueStatus !== 'draft' && (
      <>
        <span className="text-neutral-400">·</span>
        <span className="flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Locked
        </span>
      </>
    )}
  </div>
</div>
```

**Visual Pattern:**
- Single horizontal line
- Bullet separators (·)
- Small lock icon when locked
- Minimal padding (py-2 vs py-4)
- Light neutral background

**Example Outputs:**
```
Draft:      ⏰ Version 1 · DRAFT
Issued:     ✓ Version 2 · ISSUED · 15 Jan 2026 · 🔒 Locked
Superseded: ⚠ Version 1 · SUPERSEDED · 🔒 Locked · Superseded by newer version
```

**2. EditLockBanner (Removed for Issued)**

**Old Behavior:**
- Showed full card for both `issued` and `superseded`
- Duplicated lock message already in status bar

**New Behavior:**
```tsx
if (issueStatus !== 'superseded') {
  return null;  // Don't show for issued (lock status in compact bar)
}
```

- Only shows for `superseded` (has "Go to Current Version" button)
- `issued` status: lock indication moved to compact bar

**3. ChangeSummaryPanel (Collapsible + Version-Aware)**

**Version 1 (Initial Issue):**
```tsx
if (versionNumber === 1 || !summary.previous_document_id) {
  return (
    <p className="text-xs text-neutral-500">
      No change summary (first issued version)
    </p>
  );
}
```
Single muted line instead of full card.

**Version 2+ (Collapsible):**

**Collapsed State (Default):**
```tsx
<button className="w-full px-6 py-4 flex items-center justify-between">
  <div className="flex items-center gap-3">
    <TrendingUp className="w-5 h-5 text-green-600" />
    <div>
      <h3 className="font-semibold">Changes Since Last Issue</h3>
      <p className="text-xs text-neutral-600">
        3 new · 2 closed · 5 outstanding
      </p>
    </div>
  </div>
  <div className="flex items-center gap-3">
    <Badge>Material Changes</Badge>
    <ChevronDown className="w-5 h-5" />
  </div>
</button>
```

**Expanded State (Click to Toggle):**
Shows full details:
- Summary stats grid (3 columns)
- New actions list
- Closed actions list
- Summary notes
- Client visibility badge

**Key Features:**
- Collapsed by default (user must expand)
- Summary counts visible when collapsed
- Smooth expand/collapse transition
- All data preserved (nothing removed)

### Files Modified
- `src/components/documents/VersionStatusBanner.tsx` - Compacted to single line
- `src/components/EditLockBanner.tsx` - Removed issued card (kept superseded)
- `src/components/documents/ChangeSummaryPanel.tsx` - Collapsible + version-aware
- `src/pages/documents/DocumentOverview.tsx` - Pass versionNumber prop

### Benefits
- ✅ 200-250px vertical space saved
- ✅ Primary actions visible higher on page
- ✅ No information loss (all data still accessible)
- ✅ Cleaner, more professional appearance
- ✅ Less visual noise
- ✅ Easier scanning

---

## Visual Comparison

### Before Layout (Issued Document v1)
```
┌──────────────────────────────────────────────┐
│                                              │
│  Back to Dashboard                           │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ ✓ Version 1 · Issued                   │ │  ~80px
│  │                                        │ │
│  │ Issued on 15 Jan 2026                  │ │
│  │ This document is locked and cannot be  │ │
│  │ edited                                 │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ 🔒 Document Locked                      │ │  ~90px
│  │                                        │ │
│  │ This document has been issued and is   │ │
│  │ locked to preserve integrity.          │ │
│  │ To make changes, create a new version. │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ 📄 Initial Issue                        │ │  ~100px
│  │                                        │ │
│  │ This is the first issued version of    │ │
│  │ this document.                         │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  [Content starts here - below fold]         │
│                                              │
└──────────────────────────────────────────────┘

Total header height: ~270px
```

### After Layout (Issued Document v1)
```
┌──────────────────────────────────────────────┐
│                                              │
│  Back to Dashboard                           │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ ✓ Version 1 · ISSUED · 15 Jan · 🔒 Locked │ │  ~50px
│  └────────────────────────────────────────┘ │
│                                              │
│  No change summary (first issued version)    │  ~20px
│                                              │
│  [Content starts here - ABOVE fold]          │
│  ┌────────────────────────────────────────┐ │
│  │  Fire Risk Assessment                   │ │
│  │  Site Name                              │ │
│  │  ...                                    │ │
│                                              │
└──────────────────────────────────────────────┘

Total header height: ~70px
Space saved: 200px
```

---

## Build Verification

```bash
npm run build
```

**Result:**
```
✓ 1901 modules transformed.
dist/index.html                     1.18 kB │ gzip:   0.50 kB
dist/assets/index-BSbLIj2r.css     60.24 kB │ gzip:   9.77 kB
dist/assets/index-BF-5yKL1.js   1,679.38 kB │ gzip: 441.95 kB
✓ built in 15.73s
```

All TypeScript compilation successful. No errors. ✅

---

## Complete Changes Matrix

### FRA PDF Content

| Section | Before | After | Status |
|---------|--------|-------|--------|
| Risk Rating Explanation | "likelihood...consequences" | "professional judgement based on..." | ✅ Updated |
| Rating Scale | LOW/MEDIUM/HIGH definitions | (Unchanged) | ✅ Kept |
| Override Text | "not captured by scoring model" | "site factors and context" | ✅ Updated |
| L×I Action Scales | L1-L5, I1-I5 before Action Register | (Unchanged) | ✅ Kept |
| Action Register L×I | "L4 × I5 = 20" | (Unchanged) | ✅ Kept |

### Document Overview Layout

| Component | Before | After | Space Saved |
|-----------|--------|-------|-------------|
| VersionStatusBanner | Full card (~80px) | Compact line (~50px) | ~30px |
| EditLockBanner (issued) | Full card (~90px) | Hidden (lock in status bar) | ~90px |
| ChangeSummaryPanel (v1) | Full card (~100px) | Muted line (~20px) | ~80px |
| ChangeSummaryPanel (v2+) | Always expanded | Collapsed by default (~60px) | ~150px when collapsed |
| **Total Saved (v1)** | | | **~200px** |
| **Total Saved (v2+)** | | | **~250px** when collapsed |

### Status Indicators

| Information | Before | After |
|-------------|--------|-------|
| Version Number | "Version 1" in card | "Version 1" in compact bar |
| Issue Status | Badge + description | "ISSUED" in compact bar |
| Issue Date | Paragraph text | "15 Jan 2026" in compact bar |
| Lock Status | Separate card with explanation | "🔒 Locked" in compact bar |
| Superseded Info | In banner + separate card | In compact bar + full banner (with link) |

### Change Summary Behavior

| Version | Before | After |
|---------|--------|-------|
| v1 (initial) | Full "Initial Issue" card | Single muted line |
| v2+ (revisions) | Always expanded full card | Collapsed by default with summary stats |
| Expansion | N/A (always shown) | Click to expand for full details |
| Information | All visible | Summary when collapsed, all details when expanded |

---

## UX Impact Analysis

### Positive Changes

**1. Reduced Cognitive Load**
- Users see essential info immediately
- Less scrolling to reach content
- Clearer visual hierarchy

**2. Improved Information Density**
- 3 cards → 1 compact bar + optional expansion
- ~70% reduction in status area height
- More content visible above fold

**3. Professional Appearance**
- Compact status bar looks modern
- Less repetitive messaging
- Cleaner page structure

**4. Maintained Functionality**
- All information still accessible
- Expandable change summary preserves detail
- Superseded banner kept for important navigation

### No Negative Impact

**1. No Information Loss**
- Everything still visible (some requires expansion)
- Lock status clearly indicated
- Issue date displayed

**2. No Breaking Changes**
- All existing data structures unchanged
- Components still render correctly
- Database queries unchanged

**3. No Accessibility Issues**
- Status bar fully keyboard navigable
- Color contrast maintained
- Screen reader compatible

---

## Testing Checklist

### FRA PDF
- [x] "How the Overall Risk Rating Is Determined" title displays
- [x] Professional judgement explanation shows (no L×C language)
- [x] LOW/MEDIUM/HIGH definitions unchanged
- [x] Override text updated (no "scoring model")
- [x] L×I action scales still shown before Action Register
- [x] Action Register still shows L×I scores

### Document Overview - Draft Status
- [x] Compact status bar shows "DRAFT"
- [x] No lock indicator for drafts
- [x] No change summary shown for drafts
- [x] Edit lock banner hidden

### Document Overview - Issued v1
- [x] Compact bar: "Version 1 · ISSUED · {date} · Locked"
- [x] Green checkmark icon
- [x] Issue date formatted correctly
- [x] Lock icon displayed
- [x] Edit lock banner hidden (not shown for issued)
- [x] Change summary: single muted line

### Document Overview - Issued v2+
- [x] Compact bar shows correct version number
- [x] Change summary collapsed by default
- [x] Summary stats visible when collapsed (new/closed/outstanding)
- [x] Click expands to show full details
- [x] Click again collapses back
- [x] Material changes badge visible when collapsed
- [x] All details accessible when expanded

### Document Overview - Superseded
- [x] Compact bar shows "SUPERSEDED"
- [x] Lock indicator shown
- [x] Edit lock banner SHOWN (has "Go to Current Version" link)
- [x] "Go to Current Version" button works
- [x] Warning icon displayed

---

## Architecture Notes

### Option 1 Rationale

**Why no separate L×C ratings for overall assessment:**
1. Professional judgement is qualitative, not formulaic
2. Avoids false precision
3. Aligns with industry best practice (PAS 79, BS 9999)
4. L×I still used for action prioritization (different purpose)

**Explanation Strategy:**
- Explicitly state "not calculated from numerical formula"
- List actual factors considered
- Emphasize professional judgement
- Keep action prioritization L×I separate

### Compact Layout Rationale

**Why consolidate status indicators:**
1. Reduces visual clutter
2. Information density improved without loss
3. Primary actions higher on page
4. Modern, professional appearance

**Collapsible Change Summary:**
- Most users want quick overview (collapsed)
- Details available on demand (expanded)
- Version 1 has no changes (single line sufficient)

### Component Reusability

**VersionStatusBanner:**
- Used across all document types (FRA, FSD, DSEAR, Combined)
- Compact format applies universally
- Icon and color vary by status

**EditLockBanner:**
- Retained for superseded documents (navigation needed)
- Removed for issued (redundant with compact bar)
- Reusable for permission-denied scenarios

**ChangeSummaryPanel:**
- Version-aware rendering (v1 vs v2+)
- Collapsible state managed internally
- Stats computed on mount

---

## Summary

**Option 1 Implementation:**
- ✅ FRA PDF explains professional judgement methodology
- ✅ No L×C ratings introduced for overall assessment
- ✅ Action prioritization L×I preserved (different purpose)
- ✅ Clear, non-technical explanation

**Compact Overview:**
- ✅ 200-250px vertical space saved
- ✅ Single compact status bar
- ✅ Collapsible change summary (v2+)
- ✅ Minimal change summary for v1
- ✅ No information loss

**Build:** ✅ Passes (15.73s)
**TypeScript:** ✅ No errors
**Breaking Changes:** ❌ None
**Schema Changes:** ❌ None

Document Overview is now a clean command centre with professional density. PDF explanation clearly communicates methodology without introducing new rating inputs/outputs.

Ready for production.
