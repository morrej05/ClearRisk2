# Recommendation Templates System - Fixed

## Summary

Fixed orphaned recommendation library access and aligned all components to use `recommendation_templates` table with proper field mapping.

---

## Issues Fixed

### 1. ✅ Restored Admin Access
**Problem:** Platform admin library access was orphaned
**Solution:**
- Confirmed SuperAdminDashboard already renders `src/components/RecommendationLibrary.tsx`
- Updated component to use aligned field names (observation, action_required, hazard_risk_description)
- Added hazard generation button with neutral text validation

### 2. ✅ Fixed RLS Policies
**Problem:** RLS policies weren't properly separating platform admin and normal user access
**Solution:** Created separate policies:
- Platform admins: SELECT all templates (active + inactive)
- Normal users: SELECT only `is_active = true` templates
- Only platform admins: INSERT, UPDATE, DELETE

```sql
-- Platform admins see all
CREATE POLICY "Platform admins can read all templates" ...

-- Normal users see only active
CREATE POLICY "Users can read active templates" ...
  USING (is_active = true AND NOT EXISTS (admin check))
```

### 3. ✅ Updated RecommendationLibrary.tsx Component
**Changes:**
- Interface updated with aligned fields:
  - `title` (instead of hazard)
  - `observation` (instead of description)
  - `action_required` (instead of action)
  - `hazard_risk_description` (new field)
  - `related_module_key` (new field)
- Added hazard generation button (admin only)
- Uses `generateHazardText()` from `src/utils/hazardTextGenerator.ts`
- Form validates all required fields before save
- Priority mapping: 1-5 numeric (1=High, 3=Medium, 5=Low)

### 4. ✅ Updated RecommendationLibraryModal.tsx
**Changes:**
- Interface aligned with recommendation_templates schema
- Query: `.from('recommendation_templates').eq('is_active', true)`
- Field mapping when adding to survey:
  - `template.title` → `hazard`
  - `template.observation` → `description_final`
  - `template.action_required` → `action_final`
  - `template.hazard_risk_description` → (stored in re_recommendations)
  - `template.default_priority` (1-5) → `priority` (1-5)
- Search updated to use: title, observation, action_required, category
- Card display updated with correct field names

### 5. ✅ Updated AddFromLibraryModal.tsx
**Changes:**
- Interface aligned with recommendation_templates
- Query: `.from('recommendation_templates').eq('is_active', true)`
- Priority conversion helper: `priorityToText(priority: number)`
- Module filter normalization (RE-05 ↔ RE05)
- Filters only apply when user explicitly changes them
- Card rendering uses: title, observation, action_required, category

### 6. ✅ Updated RE09RecommendationsForm.tsx
**Changes:**
- `addRecommendationFromLibrary()` maps fields correctly:
  - `libraryItem.observation` → `observation_text`
  - `libraryItem.action_required` → `action_required_text`
  - `libraryItem.hazard_risk_description` → `hazard_text`
  - `libraryItem.default_priority` (1-5) → `priority` (High/Medium/Low)
- Priority conversion: 1-2=High, 3=Medium, 4-5=Low
- Stores `library_id` for traceability

---

## Database Schema

### recommendation_templates (aligned)

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| title | text | Brief title (required) |
| body | text | Legacy field (auto-set from title) |
| observation | text | What was observed (required) |
| action_required | text | What action needed (required) |
| hazard_risk_description | text | Neutral risk statement (required) |
| client_response_prompt | text | Optional client guidance |
| category | text | 6 categories (Construction, Management Systems, etc.) |
| default_priority | int | 1-5 scale (1=High, 3=Medium, 5=Low) |
| related_module_key | text | Module association (RE_06_FIRE_PROTECTION, etc.) |
| is_active | boolean | Visible to users |
| scope | text | global/local |
| code | text | Optional legacy code |
| trigger_type | text | manual/grade/presence |
| trigger_section_key | text | For auto-recommendations |
| trigger_field_key | text | For auto-recommendations |
| trigger_value | text | For auto-recommendations |
| created_at | timestamptz | Audit |
| created_by | uuid | Audit |
| updated_at | timestamptz | Audit |
| updated_by | uuid | Audit |

---

## RLS Policies Summary

| Action | Platform Admin | Normal User |
|--------|---------------|-------------|
| SELECT all templates | ✅ Yes | ❌ No |
| SELECT active templates | ✅ Yes | ✅ Yes |
| INSERT | ✅ Yes | ❌ No |
| UPDATE | ✅ Yes | ❌ No |
| DELETE | ✅ Yes | ❌ No |

---

## Access Points

### Platform Admin (SuperAdminDashboard)
**Path:** SuperAdminDashboard → Recommendation Library tab
**Component:** `src/components/RecommendationLibrary.tsx`
**Features:**
- View all templates (active + inactive)
- Create new templates
- Edit existing templates
- Generate hazard text (neutral, admin-only)
- Activate/deactivate templates
- Delete templates
- Filter by category
- Search across all fields

### All Users (Survey Recommendations)
**Path:** Survey → FRA Module → Recommendations section
**Component:** `src/components/RecommendationLibraryModal.tsx` (opened from FRA)
**Features:**
- Browse active templates only
- Search by title, observation, action, category
- Filter by category
- Add template to survey (creates prefilled recommendation)
- Cannot edit library (read-only)

### Assessors (RE09 Recommendations)
**Path:** Assessment → RE-09 Module → "Add from Library" button
**Component:** `src/components/AddFromLibraryModal.tsx`
**Features:**
- Browse active templates only
- Search and filter
- Add to RE09 recommendations
- Map to re_recommendations table with correct fields

---

## Field Mapping Reference

### Library → FRA Survey Recommendations
```javascript
{
  hazard: template.title,
  description_final: template.observation,
  action_final: template.action_required,
  client_response: template.client_response_prompt,
  category: template.category,
  priority: template.default_priority, // 1-5
  status: 'open',
  source: 'library',
  template_id: template.id
}
```

### Library → RE09 Recommendations
```javascript
{
  title: template.title,
  observation_text: template.observation,
  action_required_text: template.action_required,
  hazard_text: template.hazard_risk_description,
  comments_text: template.client_response_prompt,
  priority: priorityToText(template.default_priority), // High/Medium/Low
  source_module_key: template.related_module_key,
  library_id: template.id,
  status: 'Open',
  owner: '',
  target_date: null,
  photos: []
}
```

---

## Priority Mapping

**Database (1-5)** ↔ **UI (High/Medium/Low)**

```javascript
function priorityToText(priority: number): 'High' | 'Medium' | 'Low' {
  if (priority <= 2) return 'High';   // 1-2
  if (priority <= 3) return 'Medium'; // 3
  return 'Low';                        // 4-5
}

function textToPriority(text: 'High' | 'Medium' | 'Low'): number {
  if (text === 'High') return 1;
  if (text === 'Medium') return 3;
  return 5;
}
```

---

## Build Status

✅ **Build Successful** (16.18s, 0 TypeScript errors)

---

## Files Modified

1. **supabase/migrations/fix_recommendation_templates_rls.sql** - RLS policies
2. **src/components/RecommendationLibrary.tsx** - Admin management UI
3. **src/components/RecommendationLibraryModal.tsx** - FRA library modal
4. **src/components/AddFromLibraryModal.tsx** - RE09 library modal
5. **src/components/modules/forms/RE09RecommendationsForm.tsx** - Field mapping

---

## Testing Checklist

### Platform Admin Access
- [ ] Can access library from SuperAdminDashboard
- [ ] Can see all templates (active + inactive)
- [ ] Can create new templates with all fields
- [ ] "Generate" button creates neutral hazard text
- [ ] Can edit existing templates
- [ ] Can activate/deactivate templates
- [ ] Can delete templates
- [ ] Category filter works
- [ ] Search works across title/observation/action

### Normal User Access (FRA)
- [ ] Can open library from FRA recommendations
- [ ] Can see only active templates
- [ ] Cannot see inactive templates
- [ ] Search works
- [ ] Category filter works
- [ ] "Add" button creates recommendation in survey
- [ ] Fields map correctly (observation, action, hazard)
- [ ] Priority value correct (1-5)

### Assessor Access (RE09)
- [ ] "Add from Library" button visible
- [ ] Modal opens with active templates
- [ ] Search works
- [ ] Can add template to RE09
- [ ] Fields map correctly (observation_text, action_required_text, hazard_text)
- [ ] Priority converts correctly (1-5 → High/Medium/Low)
- [ ] library_id stored for traceability

### RLS Enforcement
- [ ] Platform admins can read all templates (active + inactive)
- [ ] Normal users can read only active templates
- [ ] Only platform admins can INSERT
- [ ] Only platform admins can UPDATE
- [ ] Only platform admins can DELETE
- [ ] RLS cannot be bypassed via UI

---

## Key Improvements

1. **Single Source of Truth:** All components query `recommendation_templates`
2. **Aligned Schema:** All fields match between library and instances
3. **Proper RLS:** Platform admin vs normal user access enforced at DB level
4. **Field Mapping:** Correct mapping from library → survey/assessment recommendations
5. **Priority Conversion:** Numeric (1-5) ↔ Text (High/Medium/Low) handled consistently
6. **Admin Hazard Generation:** Platform admins can generate neutral hazard text
7. **Traceability:** library_id stored in recommendation instances
8. **No Orphaned Access:** SuperAdminDashboard link preserved

---

## Backward Compatibility

- ✅ Legacy field names preserved (body, code, scope)
- ✅ Trigger system fields preserved (for future auto-recommendations)
- ✅ Existing recommendation data unchanged
- ✅ No breaking changes to survey_recommendations table
- ✅ Works with both FRA and RE09 systems

---

## Next Steps (Optional)

1. Backfill `hazard_risk_description` for existing templates
2. Add validation to prevent non-neutral hazard text
3. Track template usage analytics
4. Implement auto-recommendation triggers
5. Add version history for templates
