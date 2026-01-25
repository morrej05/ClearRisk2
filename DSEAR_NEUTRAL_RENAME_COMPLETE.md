# DSEAR to Explosive Atmospheres - Neutral Rename Complete

Successfully completed neutral rename of "DSEAR" to "Explosive Atmospheres Risk Assessment" in all user-facing UI labels, without touching any internal logic, database values, or enums.

## Implementation Summary

### Scope: UI Labels Only ✓

**Changed (User-Facing Labels):**
- Menu/sidebar labels
- Page titles and headings
- Helper/descriptive text
- Form option labels
- Button text
- Empty state messages
- Dashboard tiles
- Upgrade prompts

**NOT Changed (Internal Logic):**
- Database values: 'DSEAR' remains in document_type
- Enum values: 'dsear' remains in internal IDs
- Routes: No routing changes
- Conditional logic: document_type === 'DSEAR' unchanged
- Function names: buildDsearPdf() unchanged
- API payloads: allowedTypes={['DSEAR']} unchanged
- Module keys: DSEAR_1, DSEAR_2, etc. unchanged

**Preserved (Legal References):**
- "Dangerous Substances and Explosive Atmospheres Regulations 2002 (DSEAR)" - kept intact
- Legal/regulatory text in report generation

## Files Modified

### Pages
1. **src/pages/AssessmentsList.tsx**
   - getTypeLabel: 'ATEX/DSEAR' → 'Explosive Atmospheres Risk Assessment'
   - Page description: 'DSEAR' → 'Explosive Atmospheres'
   - Filter dropdown: 'DSEAR' → 'Explosive Atmospheres'

2. **src/pages/NewAssessment.tsx**
   - Option label: 'ATEX/DSEAR Assessment' → 'Explosive Atmospheres Risk Assessment'

3. **src/pages/AssessmentEditor.tsx**
   - getTypeLabel: 'ATEX/DSEAR' → 'Explosive Atmospheres Risk Assessment'

4. **src/pages/ArchivedAssessments.tsx**
   - Description text: 'DSEAR assessments' → 'Explosive Atmospheres assessments'

5. **src/pages/CommonDashboard.tsx**
   - Tile description: 'DSEAR & ATEX assessments' → 'Explosive Atmospheres assessments'
   - Upgrade prompt: 'DSEAR and ATEX assessment' → 'Explosive Atmospheres assessment'

6. **src/pages/dashboard/ExplosionDashboard.tsx**
   - Page subtitle: 'DSEAR & ATEX Assessments' → 'Explosive Atmospheres Assessments'
   - Pro feature text: 'DSEAR & ATEX' → 'Explosive Atmospheres'
   - Page description: 'Manage DSEAR and ATEX' → 'Manage Explosive Atmospheres'
   - Button text: 'Create DSEAR Document' → 'Create Document'
   - Empty state: 'No DSEAR documents' → 'No Explosive Atmospheres documents'
   - Empty state: 'first DSEAR assessment' → 'first Explosive Atmospheres assessment'

7. **src/pages/ezirisk/NewAssessmentPage.tsx**
   - Assessment type title: 'DSEAR / ATEX' → 'Explosive Atmospheres Risk Assessment'
   - Default title: 'New DSEAR Assessment' → 'New Explosive Atmospheres Assessment'

### Components
8. **src/components/documents/CreateDocumentModal.tsx**
   - Option label: 'DSEAR Assessment' → 'Explosive Atmospheres Risk Assessment'
   - Upgrade text: 'DSEAR Assessments' → 'Explosive Atmospheres Assessments'

## What Was NOT Changed

### Database Schema
- `document_type` column still stores 'DSEAR'
- `type` column in assessments still stores 'dsear'
- No migration needed

### Code Logic
- `document.document_type === 'DSEAR'` - preserved
- `typeId === 'dsear'` - preserved
- `mapToDocType('dsear')` returns 'DSEAR' - preserved
- `.eq('document_type', 'DSEAR')` - preserved

### Routes
- No route changes
- `/dashboard/explosion` - unchanged
- Document workspace routes - unchanged

### Module Keys
- DSEAR_1_SUBSTANCES_REGISTER - unchanged
- DSEAR_2_PROCESS_RELEASES - unchanged
- DSEAR_3_HAC_ZONING - unchanged
- DSEAR_4_IGNITION_CONTROL - unchanged
- DSEAR_5_MITIGATION - unchanged
- DSEAR_6_RISK_TABLE - unchanged
- DSEAR_10_HIERARCHY_SUBSTITUTION - unchanged
- DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE - unchanged

### Functions
- `buildDsearPdf()` - unchanged
- PDF generation logic - unchanged
- Report generation - unchanged

### Legal Text
- "Dangerous Substances and Explosive Atmospheres Regulations 2002 (DSEAR)" - preserved
- All regulatory references in report text - preserved

## Smoke Test Results ✓

**Build:** ✅ Successful (no TypeScript errors)
**No Breaking Changes:**
- Existing DSEAR documents will display with new label
- Internal logic unaffected
- Database queries unchanged
- No console errors expected
- Navigation works as before

## User-Visible Changes

**Before:**
- "ATEX/DSEAR"
- "DSEAR & ATEX Assessments"
- "Create DSEAR Document"
- "DSEAR Assessment"

**After:**
- "Explosive Atmospheres Risk Assessment"
- "Explosive Atmospheres Assessments"
- "Create Document"
- "Explosive Atmospheres Risk Assessment"

## Next Steps (Task 2)

The neutral rename is complete. Next task will add jurisdiction-aware display logic:
- UK → "DSEAR Risk Assessment"
- IE/EU → "Explosive Atmospheres Risk Assessment"
- Generic → "Explosive Atmospheres Risk Assessment"

This will require:
1. Helper function to get display name by jurisdiction
2. Pass jurisdiction context to labels
3. Update labels to use helper function
4. No database or logic changes

## Summary

✅ All user-facing "DSEAR" labels → "Explosive Atmospheres Risk Assessment"
✅ Legal references preserved
✅ Internal logic untouched (database, enums, routes, conditionals)
✅ Build successful
✅ No refactoring performed
✅ No behavior changed

The application now displays neutral "Explosive Atmospheres" terminology throughout the UI while maintaining full backward compatibility with existing data and logic.
