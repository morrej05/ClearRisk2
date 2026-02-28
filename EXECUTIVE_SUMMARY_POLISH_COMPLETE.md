# Executive Summary Polish - Complete

## Overview
Completed two-part enhancement to executive summary generation:
1. Removed "AI" wording from user-facing error messages (backend copy cleanup)
2. Polished FRA snapshot labels with deterministic human-readable mappings

## PART 1: Backend Copy Cleanup

### Changes Made

**File: src/lib/ai/generateExecutiveSummary.ts**

#### Entitlement Error Message (line 52)
- **Before:** `'AI executive summaries are available on the Professional plan. Upgrade to access this feature.'`
- **After:** `'Executive summaries are available on the Professional plan. Upgrade to access this feature.'`

### What Remained Unchanged
✅ Database field: `executive_summary_ai` (no schema changes)
✅ Function name: `canGenerateAiSummary()` (internal, not user-facing)
✅ All entitlement logic and business rules

## PART 2: FRA Snapshot Label Polish

### Changes Made

**File: src/lib/ai/generateExecutiveSummary.ts - buildFraSnapshotLines() function**

#### A) Added Deterministic Label Maps

**Building Use Labels:**
```typescript
const buildingUseLabels: Record<string, string> = {
  hmo: 'HMO',
  block_of_flats_purpose_built: 'Purpose-built block of flats',
  converted_flats: 'Converted flats',
  hotel_hostel: 'Hotel / hostel',
  care_home: 'Care home',
  office: 'Office',
  retail: 'Retail',
  industrial_warehouse: 'Industrial / warehouse',
  educational: 'Educational',
  healthcare_non_residential: 'Healthcare (non-residential)',
  assembly_leisure: 'Assembly / leisure',
  mixed_use: 'Mixed use',
  other: 'Other',
};
```

**Occupancy Profile Labels:**
```typescript
const occupancyProfileLabels: Record<string, string> = {
  office: 'Office',
  industrial: 'Industrial',
  public_access: 'Public access',
  sleeping: 'Sleeping risk',
  healthcare: 'Healthcare',
  education: 'Education',
  other: 'Other',
};
```

#### B) Snapshot Output Format

**Line 1 (facts1):**
- Format: `"Use: <label>"` and optional `"Occupancy: <label>"`
- Separator: ` • ` (bullet point)
- Example: `"Use: Office • Occupancy: Office"`

**Line 2 (facts2):**
- Format: `"Storeys: X | Sprinklers: Present/Not present | Out-of-hours occupation: Yes/No"`
- Separator: ` | ` (pipe)
- Example: `"Storeys: 3 | Sprinklers: Present | Out-of-hours occupation: Yes"`

#### C) Unknown Value Handling
- `unknown` values are completely omitted (not displayed)
- Only print sprinklers/out-of-hours if value is exactly `"yes"` or `"no"`
- Building use `"other"` appends custom text: `"Other (custom text)"`
- Storeys: prefer `storeys_exact` else `storeys_band`; omit if empty

#### D) Code Quality
- Removed unused `toTitleCase()` helper function
- All logic is deterministic (no inference)
- Limited to data from FRA snapshot helper only

### Example Output Comparisons

**Before:**
```
Use: Block Of Flats Purpose Built
Occupancy: Public Access
Storeys: 5 | Sprinklers: Present | Out-of-hours occupation: Yes
```

**After:**
```
Use: Purpose-built block of flats • Occupancy: Public access
Storeys: 5 | Sprinklers: Present | Out-of-hours occupation: Yes
```

**Before (with "other" use):**
```
Use: Other
Storeys: 2
```

**After (with "other" use):**
```
Use: Other (Custom building description)
Storeys: 2
```

**Before (with unknown values):**
```
Use: Unknown
Occupancy: Unknown
Storeys: 3 | Sprinklers: unknown | Out-of-hours occupation: unknown
```

**After (with unknown values):**
```
Storeys: 3
```
*(All unknowns are omitted cleanly)*

## Data Sources

The snapshot reads from these module data paths:
- `A2_BUILDING_PROFILE.data.building_use_uk` + `building_use_other`
- `A2_BUILDING_PROFILE.data.storeys_exact` / `storeys_band`
- `A3_PERSONS_AT_RISK.data.occupancy_profile`
- `A3_PERSONS_AT_RISK.data.out_of_hours_occupation`
- Sprinklers from either:
  - `FRA_8_FIREFIGHTING_EQUIPMENT.data.firefighting.fixed_facilities.sprinklers.installed`
  - `FRA_3_PROTECTION_ASIS.data.firefighting.fixed_facilities.sprinklers.installed`
  - Legacy: `data.sprinkler_present`

## Verification

✅ **Build:** TypeScript compiles with no errors
✅ **Lint:** No unused imports or variables
✅ **User-facing text:** No "AI" wording in any error messages
✅ **Labels:** All snapshot labels are human-readable (no underscores)
✅ **Separators:** Line 1 uses ` • `, Line 2 uses ` | `
✅ **Unknown handling:** Unknown values are omitted entirely
✅ **Database:** Still writes to `executive_summary_ai` (no migration required)

## Technical Notes

### What Changed
- User-facing error messages now say "Executive summaries" instead of "AI executive summaries"
- FRA snapshot labels use explicit mapping dictionaries instead of generic title-casing
- Snapshot formatting uses proper separators (` • ` for line 1, ` | ` for line 2)
- Unknown values are cleanly omitted from output

### What Stayed the Same
- Database schema unchanged (`executive_summary_ai` column)
- Entitlement checking logic unchanged (`canGenerateAiSummary()`)
- All data sources and module lookups unchanged
- No inference or additional data sources added
- DSEAR and FSD summary generation unchanged

## Impact

### User Experience
- **Professional tone:** Error messages no longer mention "AI"
- **Readable snapshots:** Labels like "Purpose-built block of flats" instead of "Block Of Flats Purpose Built"
- **Clean output:** Unknown values don't clutter the snapshot
- **Consistent formatting:** Proper use of bullets and pipes for visual hierarchy

### Backend
- More maintainable with explicit label mappings
- Deterministic output (no dynamic string transformations)
- Easier to extend with new building types or occupancy profiles

## Next Steps (Optional - Not in Scope)

If desired in future:
1. Rename internal references for consistency:
   - `canGenerateAiSummary` → `canGenerateExecutiveSummary`
   - Database column `executive_summary_ai` → `executive_summary`
   - Directory `src/lib/ai/` → `src/lib/summaries/`
2. Add more building use types or occupancy profiles to label maps
3. Consider localization support for labels

## Summary

Successfully completed two-part enhancement: removed "AI" branding from user-facing error messages and implemented deterministic, human-readable FRA snapshot labels with proper formatting. All changes are text/display-only with no functional alterations to entitlements, data sources, or business logic.
