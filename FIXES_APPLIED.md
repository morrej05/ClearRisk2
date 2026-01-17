# Fixes Applied - Library Empty & Triggers Not Working

## Summary

Fixed two critical issues:
1. **Part A**: Recommendation Library showing empty after CSV import
2. **Part B**: Auto-generated (triggered) recommendations not firing

Both issues are now resolved with comprehensive testing and validation tools.

---

## Part A: Library Empty After Import

### Issues Found and Fixed

#### 1. **Type Coercion in CSV Parsing**
**Problem**: CSV parsing was not properly converting strings to correct types
- `is_active` field stored as string "true" instead of boolean `true`
- `default_priority` not parsed as integer

**Fix**: Enhanced CSV parsing in both frontend and edge function
- `RecommendationCSVImport.tsx`: Robust boolean parsing (`true`, `1`, `yes` all map to boolean `true`)
- Edge function: Validates and coerces all types before insert

#### 2. **Legacy Column References**
**Problem**: Library query was ordering by non-existent `code` column
- Query failed silently, returning empty results
- Filter logic referenced non-existent `template.code` field

**Fix**: Updated `RecommendationLibrary.tsx`
- Changed order by from `code` to `created_at DESC`
- Removed `code` references from filter logic
- Now queries only existing columns

#### 3. **Database Verification**
**Problem**: No way to verify data actually made it to database

**Fix**: Added comprehensive DB sanity checking
- Edge function now returns `dbCountAfter` with total/global/active counts
- New "DB Sanity Check" button in UI shows:
  - Total templates in database
  - Templates with scope='global'
  - Active templates
  - Last 10 templates added (with hazard, category, active status)

### Files Modified (Part A)

1. **`supabase/functions/seed-recommendation-templates/index.ts`**
   - Added type validation and coercion
   - Added post-import DB count verification
   - Returns `dbCountAfter` object with counts

2. **`src/components/RecommendationCSVImport.tsx`**
   - Enhanced CSV parser with robust boolean/integer handling
   - Added `handleSanityCheck()` function
   - Added DB Sanity Check button and results display
   - Shows DB verification data after import

3. **`src/components/RecommendationLibrary.tsx`**
   - Fixed query to order by `created_at` instead of `code`
   - Removed `template.code` reference from filter
   - Simplified search filter logic

### Testing

**Before Fix**:
- CSV import showed "success" but library remained empty
- No way to verify if data reached database

**After Fix**:
- Library immediately shows imported templates
- DB Sanity Check confirms data in database
- Import results show both operation counts AND db verification

---

## Part B: Auto-Generated Recommendations (Triggers)

### Architecture Implemented

#### 1. **New Table: `recommendation_triggers`**
Maps field ratings to recommendation templates for automatic generation.

**Columns**:
- `id` (uuid): Primary key
- `section_key` (text): Section identifier (e.g., "FP_09_Management")
- `field_key` (text): Field identifier (e.g., "fireEquipmentTesting_rating")
- `rating_value` (text): Trigger value (e.g., "Poor", "Inadequate")
- `template_id` (uuid): Links to recommendation_templates
- `priority` (int 1-5): Priority override for this trigger
- `is_active` (boolean): Enable/disable trigger
- Unique constraint: `(section_key, field_key, rating_value, template_id)`

**RLS Policies**:
- READ: All authenticated users (active triggers only)
- WRITE: Super admins only

#### 2. **Updated `survey_recommendations` Table**
Added fields for idempotent trigger handling:
- `trigger_key` (text): Unique identifier for triggered recommendations
- `trigger_context` (jsonb): Stores trigger metadata
- Unique constraint: `(survey_id, trigger_key)` for upsert behavior

**Trigger Key Format**: `{section_key}:{field_key}:{rating_value}:{template_id}`

Example: `"FP_09_Management:fireEquipmentTesting_rating:Poor:abc123..."`

#### 3. **Trigger Evaluation Logic**

**File**: `src/utils/recommendationTriggers.ts`

**Functions**:

1. `evaluateTriggers()` - Main trigger evaluation
   - Looks up triggers for (section, field, rating)
   - Creates/updates recommendations using trigger_key
   - Returns count of recommendations added

2. `removeTriggers()` - Soft deletes when rating improves
   - Sets `include_in_report=false` and `status='deferred'`
   - Doesn't hard delete (preserves history)

3. `reevaluateAllTriggers()` - Bulk evaluation
   - Scans all fields in survey for Poor/Inadequate/Fair ratings
   - Evaluates triggers for each problematic rating
   - Used after survey save

#### 4. **Seeded Trigger Mappings**

**Migration**: `seed_legacy_triggers_and_templates.sql`

Seeded 10 common triggers from legacy system:
- Loss Prevention Programme
- Fire Equipment Testing
- Hot Work Controls
- Electrical Maintenance
- General Maintenance
- Smoking Controls
- Housekeeping Standards
- Self-Inspection Programme
- Change Management
- Contractor Controls

Each mapped to both "Poor" and "Inadequate" ratings.

#### 5. **Integration with Survey Saving**

**File**: `src/components/NewSurveyReport.tsx`

Added trigger evaluation to `handleSaveSurvey()`:
- After successful INSERT: Evaluates triggers for new survey
- After successful UPDATE: Re-evaluates all triggers
- Runs asynchronously, doesn't block save operation

### How It Works

**User Flow**:
1. User opens/creates survey
2. User rates field (e.g., "Fire Equipment Testing" = "Poor")
3. User clicks Save
4. Survey saved to database
5. **Trigger evaluation runs automatically**:
   - Finds triggers matching field + rating
   - Creates recommendation using template
   - Uses trigger_key for idempotent upsert
6. Recommendation appears in Smart Recommendations table

**Idempotent Behavior**:
- Same field rating = same trigger_key
- Upsert prevents duplicates on repeated saves
- Changing rating updates/removes old recommendation

**Example Trigger Flow**:
```
Field: fireEquipmentTesting_rating = "Poor"
↓
Lookup: recommendation_triggers WHERE
  section_key='FP_09_Management' AND
  field_key='fireEquipmentTesting_rating' AND
  rating_value='Poor'
↓
Found: template "Fire Equipment Testing"
↓
Generate trigger_key: "FP_09_Management:fireEquipmentTesting_rating:Poor:{template_id}"
↓
UPSERT survey_recommendations:
  - hazard: "Fire Equipment Testing"
  - description_final: (from template)
  - action_final: (from template)
  - priority: 4
  - status: 'open'
  - source: 'triggered'
  - trigger_key: (unique identifier)
```

### Files Modified (Part B)

1. **Migration**: `supabase/migrations/create_recommendation_triggers_system.sql`
   - Created `recommendation_triggers` table
   - Updated `survey_recommendations` with trigger fields
   - Added RLS policies
   - Added indexes for performance

2. **Migration**: `supabase/migrations/seed_legacy_triggers_and_templates.sql`
   - Seeded 10 templates from legacy system
   - Created 20 triggers (10 × 2 ratings each)

3. **New File**: `src/utils/recommendationTriggers.ts`
   - `evaluateTriggers()` - Main trigger evaluation
   - `removeTriggers()` - Soft delete when rating improves
   - `reevaluateAllTriggers()` - Bulk evaluation

4. **Updated**: `src/components/NewSurveyReport.tsx`
   - Added import for `reevaluateAllTriggers`
   - Calls trigger evaluation after survey save (both INSERT and UPDATE)

### Testing

**Before Fix**:
- Grading fields as Poor/Inadequate did nothing
- No recommendations auto-generated
- Had to manually add all recommendations

**After Fix**:
- Grade field as "Poor" → Save → Recommendation automatically created
- Appears in Smart Recommendations table
- Re-save updates existing recommendation (no duplicates)
- Change rating → Re-save → Old recommendation soft-deleted

---

## Database Schema Changes

### New Tables

#### `recommendation_triggers`
```sql
CREATE TABLE recommendation_triggers (
  id uuid PRIMARY KEY,
  section_key text NOT NULL,
  field_key text NOT NULL,
  rating_value text NOT NULL,
  template_id uuid NOT NULL REFERENCES recommendation_templates(id),
  priority int CHECK (priority >= 1 AND priority <= 5),
  is_active boolean DEFAULT true,
  UNIQUE (section_key, field_key, rating_value, template_id)
);
```

### Updated Tables

#### `survey_recommendations`
Added columns:
- `trigger_key text` - Unique identifier for triggered recommendations
- `trigger_context jsonb` - Stores trigger metadata
- Added constraint: `UNIQUE (survey_id, trigger_key)`

---

## Acceptance Criteria Met

### Part A ✅
- [x] Library list shows imported templates immediately
- [x] DB Sanity Check shows non-zero count
- [x] CSV parsing correctly handles boolean/integer types
- [x] No filters accidentally excluding data
- [x] Legacy column references removed

### Part B ✅
- [x] Selecting Poor/Inadequate creates triggered recommendation
- [x] No duplicates on repeated edits (idempotent upserts)
- [x] Triggered recommendations appear in Smart Recommendations table
- [x] Trigger system uses proper database architecture (not hardcoded)
- [x] Triggers are configurable (can add/edit via database)

---

## Migration Files Created

1. `seed_recommendation_templates_from_csv_v2.sql` - Creates unique index for CSV upserts
2. `create_recommendation_triggers_system.sql` - Creates triggers table and updates survey_recommendations
3. `seed_legacy_triggers_and_templates.sql` - Seeds 10 templates + 20 triggers

---

## Key Features

### CSV Import System
- Robust type coercion (boolean, integer)
- DB verification after import
- Shows total/global/active counts
- Sanity check button for manual verification
- Displays recent templates for visual confirmation

### Trigger System
- Configurable via database (not hardcoded)
- Idempotent upserts (no duplicates)
- Soft deletes (preserves history)
- Automatic evaluation on save
- Supports multiple triggers per field
- Priority overrides per trigger
- Enable/disable individual triggers

### Benefits
1. **Maintainability**: Triggers configured in DB, not code
2. **Flexibility**: Add new triggers without code changes
3. **Data Integrity**: Unique constraints prevent duplicates
4. **Performance**: Indexed lookups for trigger evaluation
5. **Audit Trail**: trigger_context stores full metadata
6. **User Experience**: Automatic recommendations on field grading

---

## Future Enhancements

### Potential Improvements
1. **Trigger Management UI**: Super admin interface to add/edit triggers
2. **Bulk Trigger Import**: CSV import for triggers
3. **Trigger Preview**: Show which recommendations will fire before save
4. **Trigger Analytics**: Track which triggers fire most often
5. **Conditional Triggers**: Multiple field conditions (AND/OR logic)
6. **Template Variables**: Inject field values into recommendations (e.g., "{{field_label}} requires improvement")

### Advanced Features
1. **Trigger Priorities**: Weight multiple triggers on same field
2. **Trigger Cascades**: One recommendation triggers another
3. **Trigger Scheduling**: Delay recommendation generation
4. **Trigger Approval**: Require review before adding to report
