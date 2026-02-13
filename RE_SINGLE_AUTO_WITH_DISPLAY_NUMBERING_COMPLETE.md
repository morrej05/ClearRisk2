# RE Single Auto-Recommendation + Display Numbering Implementation

## Summary
Reverted to single auto-recommendation per factor with consistent wording for ratings 1 & 2, and implemented contiguous display numbering in RE-09 that adjusts after deletions (UI-only, no DB renumbering).

## What Changed

### Before (Dual Auto System)
- TWO recommendations per factor (`__A` and `__B` suffixes)
- Different hazard text for rating 1 vs 2
- Library id set when using templates
- rec_number displayed directly from database

### After (Single Auto System)
- **ONE recommendation per factor** (no suffixes)
- **Same wording for rating 1 and 2** (only priority differs)
- **Always fully populated** (title/observation/action/hazard)
- **Suppressed rows hidden** from RE-09
- **Contiguous display numbering** (UI-only, after filtering)

---

## Part A: Pipeline Changes

### File Modified
`src/lib/re/recommendations/recommendationPipeline.ts`

### 1. Removed Dual Auto Logic
**Deleted:**
- `generateDualRatingTemplates()` function
- Suffix logic (`__A`, `__B`)
- Loop that created two recommendations

**Result:** Each factor now creates exactly ONE recommendation.

### 2. New Fallback Content Generator
**Added:** `buildFallbackContent(factorKey)`

Returns fully populated recommendation content:
```typescript
{
  title: "Improve Process Control And Stability",
  observation_text: "Process Control And Stability has been identified as requiring attention based on current site conditions. Control effectiveness is below acceptable standards and requires corrective action.",
  action_required_text: "Review and implement improvements to bring Process Control And Stability up to acceptable standards. Address identified deficiencies through documented corrective actions with clear ownership and target dates.",
  hazard_text: "Inadequate controls increase the likelihood of loss events escalating beyond planned defenses. A foreseeable incident could develop faster than current safeguards allow, increasing damage extent and recovery time. Strengthening this control reduces overall facility risk profile."
}
```

**Key Feature:** SAME text for rating 1 and rating 2. Only priority differs:
- Rating 1 → Priority: High
- Rating 2 → Priority: Medium

### 3. Updated `ensureRecommendationFromRating()`
**Simplified flow:**
1. Check if rating ≤ 2 (else return null)
2. Check if auto rec already exists (idempotent)
3. Try to find library template
4. If found: create from library (with fallback for blank fields)
5. If not found: create with fallback content
6. Return recommendation ID

**Idempotent Check:**
```typescript
const { data: existing } = await supabase
  .from('re_recommendations')
  .select('id')
  .eq('document_id', documentId)
  .eq('source_type', 'auto')
  .eq('source_module_key', sourceModuleKey)
  .eq('source_factor_key', sourceFactorKey || null)
  .maybeSingle();
```

**No suffixes** in factor keys.

### 4. Enhanced Library Integration
**Updated:** `createRecommendationFromLibrary()`

Now uses fallback for ANY blank library fields:
```typescript
title: libraryTemplate.title || fallback.title,
observation_text: libraryTemplate.observation_text || fallback.observation_text,
action_required_text: libraryTemplate.action_required_text || fallback.action_required_text,
hazard_text: libraryTemplate.hazard_text || fallback.hazard_text,
```

**Guarantees:** No blank fields in auto recommendations.

### 5. Simplified Basic Recommendations
**Updated:** `createBasicRecommendation()`

Now just uses fallback content directly:
```typescript
const content = buildFallbackContent(sourceFactorKey || sourceModuleKey);
// Insert with content.title, content.observation_text, etc.
```

---

## Part B: RE-09 Display Changes

### File Modified
`src/components/modules/forms/RE09RecommendationsForm.tsx`

### 1. Filter Suppressed Recommendations
**Added** to `loadRecommendations()`:
```typescript
.eq('is_suppressed', false)
```

**Result:** Deleted auto recommendations (marked `is_suppressed=true`) don't appear in RE-09.

### 2. Contiguous Display Numbering
**Added** `getDisplayNumber()` function:
```typescript
const getDisplayNumber = (rec: Recommendation): string => {
  const index = filteredRecommendations.findIndex(r => r.id === rec.id);
  if (index === -1) return rec.rec_number || 'New';

  const year = document.assessment_date
    ? new Date(document.assessment_date).getFullYear()
    : new Date().getFullYear();
  const displayNum = String(index + 1).padStart(2, '0');
  return `${year}-${displayNum}`;
};
```

**How it works:**
1. Finds recommendation's position in **filtered** list
2. Computes display number as `index + 1`
3. Formats as `YYYY-NN` (e.g., `2026-01`, `2026-02`)
4. Returns this for **display only**

**Important:** Database `rec_number` remains unchanged.

### 3. Updated Display Locations
**Replaced** `rec.rec_number` with `getDisplayNumber(rec)` in:
- Editor view header (line 584)
- Active recommendations table (line 900)
- Completed recommendations table (line 968)

**Result:** UI shows contiguous numbering that adjusts after deletions.

---

## Example Scenarios

### Scenario 1: Create Auto Recommendation
**Action:** Rate `process_control` as 1 in RE-03

**Database Insert:**
```sql
INSERT INTO re_recommendations (
  document_id,
  source_type,
  library_id,
  source_module_key,
  source_factor_key,
  title,
  observation_text,
  action_required_text,
  hazard_text,
  priority,
  status
) VALUES (
  'doc-123',
  'auto',
  NULL,
  'process_control',
  'process_control',  -- NO SUFFIX
  'Improve Process Control',
  'Process Control has been identified as requiring attention based on current site conditions...',
  'Review and implement improvements to bring Process Control up to acceptable standards...',
  'Inadequate controls increase the likelihood of loss events escalating beyond planned defenses...',
  'High',  -- Rating 1 = High priority
  'Open'
);
```

**RE-09 Display:**
- Shows as `2026-01` (if first recommendation)
- Fully populated title/observation/action/hazard
- Priority badge shows "High"
- Purple border (AUTO)

### Scenario 2: Rate Same Factor as 2
**Action:** Change rating from 1 to 2

**Result:**
- No new recommendation created (idempotent)
- Existing recommendation unchanged
- Priority remains "High" (not updated)

**Note:** Current implementation doesn't update priority on re-rating. This is intentional to preserve engineer edits.

### Scenario 3: Rate Different Factor as 2
**Action:** Rate `fire_protection_systems` as 2 in RE-06

**Database Insert:**
```sql
INSERT INTO re_recommendations (
  ...
  title: 'Improve Fire Protection Systems',
  hazard_text: 'Inadequate controls increase the likelihood of loss events...',  -- SAME TEXT as rating 1
  priority: 'Medium',  -- Rating 2 = Medium priority
  ...
);
```

**RE-09 Display:**
- Shows as `2026-02` (if second recommendation)
- Priority badge shows "Medium"
- Same hazard text as rating 1 recommendations

### Scenario 4: Delete a Recommendation
**Action:** Delete recommendation `2026-02`

**Database:**
- AUTO rec: Updated to `is_suppressed=true`
- MANUAL rec: Deleted from database

**RE-09 Display BEFORE:**
```
2026-01: Improve Process Control
2026-02: Improve Fire Protection Systems
2026-03: Improve Electrical Systems
```

**RE-09 Display AFTER:**
```
2026-01: Improve Process Control
2026-02: Improve Electrical Systems  ← Renumbered in UI only
```

**Important:** Database `rec_number` values unchanged. Only display logic adjusted.

### Scenario 5: Filter to Active Only
**Action:** Click "Active" filter button

**Result:**
- Completed recommendations hidden
- Display numbering recalculates for visible items only
- Example: If items 1, 3, 5 are active, they display as `2026-01`, `2026-02`, `2026-03`

---

## Database Impact

### Schema Alignment
**Columns Used:**
- ✅ `document_id` (FK)
- ✅ `source_type` = 'auto'
- ✅ `library_id` (null for fallback, ID for library)
- ✅ `source_module_key` (canonical key, NO suffix)
- ✅ `source_factor_key` (canonical key, NO suffix)
- ✅ `title` (verb-first)
- ✅ `observation_text` (1-2 sentences)
- ✅ `action_required_text` (1-2 sentences)
- ✅ `hazard_text` (2-3 sentences, always populated)
- ✅ `priority` ('High' | 'Medium')
- ✅ `status` ('Open')
- ✅ `is_suppressed` (false for visible, true for deleted)
- ✅ `rec_number` (stored value, NOT updated)

### Query Changes
**Load Recommendations:**
```sql
SELECT * FROM re_recommendations
WHERE document_id = ?
  AND is_suppressed = false  -- NEW: hide deleted
ORDER BY rec_number ASC;
```

**Delete AUTO Recommendation:**
```sql
UPDATE re_recommendations
SET is_suppressed = true
WHERE id = ?;
```

**Delete MANUAL Recommendation:**
```sql
DELETE FROM re_recommendations
WHERE id = ?;
```

---

## Testing Guide

### Test 1: Single Auto Creation
1. Open RE document
2. Navigate to RE-03 Occupancy
3. Rate `process_control_and_stability` as 1
4. Navigate to RE-09
5. **Verify:**
   - Exactly ONE auto recommendation appears
   - Title: "Improve Process Control And Stability"
   - Hazard text is 2-3 sentences
   - Priority: High
   - No blank fields

### Test 2: Idempotency
1. Return to RE-03
2. Rate same factor as 1 again
3. Navigate to RE-09
4. **Verify:**
   - Still only ONE recommendation
   - No duplicates created

### Test 3: Same Wording for Rating 1 & 2
1. Rate `fire_protection_systems` as 1
2. Note the recommendation text in RE-09
3. Create new document
4. Rate `fire_protection_systems` as 2
5. **Verify:**
   - Title: Same
   - Observation: Same
   - Action: Same
   - Hazard: Same (exact wording)
   - Priority: Different (1=High, 2=Medium)

### Test 4: Display Numbering
1. Create 5 recommendations (mix of auto and manual)
2. **Verify initial display:**
   ```
   2026-01
   2026-02
   2026-03
   2026-04
   2026-05
   ```
3. Delete recommendation 2026-02
4. **Verify updated display:**
   ```
   2026-01
   2026-02  ← was 2026-03
   2026-03  ← was 2026-04
   2026-04  ← was 2026-05
   ```

### Test 5: Suppressed Filter
1. Delete an AUTO recommendation
2. Query database:
   ```sql
   SELECT id, title, is_suppressed
   FROM re_recommendations
   WHERE document_id = ?;
   ```
3. **Verify:**
   - Deleted AUTO rec shows `is_suppressed=true`
   - Still exists in database
   - Does NOT appear in RE-09

### Test 6: Filter Modes
1. Mark some recommendations as Completed
2. Switch between "All" / "Active" / "Completed" filters
3. **Verify:**
   - Display numbering recalculates for each filter
   - Active filter: `2026-01, 2026-02, 2026-03`
   - Completed filter: `2026-01, 2026-02` (separate numbering)

---

## SQL Queries for Verification

### Check for Duplicate Autos
```sql
SELECT
  source_factor_key,
  COUNT(*) as rec_count
FROM re_recommendations
WHERE document_id = 'your-doc-id'
  AND source_type = 'auto'
  AND is_suppressed = false
GROUP BY source_factor_key
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)
```

### Verify No Suffixes
```sql
SELECT source_factor_key
FROM re_recommendations
WHERE document_id = 'your-doc-id'
  AND source_type = 'auto'
  AND (source_factor_key LIKE '%__A' OR source_factor_key LIKE '%__B');
-- Expected: 0 rows (no suffixes)
```

### Check Hazard Text Populated
```sql
SELECT
  id,
  title,
  LENGTH(hazard_text) as hazard_length,
  CASE
    WHEN hazard_text IS NULL OR hazard_text = '' THEN 'BLANK'
    ELSE 'OK'
  END as hazard_status
FROM re_recommendations
WHERE document_id = 'your-doc-id'
  AND source_type = 'auto';
-- Expected: All rows show hazard_status = 'OK'
```

### Compare Rating 1 vs Rating 2 Text
```sql
-- Create two factors with different ratings
-- Then compare:
SELECT
  source_factor_key,
  priority,
  hazard_text
FROM re_recommendations
WHERE document_id = 'your-doc-id'
  AND source_type = 'auto'
ORDER BY priority DESC;
-- Expected: hazard_text is identical except priority differs
```

---

## Architecture Notes

### Why Single Recommendation?
**Previous dual system issues:**
- Cluttered action register
- Engineers confused by A/B split
- Difficult to track completion status
- Double-counted metrics

**Single recommendation benefits:**
- Clear 1-to-1 mapping (factor → recommendation)
- Easier to manage and track
- Cleaner metrics (total count)
- Professional output reports

### Why Same Wording for Rating 1 & 2?
**Reasoning:**
- Engineers set priority based on site-specific context
- Generic templates shouldn't pre-judge severity
- Consistent messaging across all deficiencies
- Priority field explicitly shows importance

**Priority distinction sufficient:**
- High = needs immediate attention
- Medium = needs attention in reasonable timeframe

### Why Display Numbering (UI-only)?
**Alternative considered:** Renumber database on every delete

**Problems with DB renumbering:**
- Breaks audit trail (reference numbers change)
- External systems may reference old numbers
- Historical reports become inconsistent
- Complex migration on every delete

**Display numbering benefits:**
- Database remains immutable audit log
- UI shows user-friendly contiguous sequence
- No breaking changes to existing data
- Simple to implement and maintain

### Why Filter Suppressed?
**Alternative considered:** Hard delete AUTO recommendations

**Problems with hard delete:**
- Loses history of what was auto-generated
- Can't track engineer changes over time
- No audit trail for compliance

**Suppression benefits:**
- Preserves complete history
- Supports future "restore" feature
- Audit-friendly (shows what was deleted when)
- Enables historical analysis

---

## Files Modified

### 1. `/src/lib/re/recommendations/recommendationPipeline.ts`
**Changes:**
- Removed dual auto logic and suffixes
- Added `buildFallbackContent()` helper
- Simplified `ensureRecommendationFromRating()` to create ONE rec
- Enhanced library integration with fallback
- Updated `createBasicRecommendation()` to use fallback

**Lines changed:** ~150 lines

### 2. `/src/components/modules/forms/RE09RecommendationsForm.tsx`
**Changes:**
- Added `.eq('is_suppressed', false)` filter to query
- Added `getDisplayNumber()` helper function
- Updated 3 display locations to use `getDisplayNumber(rec)`

**Lines changed:** ~20 lines

---

## Build Status
✅ Build successful (18.77s)
✅ No TypeScript errors
✅ No linting issues
✅ All imports resolved

---

## Migration Notes

### Existing Dual Autos
If you have existing `__A` / `__B` recommendations in database:

**Option 1: Leave as-is**
- Will continue to appear in RE-09
- New ratings won't create duplicates (different keys)
- Engineers can manually delete old suffixed ones

**Option 2: Clean up (SQL)**
```sql
-- Mark all suffixed autos as suppressed
UPDATE re_recommendations
SET is_suppressed = true
WHERE source_type = 'auto'
  AND (source_factor_key LIKE '%__A' OR source_factor_key LIKE '%__B');
```

**Recommended:** Option 2 for clean slate.

---

## Future Enhancements

### 1. Priority Update on Re-rating
Could update priority if rating changes:
```typescript
if (existing) {
  await supabase
    .from('re_recommendations')
    .update({ priority })
    .eq('id', existing.id);
  return existing.id;
}
```

**Trade-off:** Overwrites engineer manual priority changes.

### 2. Custom Factor Templates
Add specific content for known factors:
```typescript
const factorTemplates = {
  'process_control_and_stability': {
    title: 'Improve Process Control & Stability',
    hazard_text: 'Loss of process control can lead to...'
  },
  // etc.
};
```

### 3. Industry-Specific Content
Use `industryKey` to tailor recommendations:
```typescript
const content = buildFallbackContent(factorKey, industryKey);
```

### 4. Restore Suppressed
Add UI button to restore deleted autos:
```sql
UPDATE re_recommendations
SET is_suppressed = false
WHERE id = ?;
```

---

## Done Criteria ✅

- [x] Single auto recommendation per factor (no suffixes)
- [x] Same wording for rating 1 and 2
- [x] Only priority differs (High vs Medium)
- [x] All fields always populated (title/observation/action/hazard)
- [x] Suppressed recommendations hidden from RE-09
- [x] Contiguous display numbering (UI-only)
- [x] Database rec_number unchanged
- [x] Idempotent (no duplicates on re-rating)
- [x] Library integration with fallback
- [x] Build successful
- [x] No TypeScript errors
- [x] Documentation complete
