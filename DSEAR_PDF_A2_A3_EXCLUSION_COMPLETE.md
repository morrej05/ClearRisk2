# DSEAR-Only PDF: Exclude A2/A3 Modules - Complete

## Summary
Fixed DSEAR-only PDF builder to exclude A2 (Building Profile) and A3 (Occupancy & Persons at Risk) modules from rendering. These modules are only relevant for Fire Risk Assessments, not standalone Explosive Atmospheres assessments.

## Problem Statement

**Issue:** DSEAR-only reports were rendering FRA-specific modules:
- ❌ A2 - Building Profile
- ❌ A3 - Occupancy & Persons at Risk

**Root Cause:** The PDF builder was iterating over ALL `moduleInstances` without filtering for DSEAR context. This caused FRA governance modules (A2, A3) to appear in DSEAR reports.

**Why This Is Wrong:**
- A2/A3 are Fire Risk Assessment concepts
- DSEAR assessments focus on explosive atmospheres, not building construction or fire escape
- Including these creates confusion and unprofessional output
- Clients expect DSEAR reports to contain only DSEAR-relevant information

## Solution Implemented

### Code Change

**File:** `src/lib/pdf/buildDsearPdf.ts`

**Location:** Line 237-245 (before module sorting)

**Before:**
```typescript
let yPosition: number;

// Sort modules once for consistency across Contents and module sections
const sortedModules = sortModules(moduleInstances);
```

**After:**
```typescript
let yPosition: number;

// Filter modules for DSEAR-only context: exclude A2, A3, and other non-DSEAR modules
// Keep A1_DOC_CONTROL for governance, keep all DSEAR_* modules
const filteredModules = moduleInstances.filter(m =>
  m.module_key.startsWith('DSEAR_') ||
  m.module_key === 'A1_DOC_CONTROL'
);

// Sort modules once for consistency across Contents and module sections
const sortedModules = sortModules(filteredModules);
```

### Filter Logic

**Included Modules:**
- ✅ `DSEAR_*` - All DSEAR modules (1-11)
  - `DSEAR_1_DANGEROUS_SUBSTANCES`
  - `DSEAR_2_PROCESS_RELEASES`
  - `DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION`
  - `DSEAR_4_IGNITION_SOURCES`
  - `DSEAR_5_EXPLOSION_PROTECTION`
  - `DSEAR_6_RISK_ASSESSMENT`
  - `DSEAR_10_HIERARCHY_OF_CONTROL`
  - `DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE`
- ✅ `A1_DOC_CONTROL` - Document governance (optional, if present)

**Excluded Modules:**
- ❌ `A2_BUILDING_PROFILE` - FRA-specific
- ❌ `A3_PERSONS_AT_RISK` - FRA-specific
- ❌ `A4_MANAGEMENT_CONTROLS` - FRA-specific (if it exists)
- ❌ `A5_EMERGENCY_ARRANGEMENTS` - FRA-specific (if it exists)
- ❌ `A7_REVIEW_ASSURANCE` - FRA-specific (if it exists)
- ❌ `FRA_*` - All FRA modules (if accidentally included)

### Why A1 Is Kept

**A1_DOC_CONTROL** contains essential governance information:
- Document version and issue date
- Assessor details
- Client/site information
- Scope and limitations
- Standards applied

This is relevant to ALL assessment types, not just FRA. It's kept optional - if present in the document's module instances, it will render; if absent, it won't.

## Impact on PDF Structure

### Before Fix (DSEAR-only report with A2/A3)

```
Contents

Executive Summary                            3
1. Explosion Criticality Assessment          4
2. Purpose and Introduction                  5
3. Hazardous Area Classification...          6
4. Zone Definitions                          7
5. Scope                                     8
6. Limitations and Assumptions               9
7. A2 - Building Profile                     10  ← SHOULD NOT BE HERE
8. A3 - Occupancy & Persons at Risk          11  ← SHOULD NOT BE HERE
9. DSEAR-1 - Dangerous Substances            12
10. DSEAR-2 - Process & Releases             13
...
```

### After Fix (DSEAR-only report, clean)

```
Contents

Executive Summary                            3
1. Explosion Criticality Assessment          4
2. Purpose and Introduction                  5
3. Hazardous Area Classification...          6
4. Zone Definitions                          7
5. Scope                                     8
6. Limitations and Assumptions               9
7. DSEAR-1 - Dangerous Substances            10
8. DSEAR-2 - Process & Releases              11
9. DSEAR-3 - Hazardous Area Classification   12
...
```

### Combined FRA+DSEAR (Unchanged)

The combined builder (`buildFraDsearCombinedPdf.ts`) was NOT modified and continues to render all modules as intended:

```
Contents

Executive Summary                            3
Part 1 — Fire Risk Assessment                4
  A1 - Document Control                      4
  A2 - Building Profile                      5  ← Present in combined
  A3 - Persons at Risk                       6  ← Present in combined
  FRA-1 - Fire Hazards                       7
  ...
Part 2 — Explosive Atmospheres Assessment    14
  2.1 Explosion Criticality Assessment       15
  2.7 DSEAR-1 - Dangerous Substances         21
  ...
```

## Automatic Numbering Adjustment

**The filtering automatically adjusts section numbering without any additional changes needed.**

**How It Works:**

1. Filter removes A2, A3 from module list
2. `sortModules()` receives only DSEAR + A1 modules
3. Section numbering loop iterates over filtered list:
   ```typescript
   for (let i = 0; i < sortedModules.length; i++) {
     const module = sortedModules[i];
     const sectionNumber = nextSectionNumber + i;
     // Render module with sectionNumber
   }
   ```
4. Numbers automatically assign to remaining modules in sequence

**Example:**
- Before filter: 10 modules (A1, A2, A3, DSEAR-1...DSEAR-7)
- After filter: 8 modules (A1, DSEAR-1...DSEAR-7)
- Section 7 now assigned to DSEAR-1 (was section 9 before)
- Section 8 now assigned to DSEAR-2 (was section 10 before)
- **No manual number adjustment needed!**

## Side Effects (Intentional)

### TOC Automatically Updated

The TOC generation uses `sortedModules` array, so filtered modules are automatically excluded from TOC:

```typescript
for (let i = 0; i < sortedModules.length; i++) {
  const module = sortedModules[i];
  const sectionNumber = nextSectionNumber + i;
  const moduleName = getModuleName(module.module_key);
  recordToc(`${sectionNumber}. ${displayName}`);
  // ...
}
```

**Result:** TOC only shows sections that are actually rendered in PDF.

### Action Register Still Shows All Actions

Actions are filtered by `source_module_key` during rendering, not by `sortedModules`:

```typescript
const dsearActions = actions.filter(a =>
  a.source_module_key?.startsWith('DSEAR_') ||
  a.source === 'explosion_criticality'
);
```

**Result:** Even if A2/A3 modules are excluded from PDF, any actions associated with them (unlikely but possible) would still appear in the Action Register if they match the DSEAR filter.

**Note:** In practice, A2/A3 actions would be FRA-specific and shouldn't exist in DSEAR-only documents.

### Attachments Still Show All

Attachments are document-level, not module-level:

```typescript
const attachments = await listAttachments(document.id);
```

**Result:** All attachments for the document appear in Attachments Index, regardless of which modules are rendered.

## Testing Checklist

### Test 1: DSEAR-Only Document Without A2/A3
**Setup:** Create DSEAR document with only DSEAR modules

**Verify:**
- ✅ No A2 section in PDF body
- ✅ No A3 section in PDF body
- ✅ No A2 in TOC
- ✅ No A3 in TOC
- ✅ DSEAR modules render correctly
- ✅ Section numbering sequential (no gaps)

### Test 2: DSEAR-Only Document With A1
**Setup:** DSEAR document with A1_DOC_CONTROL + DSEAR modules

**Verify:**
- ✅ A1 renders in PDF body
- ✅ A1 appears in TOC
- ✅ A2 still excluded
- ✅ A3 still excluded
- ✅ A1 gets correct section number (likely section 7, after canned sections)
- ✅ DSEAR modules follow A1 in numbering

### Test 3: Edge Case - Document With A2 Instance (Legacy Data)
**Setup:** DSEAR document that somehow has A2 module instance in DB

**Verify:**
- ✅ A2 does NOT render in PDF (filter blocks it)
- ✅ A2 does NOT appear in TOC
- ✅ No error/crash from filtering
- ✅ PDF generates successfully
- ✅ Numbering correct for remaining modules

### Test 4: Combined FRA+DSEAR Still Works
**Setup:** Combined document rendered with `buildFraDsearCombinedPdf`

**Verify:**
- ✅ A2 renders in Part 1 (FRA section)
- ✅ A3 renders in Part 1 (FRA section)
- ✅ Combined builder completely unchanged
- ✅ Part 2 (DSEAR) has all DSEAR modules
- ✅ No filtering applied in combined context

### Test 5: Section Numbering Continuity
**Setup:** DSEAR document with 6 canned sections + 8 DSEAR modules

**Expected Numbering:**
```
1. Explosion Criticality Assessment     (canned)
2. Purpose and Introduction             (canned)
3. HAC Methodology                      (canned)
4. Zone Definitions                     (canned)
5. Scope                                (canned)
6. Limitations                          (canned)
7. DSEAR-1 - Dangerous Substances       (module)
8. DSEAR-2 - Process Releases           (module)
9. DSEAR-3 - HAC                        (module)
10. DSEAR-4 - Ignition Sources          (module)
11. DSEAR-5 - Explosion Protection      (module)
12. DSEAR-6 - Risk Assessment           (module)
13. DSEAR-10 - Hierarchy of Control     (module)
14. DSEAR-11 - Emergency Response       (module)
15. References and Compliance           (canned)
16. Compliance-Critical Findings        (canned, conditional)
17. Action Register                     (canned)
18. Attachments Index                   (canned, conditional)
```

**Verify:**
- ✅ No gaps in numbering (7 follows 6, not 9)
- ✅ Module section starts at correct number after canned sections
- ✅ TOC page numbers match PDF sections

### Test 6: Action Register Content
**Setup:** DSEAR document with actions from DSEAR modules

**Verify:**
- ✅ Action Register renders
- ✅ All DSEAR actions shown
- ✅ No error if actions reference A2/A3 (shouldn't happen but should be safe)
- ✅ Action counts correct

## Database and Module Keys

**No Changes Required:**

- ✅ Module keys unchanged (`A2_BUILDING_PROFILE` still exists)
- ✅ Database schema unchanged
- ✅ Module instances table unchanged
- ✅ Module catalog unchanged
- ✅ Combined builder unchanged

**Display-Only Filter:**

This is a **presentation layer filter** applied during PDF rendering. The data layer is completely unaffected.

```
Database (module_instances)
    ↓
App reads all modules
    ↓
Combined Builder → Shows all modules (FRA + DSEAR)
    ↓
DSEAR Builder → Filters to DSEAR + A1 only ← NEW FILTER HERE
    ↓
PDF Output
```

## Code Architecture Notes

### Why Filter Before Sort (Not After)

**Correct Approach (Current):**
```typescript
const filteredModules = moduleInstances.filter(...);
const sortedModules = sortModules(filteredModules);
```

**Why:**
- Sorting operates on smaller array (more efficient)
- `sortModules()` may have special logic for certain module orders
- Filtered list maintains sort consistency
- Less risk of off-by-one errors in numbering

**Incorrect Approach (Avoided):**
```typescript
const sortedModules = sortModules(moduleInstances);
const filteredSortedModules = sortedModules.filter(...);
```

**Why Worse:**
- Sorts unnecessary modules
- If `sortModules()` has side effects, they'd apply to filtered-out modules
- More CPU cycles for larger arrays

### Single Source of Truth

The `sortedModules` array is used in multiple places:
1. Module section rendering loop
2. TOC generation
3. Attachments index (needs full module list for context)
4. Action register (uses module keys for filtering, not array directly)

By filtering BEFORE creating `sortedModules`, all downstream uses automatically respect the filter. No need to remember to filter in multiple places.

### Defensive Coding

The filter uses:
- `startsWith('DSEAR_')` - Catches all current and future DSEAR modules (DSEAR_1...DSEAR_99)
- Explicit `=== 'A1_DOC_CONTROL'` - Only allows A1, not A1-like variants
- No hardcoded module counts or indices

**Future-Proof:**
- Adding DSEAR_12 or DSEAR_99 → Automatically included
- Adding A8 or A9 → Automatically excluded
- Renaming A2 to A2_BUILDING → Still excluded (doesn't start with DSEAR_)

## Comparison: DSEAR-Only vs Combined

| Feature | DSEAR-Only Builder | Combined FRA+DSEAR Builder |
|---------|-------------------|---------------------------|
| **A1 (Doc Control)** | ✅ Included (optional) | ✅ Included in Part 1 |
| **A2 (Building)** | ❌ Excluded (NOW) | ✅ Included in Part 1 |
| **A3 (Persons)** | ❌ Excluded (NOW) | ✅ Included in Part 1 |
| **FRA Modules** | ❌ Excluded | ✅ Included in Part 1 |
| **DSEAR Modules** | ✅ Included | ✅ Included in Part 2 |
| **Numbering Style** | Sequential (1, 2, 3...) | Hierarchical (Part 1, Part 2, 2.1, 2.2...) |
| **Filter Applied** | ✅ Yes (NEW) | ❌ No (unchanged) |

## Build Status

✅ **Build succeeds with no TypeScript errors**
✅ **No ESLint warnings**
✅ **Filter logic validated**
✅ **No impact on combined builder**

## Implementation Summary

**Single Line Filter (Expanded for Clarity):**
```typescript
const filteredModules = moduleInstances.filter(m =>
  m.module_key.startsWith('DSEAR_') ||  // All DSEAR modules
  m.module_key === 'A1_DOC_CONTROL'     // Optional governance
);
```

**Impact:**
- 4 lines of code added (filter + comments)
- 1 variable renamed: `moduleInstances` → `filteredModules` → `sortedModules`
- 0 changes to numbering logic
- 0 changes to database
- 0 changes to combined builder
- 0 changes to module keys

**Result:**
- ✅ A2/A3 excluded from DSEAR-only reports
- ✅ A1 kept for governance
- ✅ Automatic numbering adjustment
- ✅ TOC automatically updated
- ✅ Combined reports unchanged
- ✅ Professional, focused DSEAR output

## Future Considerations

### Potential Enhancements

1. **Configurable Filter:**
   ```typescript
   const dsearOnlyFilter = (m: ModuleInstance) =>
     m.module_key.startsWith('DSEAR_') ||
     m.module_key === 'A1_DOC_CONTROL';

   const filteredModules = moduleInstances.filter(dsearOnlyFilter);
   ```

2. **Dynamic Governance Modules:**
   ```typescript
   const GOVERNANCE_MODULES = ['A1_DOC_CONTROL'];
   const filteredModules = moduleInstances.filter(m =>
     m.module_key.startsWith('DSEAR_') ||
     GOVERNANCE_MODULES.includes(m.module_key)
   );
   ```

3. **Explicit A1 Requirement:**
   ```typescript
   // If A1 should ALWAYS appear in DSEAR reports:
   const hasA1 = filteredModules.some(m => m.module_key === 'A1_DOC_CONTROL');
   if (!hasA1) {
     console.warn('DSEAR report missing A1_DOC_CONTROL governance module');
   }
   ```

### Not Implemented (By Design)

**Excluded from filter (intentionally not in DSEAR-only):**
- A2 - Building Profile (FRA concept)
- A3 - Occupancy & Persons at Risk (FRA concept)
- A4 - Management Controls (FRA concept, if exists)
- A5 - Emergency Arrangements (FRA concept, if exists)
- A7 - Review & Assurance (FRA concept, if exists)
- FRA_* - All FRA modules (fire-specific, not explosion)

**These should ONLY appear in:**
- Standalone FRA reports
- Combined FRA+DSEAR reports (Part 1)

## Related Documentation

- `COMBINED_PDF_TOC_AND_NUMBERING_COMPLETE.md` - Combined PDF structure (unchanged)
- `FRA_PDF_*.md` - FRA-only reports (unchanged)
- Module catalog - Module key definitions
- `buildDsearPdf.ts` - DSEAR PDF builder (THIS FILE)
