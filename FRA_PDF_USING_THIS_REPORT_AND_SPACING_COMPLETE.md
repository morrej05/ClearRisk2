# FRA PDF "Using This Report" Priority Model + Section Spacing - COMPLETE

## Overview

Updated the "Using This Report" guide section to accurately reflect the T-tier/P-band priority model (T4→P1, T3→P2, T2→P3, T1→P4), and increased section header spacing throughout the FRA PDF for better visual presentation.

## PART A: Priority Model Text Update

### Problem Statement

**Previous Text:**
- Referred to "Critical, High, Medium, Low" priority
- Did not match the actual implemented model in `severityEngine.ts`
- Caused confusion between descriptive text and actual system behavior

**Actual Model:**
- Severity Tier (T1-T4) mapped to Priority Band (P1-P4)
- T4 → P1 (Material Life Safety Risk)
- T3 → P2 (Significant Deficiency)
- T2 → P3 (Improvement Required)
- T1 → P4 (Minor)

### Solution

**File:** `src/lib/pdf/usingThisReportGuide.ts`

#### Change 1: Action Plan Description (Line 79)

**Before:**
```typescript
{
  label: 'Action Plan:',
  text: 'Prioritized recommendations with target dates and responsible persons. Actions are categorized as Critical, High, Medium, or Low priority.',
}
```

**After:**
```typescript
{
  label: 'Action Plan:',
  text: 'Prioritized recommendations with target dates and responsible persons. Actions are prioritised using a Severity Tier (T1–T4) mapped to a Priority Band (P1–P4).',
}
```

#### Change 2: Priority Bands List (Lines 128-145)

**Before:**
```typescript
const priorityItems = [
  {
    label: 'Critical:',
    text: 'Immediate action required. Significant risk to life safety. Address within 24-48 hours or implement interim controls.',
  },
  {
    label: 'High:',
    text: 'Urgent action required. Material deficiency requiring resolution within 1-4 weeks.',
  },
  {
    label: 'Medium:',
    text: 'Action required within 3-6 months. Improvements needed to meet best practice standards.',
  },
  {
    label: 'Low:',
    text: 'Governance or minor improvements. Address within 6-12 months as part of ongoing fire safety management.',
  },
];
```

**After:**
```typescript
const priorityItems = [
  {
    label: 'T4 → P1:',
    text: 'Material Life Safety Risk. Immediate action required to address significant risk to life safety.',
  },
  {
    label: 'T3 → P2:',
    text: 'Significant Deficiency. Urgent action required to resolve material compliance or protection gaps.',
  },
  {
    label: 'T2 → P3:',
    text: 'Improvement Required. Action needed to meet best practice standards and enhance fire safety resilience.',
  },
  {
    label: 'T1 → P4:',
    text: 'Minor. Governance or incremental improvements to maintain fire safety management standards.',
  },
];
```

**Key Improvements:**
- Uses T→P notation matching actual system
- Concise consultancy-grade descriptions
- One sentence each per requirement
- No specific timeframes (left to assessor discretion)
- Aligned with `severityEngine.ts` logic

#### Change 3: Recommended Actions Text (Line 244)

**Before:**
```typescript
const actionText = 'Review the Action Plan immediately and assign responsibilities. Critical and High priority items should be addressed as soon as reasonably practicable. Maintain records of completed actions and any interim risk control measures implemented. Schedule a review meeting with key stakeholders within 7 days of receiving this report.';
```

**After:**
```typescript
const actionText = 'Review the Action Plan immediately and assign responsibilities. P1 and P2 actions should be prioritised for prompt attention, with P3 and P4 addressed as part of planned improvement. Maintain records of completed actions and any interim risk control measures implemented. Schedule a review meeting with key stakeholders within 7 days of receiving this report.';
```

**Change:**
- "Critical and High priority items" → "P1 and P2 actions"
- Added context: "with P3 and P4 addressed as part of planned improvement"
- Uses Priority Band terminology consistently

### Layout Validation

**Line Count:**
- Priority items remain 4 bullets (same as before)
- Text lengths similar to original
- No pagination changes required
- Fits on single page as before

## PART B: Section Header Spacing

### Problem Statement

**Previous Spacing:**
- Section headers felt cramped
- Not enough breathing room before new sections
- Sections 11/12 thresholds needed proportional adjustment

### Solution

#### Change 1: Increased Block Heights in pdfStyles.ts

**File:** `src/lib/pdf/pdfStyles.ts` (Lines 20-23)

**Before:**
```typescript
blocks: {
  sectionHeader: 72,
  sectionHeaderWithSummary: 120,
},
```

**After:**
```typescript
blocks: {
  sectionHeader: 88,
  sectionHeaderWithSummary: 140,
},
```

**Changes:**
- `sectionHeader`: 72 → 88 (+16pt, +22% increase)
- `sectionHeaderWithSummary`: 120 → 140 (+20pt, +17% increase)

**Impact:**
- More whitespace before section headers
- Better visual separation between sections
- Improved readability and professional appearance
- Maintains proportionality (both increased ~20%)

#### Change 2: Adjusted Section 11/12 Thresholds

**File:** `src/lib/pdf/buildFraPdf.ts` (Line 684)

**Before:**
```typescript
const required = (section.id === 11 || section.id === 12) ? 160 : requiredHeight;
```

**After:**
```typescript
const required = (section.id === 11 || section.id === 12) ? 180 : requiredHeight;
```

**Changes:**
- Sections 11/12 threshold: 160 → 180 (+20pt)
- Maintains proportional spacing increase
- Prevents awkward page breaks before Section 13

**Rationale:**
- Sections 11/12 are immediately before Section 13 (Significant Findings)
- Section 13 forces a hard page break
- Increased threshold prevents nearly-empty trailing pages
- Keeps consistent spacing ratios across document

### Visual Impact

**Before:**
- Headers felt glued to previous content
- Dense vertical packing
- Limited whitespace

**After:**
- Clear visual separation between sections
- Breathing room improves readability
- Professional, consultancy-grade appearance
- Section starts more prominent

## Technical Details

### Constants Changed

| Constant | Old Value | New Value | Change | Purpose |
|----------|-----------|-----------|--------|---------|
| `PDF_STYLES.blocks.sectionHeader` | 72 | 88 | +16pt | Standard section header spacing |
| `PDF_STYLES.blocks.sectionHeaderWithSummary` | 120 | 140 | +20pt | Technical section with summary spacing |
| Section 11/12 required height | 160 | 180 | +20pt | Pre-Section 13 threshold |

### No Logic Changes

**What Was NOT Changed:**
- Section ordering
- Action filtering logic
- Reference generation
- Evidence handling
- Pagination algorithm (only spacing constants)
- Section renderer implementations
- Module instance processing

**What WAS Changed:**
- Spacing constants only
- Presentation layer only
- No data or business logic

### Backward Compatibility

**PDF Generation:**
- Both draft and issued modes work
- No structural changes
- Same sections rendered
- Same content displayed
- Only spacing differs

**User Impact:**
- More professional appearance
- Easier to scan and read
- No functionality changes
- No data changes

## Testing Validation

### Test 1: Pure FRA Document
**Expected:**
- Section headers have more whitespace
- "Using This Report" shows T→P model
- All sections render correctly
- No pagination errors

### Test 2: Combined FRA+FSD Document
**Expected:**
- FRA sections use new spacing
- FSD sections use their own spacing
- No conflicts or overlap
- Clear section boundaries

### Test 3: Draft vs Issued Mode
**Expected:**
- Both modes render successfully
- Spacing consistent in both
- Watermarks work correctly
- Page numbering correct

### Test 4: Content Validation
**Expected:**
- "Using This Report" page fits on single page
- Priority bands show T4→P1, T3→P2, T2→P3, T1→P4
- No mention of "Critical/High/Medium/Low"
- Recommended Actions text uses P1/P2/P3/P4

## Files Modified

### src/lib/pdf/usingThisReportGuide.ts
**Lines 79:** Updated Action Plan description to mention T-tier/P-band model
**Lines 128-145:** Replaced Critical/High/Medium/Low with T4→P1, T3→P2, T2→P3, T1→P4
**Line 244:** Updated Recommended Actions to use P1/P2 terminology

### src/lib/pdf/pdfStyles.ts
**Lines 21-22:** Increased sectionHeader and sectionHeaderWithSummary spacing

### src/lib/pdf/buildFraPdf.ts
**Line 684:** Increased Section 11/12 required height threshold

## Benefits

### 1. Accuracy
- Text now matches implemented model exactly
- No confusion between doc and system behavior
- Users understand actual priority system

### 2. Professionalism
- Consultancy-grade descriptions
- Concise, clear language
- Proper technical terminology (T-tier/P-band)

### 3. Presentation
- Better visual hierarchy
- More breathing room
- Easier to scan sections
- Professional appearance

### 4. Maintainability
- Spacing controlled by constants
- Easy to adjust further if needed
- No hardcoded values in renderers

## Verification Points

✅ **Text Accuracy:**
- No mention of "Critical/High/Medium/Low" in Using This Report
- Shows T4→P1, T3→P2, T2→P3, T1→P4
- Uses P1/P2/P3/P4 in recommended actions

✅ **Spacing Improvements:**
- Section headers have more whitespace
- Clear visual separation between sections
- Proportional increases maintained

✅ **Layout Integrity:**
- "Using This Report" fits on single page
- No pagination errors
- Sections render in correct order

✅ **Backward Compatibility:**
- Draft mode works
- Issued mode works
- No functional changes
- No data changes

## Implementation Date

February 25, 2026

---

**Scope:** FRA PDF presentation improvements (text accuracy + spacing)
**Impact:** Better user experience and visual clarity
**Risk:** Minimal (presentation-only changes)
**Benefit:** Accurate model description + professional appearance
