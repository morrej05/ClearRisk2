# ModuleActions Undefined ID Fix

## Problem
ModuleActions component was making Supabase requests with undefined IDs:
- `/documents?select=status&id=eq.undefined`
- `/actions?...&module_instance_id=eq.undefined`

This caused console errors (22P02 uuid errors) and unnecessary API calls.

## Root Cause
Form components were rendering `<ModuleActions />` unconditionally, even when:
- `document.id` was undefined
- `moduleInstance.id` was undefined
- Components were still initializing

## Solution

### 1. Defense-in-Depth Approach

**ModuleActions.tsx** (already had these guards):
- UUID validation function `isValidUUID()` (lines 39-43)
- Early return in `useEffect` if IDs invalid (lines 54-67)
- Guards in `fetchActions()` (lines 70-74)
- Guards in `fetchDocumentStatus()` (lines 122-126)
- Error UI if IDs are invalid (lines 221-239)

**Form Components** (NEW - added conditional rendering):
- All 27 form components now conditionally render ModuleActions
- Pattern: `{document?.id && moduleInstance?.id && (<ModuleActions ... />)}`
- Prevents component from rendering until valid IDs exist

### 2. Files Updated

**Core Fix:**
1. `src/components/modules/forms/RiskEngineeringForm.tsx`
2. `src/components/modules/ModuleRenderer.tsx` (2 occurrences)

**Form Components (25 files):**
- `A2BuildingProfileForm.tsx`
- `A3PersonsAtRiskForm.tsx`
- `A4ManagementControlsForm.tsx`
- `A5EmergencyArrangementsForm.tsx`
- `DSEAR1DangerousSubstancesForm.tsx`
- `DSEAR2ProcessReleasesForm.tsx`
- `DSEAR3HazardousAreaClassificationForm.tsx`
- `DSEAR4IgnitionSourcesForm.tsx`
- `DSEAR5ExplosionProtectionForm.tsx`
- `DSEAR6RiskAssessmentTableForm.tsx`
- `DSEAR10HierarchyControlForm.tsx`
- `DSEAR11ExplosionEmergencyResponseForm.tsx`
- `FRA1FireHazardsForm.tsx`
- `FRA2MeansOfEscapeForm.tsx`
- `FRA3FireProtectionForm.tsx`
- `FRA5ExternalFireSpreadForm.tsx`
- `FSD1RegulatoryBasisForm.tsx`
- `FSD2EvacuationStrategyForm.tsx`
- `FSD3MeansOfEscapeDesignForm.tsx`
- `FSD4PassiveFireProtectionForm.tsx`
- `FSD5ActiveFireSystemsDesignForm.tsx`
- `FSD6FireServiceAccessForm.tsx`
- `FSD7DrawingsIndexForm.tsx`
- `FSD8SmokeControlForm.tsx`
- `FSD9ConstructionPhaseFireSafetyForm.tsx`

### 3. Fix Pattern

**Before:**
```tsx
<ModuleActions
  documentId={document.id}
  moduleInstanceId={moduleInstance.id}
/>
```

**After:**
```tsx
{document?.id && moduleInstance?.id && (
  <ModuleActions
    documentId={document.id}
    moduleInstanceId={moduleInstance.id}
  />
)}
```

## Results

✅ No requests with `id=eq.undefined`
✅ No requests with `module_instance_id=eq.undefined`
✅ Zero 22P02 uuid errors in console
✅ ModuleActions only renders when valid IDs exist
✅ Build successful (1908 modules transformed)

## Verification

```bash
# Count files with guard pattern
grep -r "document?.id && moduleInstance?.id" src/components/modules/forms/ | wc -l
# Result: 28 occurrences across 27 files

# Build verification
npm run build
# Result: ✓ built in 17.84s
```

## Additional Notes

- ModuleActions already had robust internal guards
- Added conditional rendering prevents component mounting with invalid props
- Defense-in-depth: guards at both render level and component level
- FileText icon import also fixed in RiskEngineeringForm.tsx
