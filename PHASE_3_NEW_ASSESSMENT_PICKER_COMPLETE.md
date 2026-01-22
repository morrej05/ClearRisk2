# Phase 3: New Assessment Picker — COMPLETE

## Objective
Implement `/assessments/new` as a clean, professional assessment launcher that routes to existing creation workflows.

## ✅ Completed Features

### 1. New Assessment Picker Page
**Location:** `/assessments/new`

#### Page Layout:
- **Header**
  - Title: "New Assessment"
  - Intro text: "Select an assessment type to start."

- **Fire Section**
  - Fire Risk Assessment
    - Description: "Structured FRA with recommendations and report output."
    - Button: Start (always enabled)
  - Fire Strategy
    - Description: "Fire strategy inputs aligned to formal output."
    - Button: Start (always enabled)

- **Risk Engineering Section**
  - Property Risk Survey
    - Description: "Property risk engineering survey and report."
    - Gated by: `canAccessRiskEngineering()` (Professional/Enterprise only)
    - Shows lock icon + "Upgrade" button if not accessible
  - DSEAR / ATEX
    - Description: "Explosion risk assessment and controls."
    - Gated by: `canAccessExplosionSafety()` (Professional/Enterprise only)
    - Shows lock icon + "Upgrade" button if not accessible

### 2. Routing Behavior

Each "Start" button routes to existing workflows:

- **Fire Risk Assessment** → Opens `CreateDocumentModal` with type=FRA
  - Uses modular assessments system
  - Creates entry in `assessments` table
  - Auto-generates FRA module skeleton
  - Redirects to `/assessments` after creation

- **Fire Strategy** → Opens `CreateDocumentModal` with type=FSD
  - Uses modular assessments system
  - Creates entry in `assessments` table
  - Auto-generates FSD module skeleton
  - Redirects to `/assessments` after creation

- **Property Risk Survey** → Opens `NewSurveyModal`
  - Uses legacy survey system
  - Creates entry in `survey_reports` table
  - Redirects to `/report/:id` after creation

- **DSEAR / ATEX** → Opens `CreateDocumentModal` with type=DSEAR
  - Uses modular assessments system
  - Creates entry in `assessments` table
  - Auto-generates DSEAR module skeleton
  - Redirects to `/assessments` after creation

### 3. Entitlement Integration

**Plan-based Access:**
- **Core/Solo Plans:**
  - ✅ Fire Risk Assessment
  - ✅ Fire Strategy
  - 🔒 Property Risk Survey (shows upgrade prompt)
  - 🔒 DSEAR / ATEX (shows upgrade prompt)

- **Professional/Enterprise Plans:**
  - ✅ All assessment types fully accessible

**Upgrade Flow:**
- Locked items show lock icon
- "Upgrade" button routes to `/upgrade`
- No dead UI elements (locked items still visible but clearly gated)

### 4. Entry Points

Both entry points now correctly route to `/assessments/new`:
- ✅ Dashboard: "New Assessment" button
- ✅ All Assessments page: "New Assessment" header button

### 5. UX Enhancements

- **Clean list-based layout** (not cards)
- **Two-section organization** (Fire / Risk Engineering)
- **Hover states** on assessment rows
- **Professional styling** with slate color scheme
- **Clear upgrade messaging** for gated features
- **Consistent button patterns** (Start vs Upgrade)
- **Modal integration** with existing creation flows

## 📁 Files Modified

### Updated:
- `/src/pages/ezirisk/NewAssessmentPage.tsx` - Full implementation with modal integration

## 🎯 Technical Decisions

1. **Reuse Existing Modals**: Leveraged `CreateDocumentModal` and `NewSurveyModal` rather than building new forms
2. **Type Filtering**: Pass `allowedTypes` to `CreateDocumentModal` to constrain options per assessment
3. **Entitlement Checks**: Use existing `canAccessRiskEngineering()` and `canAccessExplosionSafety()` functions
4. **No Hidden Options**: Locked features are visible with clear upgrade prompts
5. **List-based UI**: Simple, scannable layout instead of card-heavy design

## 🔄 User Flow

### Creating an Assessment (Typical Flow):
1. Engineer lands on Dashboard
2. Clicks "New Assessment" button
3. Redirected to `/assessments/new`
4. Reviews available assessment types
5. Clicks "Start" on desired type
6. Modal opens with appropriate form:
   - FRA/FSD/DSEAR → Full document creation form
   - Property Survey → Simplified survey form
7. Fills in assessment details
8. Clicks "Create"
9. Redirected to appropriate destination:
   - Modular assessments → `/assessments` list
   - Property survey → `/report/:id` editor
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
- [x] Assessment descriptions present
- [x] Start buttons route to existing modals
- [x] Entitlement checks working correctly
- [x] Upgrade prompts for locked features
- [x] Entry points from Dashboard and Assessments page
- [x] Professional, list-based UI
- [x] No new backend logic required
- [x] Build successful with no errors

## 🚫 Scope Excluded (As Required)

- No recent clients shortcut (would require backend work to prefill)
- No combined reports
- No issue/reissue workflow
- No impairment logging
- No admin settings beyond existing

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

## 🎯 Next Steps (Future Phases)

Phase 3 completes the basic assessment creation flow. Future enhancements could include:
- Recent clients shortcut with auto-fill
- Assessment templates
- Duplicate existing assessment
- Bulk import
- Assessment archiving

## Build Status

✅ **Build Successful**
- All TypeScript compiles cleanly
- No errors or warnings
- Bundle size: 2,068 KB (531 KB gzipped)

---

**Status:** Phase 3 Complete  
**Next:** Phase 4 (TBD)  
**Last Updated:** 2026-01-22
