# Phase 3: New Assessment Picker — COMPLETE

## Objective
Implement `/assessments/new` as a clean, professional assessment launcher with one-click start that routes directly to assessment workspace.

## ✅ Completed Features

### 1. New Assessment Picker Page
**Location:** `/assessments/new`

#### Page Layout:
- **Header**
  - Title: "New Assessment"
  - Intro text: "Select an assessment type to start."

- **Fire Section**
  - Fire Risk Assessment
    - Button: Start (always enabled)
  - Fire Strategy
    - Button: Start (always enabled)

- **Risk Engineering Section**
  - Property Risk Survey
    - Gated by: `canAccessRiskEngineering()` (Professional/Enterprise only)
    - Shows lock icon + "Upgrade" button if not accessible
  - DSEAR / ATEX
    - Gated by: `canAccessExplosionSafety()` (Professional/Enterprise only)
    - Shows lock icon + "Upgrade" button if not accessible

### 2. One-Click Creation (No Modals)

**Direct document creation** via shared utility function (`src/utils/documentCreation.ts`):

- **Fire Risk Assessment** 
  - Creates document with type=FRA
  - Generates module skeleton (A1-A5, A7, FRA_1-FRA_5)
  - Routes to `/documents/${id}/workspace`

- **Fire Strategy**
  - Creates document with type=FSD
  - Generates module skeleton (A1-A2, FSD_1-FSD_9)
  - Routes to `/documents/${id}/workspace`

- **DSEAR / ATEX**
  - Creates document with type=DSEAR
  - Generates module skeleton (A1-A2, DSEAR_1-DSEAR_11)
  - Routes to `/documents/${id}/workspace`

- **Property Risk Survey**
  - Creates survey_reports entry
  - Routes to `/report/${id}` (legacy system)

### 3. Loading State

**Inline button feedback:**
- Button shows "Starting..." while creating
- All other buttons disabled during creation
- No separate loading spinner or modal
- Returns to "Start" state if creation fails

### 4. Entry Points

Both entry points now correctly route to `/assessments/new`:
- ✅ Dashboard: "New Assessment" button
- ✅ All Assessments page: "New Assessment" header button

### 5. UX Enhancements

- **Clean list-based layout** (not cards, no modals)
- **Two-section organization** (Fire / Risk Engineering)
- **Hover states** on assessment rows
- **Professional styling** with slate color scheme
- **Clear upgrade messaging** for gated features
- **Inline loading states** (Starting...)
- **Direct navigation** to workspace after creation

## 📁 Files Modified

### Created:
- `/src/utils/documentCreation.ts` - Shared document creation utilities
  - `createDocument()` - Creates modular documents (FRA, FSD, DSEAR)
  - `createPropertySurvey()` - Creates legacy property surveys
  - `MODULE_SKELETONS` - Defines module structure per document type

### Updated:
- `/src/pages/ezirisk/NewAssessmentPage.tsx` - Full implementation with direct creation

## 🎯 Technical Decisions

1. **Direct Creation**: No modals, documents created immediately on button click
2. **Shared Utility**: Extracted document creation logic into reusable functions
3. **Type Safety**: TypeScript types for document types ('FRA' | 'FSD' | 'DSEAR')
4. **Error Handling**: Try-catch with user-friendly alert messages
5. **Loading State**: Inline button text change + disabled state
6. **Workspace Navigation**: Routes to `/documents/${id}/workspace` for all modular docs
7. **Legacy Integration**: Property surveys still route to `/report/${id}` (different UI)

## 🔄 User Flow

### Creating an Assessment (Typical Flow):
1. Engineer lands on Dashboard
2. Clicks "New Assessment" button
3. Redirected to `/assessments/new`
4. Reviews available assessment types
5. Clicks "Start" on desired type
6. Button shows "Starting..." (instant feedback)
7. Document created in background:
   - Entry in `documents` table
   - Module instances created automatically
8. Immediate navigation to `/documents/{id}/workspace`
9. Engineer lands directly in the assessment editor
10. New assessment appears in:
    - Active Work panel on Dashboard
    - All Assessments list

### Attempting Locked Assessment (Core Plan):
1. Engineer lands on `/assessments/new`
2. Sees "Property Risk Survey" or "DSEAR" with lock icon
3. Clicks "Upgrade" button
4. Redirected to `/upgrade` page
5. Can review plan features and upgrade options

## ✅ Success Criteria Met

- [x] Clean picker page at `/assessments/new`
- [x] Two-section layout (Fire / Risk Engineering)
- [x] Start buttons create documents directly (no modals)
- [x] Inline loading state ("Starting...")
- [x] Routes to `/documents/${id}/workspace`
- [x] Entitlement checks working correctly
- [x] Upgrade prompts for locked features
- [x] Entry points from Dashboard and Assessments page
- [x] Professional, list-based UI
- [x] Shared document creation utility
- [x] Build successful with no errors

## 🚫 Scope Excluded (As Required)

- No modals for document creation
- No form fields before creation (one-click start)
- No Stripe/billing changes
- No backend endpoint changes
- No schema changes
- No combined reports
- No issue/reissue workflow
- No impairment logging

## 🔄 Integration Points

**With Phase 2:**
- New assessments created via picker now appear in:
  - Dashboard Active Work table
  - All Assessments list
  - Searchable and filterable

**With Existing Systems:**
- FRA/FSD/DSEAR → Modular documents (`assessments` table)
- Property Survey → Legacy surveys (`survey_reports` table)
- Both systems remain fully functional

**With Document Workspace:**
- Direct navigation to `/documents/${id}/workspace`
- No intermediate steps between creation and editing
- Seamless one-click experience

## 🎯 Next Steps (Future Phases)

Phase 3 completes the streamlined assessment creation flow. Future enhancements could include:
- Recent clients shortcut with auto-fill
- Assessment templates
- Duplicate existing assessment
- Bulk import
- Pre-filled defaults based on previous assessments

## Build Status

✅ **Build Successful**
- All TypeScript compiles cleanly
- No errors or warnings
- Bundle size: 2,071 KB (532 KB gzipped)
- New utility module: documentCreation.ts

---

**Status:** Phase 3 Complete (Updated)  
**Approach:** Direct creation (no modals)  
**Navigation:** `/documents/${id}/workspace`  
**Last Updated:** 2026-01-22
