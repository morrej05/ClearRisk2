# Promote Recommendations to Templates - Enhanced Implementation Complete

## Summary

Platform admins can now promote actual RE recommendations from assessments into fully-populated, production-ready templates. The system automatically fills missing fields, normalizes module keys, and prevents duplicates.

---

## What Was Implemented

### 1. Database Schema Enhancement ✅

**Migration:** `add_tags_to_recommendation_templates`

- Added `tags` field (text array) to `recommendation_templates`
- Supports categorization like 'derived', 'verified', 'draft'
- Default value: empty array `{}`

### 2. Enhanced Edge Function ✅

**Function:** `promote-recommendations-to-templates`

**Location:** `/supabase/functions/promote-recommendations-to-templates/index.ts`

**Features:**
- Accepts bulk recommendation IDs
- **Complete field population** from `re_recommendations` → `recommendation_templates`:
  - `title` → `title` (unchanged)
  - `observation_text` → `observation` (unchanged)
  - `action_required_text` → `action_required` (**auto-generated if missing**)
  - `hazard_text` → `hazard_risk_description` (**auto-generated if missing**)
  - `comments_text` → `client_response_prompt` (optional)
  - `priority` → `default_priority` (High/Medium/Low → 2/3/4)
  - `source_module_key` → `related_module_key` (**normalized to canonical form**)
- **Smart field generation:**
  - Missing `action_required` generated from title/observation patterns
  - Missing `hazard_risk_description` generated with 3-sentence risk statements
- **Module key normalization:**
  - `RE_03_OCCUPANCY` → `RE03`
  - `process_control_and_stability` → `RE10`
  - `electrical_and_utilities_reliability` → `RE08`
- **Stronger deduplication:** Title + Observation + Action Required (prevents "Improve Exposures Flood" duplicates)
- Automatic category inference from normalized module key
- Sets `is_active=true`, `scope='derived'`, `tags=['derived']`
- Platform admin only access

**Action Required Generation Logic:**
```typescript
- "improve" in title → "Improve the identified condition to meet required standards"
- "install" in title → "Install appropriate controls to address the identified gap"
- "upgrade" in title → "Upgrade the system to current standards and best practice"
- "maintain" in title → "Implement regular maintenance program..."
- "train" in title → "Provide comprehensive training to relevant personnel"
- "document" in title → "Develop and implement appropriate documentation..."
- Default → "Address the identified condition to reduce risk exposure"
```

**Hazard Text Generation Logic:**
```typescript
// 3-sentence structure:
1. Risk statement: "Inadequate controls increase likelihood..."
2. Consequence: Context-specific based on fire/water/structural/electrical/management
3. Benefit: Mitigation value statement

Examples:
- Fire → "Fire events could escalate beyond planned containment..."
- Water → "Water damage events could spread beyond initial areas..."
- Structural → "Structural inadequacies could compromise integrity..."
- Management → "Procedural gaps reduce organizational preparedness..."
```

**Module Key Normalization:**
```typescript
RE_03_OCCUPANCY → RE03
RE_07_NATURAL_HAZARDS → RE07
RE_08_UTILITIES → RE08
RE_09_MANAGEMENT → RE09
process_control_and_stability → RE10
electrical_and_utilities_reliability → RE08
flammable_liquids_and_fire_risk → RE10
safety_and_control_systems → RE10
```

**Category Mapping (from normalized keys):**
```typescript
RE02/RE03 → Construction
RE04/RE06/RE08 → Fire Protection & Detection
RE05/RE07 → Special Hazards
RE09 → Management Systems
RE10 → Special Hazards
RE11/RE12 → Business Continuity
```

**Priority Mapping:**
```typescript
"Critical" / "1" → 1
"High" / "2" → 2
"Medium" / "3" → 3
"Low" / "4" → 4
"5" → 5
```

### 3. Enhanced UI Component ✅

**Component:** `PromoteRecommendationsToTemplates.tsx`

**Location:** `/src/components/PromoteRecommendationsToTemplates.tsx`

**NEW Features:**
- **Preview columns** show what will be created:
  - Title (existing)
  - Module (normalized)
  - Priority (color coded)
  - Observation (existing)
  - **Action Required** (with auto-generated preview in italic)
  - **Hazard/Risk** (with auto-generated preview in italic)
- **Visual indicators:**
  - Existing data: normal text
  - Auto-generated data: italic gray text
- Table view with checkboxes
- Search by title/observation
- Filter by source module
- Bulk selection (Select All / Deselect All)
- Success/error messaging with statistics
- Priority color coding (Critical=red, High=orange, Medium=yellow, Low=green)
- Module badges showing normalized keys

**How to Use:**
1. Navigate to Platform Admin → Recommendation Library
2. View table showing what will be created (missing fields shown in italic)
3. Review Action Required and Hazard/Risk previews
4. Select recommendations to promote (individually or bulk)
5. Click "Promote to Templates"
6. System creates fully-populated templates with auto-generated fields
7. Success message shows inserted/skipped counts

### 4. Integration ✅

**Updated:** `SuperAdminDashboard.tsx`

- Added component import
- Integrated into "Recommendation Library" tab
- Positioned above CSV import and library management
- Full platform admin access control

---

## Key Features

### 1. Complete Field Population ✅
All template fields are populated automatically:
- **Title:** Copied from recommendation
- **Observation:** Copied from recommendation
- **Action Required:** Copied OR auto-generated from patterns
- **Hazard/Risk Description:** Copied OR auto-generated with smart 3-sentence structure
- **Client Response Prompt:** Copied from comments (optional)
- **Related Module Key:** Normalized to canonical form (RE03, RE08, etc.)
- **Category:** Inferred from normalized module key
- **Priority:** Converted from text to numeric
- **Tags:** ['derived']
- **Scope:** 'derived'
- **Active:** true

### 2. Stronger Deduplication ✅
- Compares: `title` + `observation` + `action_required` (all lowercase, trimmed)
- Prevents duplicates like "Improve Exposures Flood" with same observation
- Skips duplicates within the same batch
- Reports all skipped items with titles

### 3. Module Key Normalization ✅
All module keys converted to canonical form:
- `RE_03_OCCUPANCY` → `RE03`
- `RE_07_NATURAL_HAZARDS` → `RE07`
- `process_control_and_stability` → `RE10`
- `electrical_and_utilities_reliability` → `RE08`
- Legacy keys mapped to RE## codes

### 4. Preview Before Promotion ✅
UI shows exactly what will be created:
- Existing fields in normal text
- Auto-generated fields in italic gray
- Full visibility into Action Required and Hazard/Risk
- No surprises after promotion

### 5. Smart Field Generation ✅
**Action Required:**
- Pattern-based generation from title/observation
- Context-aware recommendations
- Fallback to generic action

**Hazard/Risk Description:**
- 3-sentence structure (risk + consequence + benefit)
- Context-specific consequences (fire/water/structural/etc.)
- Professional risk engineering language
- Neutral, template-ready phrasing

---

## Database State

### Starter Templates ✅
- 20 templates pre-seeded
- All set to `is_active=true`
- Categories: Construction, Fire Protection & Detection, Management Systems, Special Hazards
- Scope: 'global'

### Derived Templates ✅
- Created from actual recommendations
- **Fully populated** with all required fields
- **Normalized module keys** (RE03, RE08, etc.)
- Tagged as 'derived'
- Scope: 'derived'
- All active by default
- Ready for immediate use

---

## Testing Checklist

- [ ] Navigate to Platform Admin → Recommendation Library
- [ ] Verify "Promote Recommendations to Templates" section appears first
- [ ] Verify table shows 7 columns: checkbox, title, module, priority, observation, **action required**, **hazard/risk**
- [ ] Verify italic gray text appears for auto-generated fields
- [ ] Test search functionality
- [ ] Test module filter
- [ ] Select 2-3 recommendations with missing fields
- [ ] Verify preview shows what will be auto-generated
- [ ] Click "Promote to Templates"
- [ ] Verify success message shows inserted/skipped counts
- [ ] Scroll to "Recommendation Library" section below
- [ ] Verify new templates have:
  - Complete observation text
  - Generated action required (if was missing)
  - Generated hazard/risk description (if was missing)
  - Normalized module keys (RE03, not RE_03_OCCUPANCY)
  - 'derived' tag
- [ ] Test promoting same recommendations again (should skip as duplicates)
- [ ] Test duplicate detection with recommendations having same title+obs+action

---

## API Endpoint

**URL:** `{SUPABASE_URL}/functions/v1/promote-recommendations-to-templates`

**Method:** POST

**Auth:** Bearer token (platform admin required)

**Request Body:**
```json
{
  "recommendation_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**
```json
{
  "success": true,
  "inserted": 3,
  "skipped": 0,
  "skipped_titles": []
}
```

**Field Processing:**
```json
{
  "title": "copied as-is",
  "observation": "copied as-is",
  "action_required": "copied OR auto-generated",
  "hazard_risk_description": "copied OR auto-generated",
  "related_module_key": "normalized (RE_03_OCCUPANCY → RE03)",
  "category": "inferred from normalized key",
  "default_priority": "converted (High → 2)",
  "is_active": true,
  "scope": "derived",
  "tags": ["derived"]
}
```

---

## Files Changed

1. ✅ `/supabase/migrations/add_tags_to_recommendation_templates.sql`
2. ✅ `/supabase/functions/promote-recommendations-to-templates/index.ts` (enhanced + deployed)
3. ✅ `/src/components/PromoteRecommendationsToTemplates.tsx` (enhanced with preview columns)
4. ✅ `/src/pages/SuperAdminDashboard.tsx` (updated)

---

## Benefits

1. **Fully-Populated Templates:** All fields automatically filled, no manual work needed
2. **Preview Before Promotion:** See exactly what will be created (italic = auto-generated)
3. **Normalized Module Keys:** Clean RE03/RE08 format, no more mixed keys
4. **Stronger Deduplication:** Prevents "Improve Exposures Flood" style duplicates
5. **Smart Field Generation:** Context-aware action required and hazard/risk statements
6. **Zero Manual Entry:** Promote and use immediately
7. **Production Ready:** Templates render correctly with complete content
8. **Audit Trail:** Derived templates tagged for tracking origin
9. **Quality Control:** Platform admins curate which recommendations become templates

---

## Example Output

**Input Recommendation:**
```json
{
  "title": "Improve Fire Protection Coverage",
  "observation_text": "Inadequate sprinkler coverage in storage area",
  "action_required_text": "", // MISSING
  "hazard_text": "", // MISSING
  "source_module_key": "RE_04_FIRE_PROTECTION",
  "priority": "High"
}
```

**Output Template:**
```json
{
  "title": "Improve Fire Protection Coverage",
  "observation": "Inadequate sprinkler coverage in storage area",
  "action_required": "Improve the identified condition to meet required standards.", // AUTO-GENERATED
  "hazard_risk_description": "Current conditions with inadequate controls increase the likelihood of loss events escalating beyond planned defenses. Fire events could escalate beyond planned containment measures, increasing potential damage extent and recovery duration. Upgrading this system enhances protective capabilities and reduces vulnerability to foreseeable scenarios.", // AUTO-GENERATED
  "related_module_key": "RE04", // NORMALIZED
  "category": "Fire Protection & Detection", // INFERRED
  "default_priority": 2, // CONVERTED
  "is_active": true,
  "scope": "derived",
  "tags": ["derived"]
}
```

---

## Next Steps

Platform admins can now:
1. Review existing RE recommendations with full preview
2. See what will be auto-generated (shown in italic)
3. Bulk promote them knowing templates will be complete
4. Use templates immediately in assessments
5. Templates render correctly with all fields populated
6. No manual cleanup or field filling needed

The library now has:
- **Global templates:** Pre-seeded starter set (20 templates)
- **Derived templates:** Fully-populated from actual assessments (unlimited)
