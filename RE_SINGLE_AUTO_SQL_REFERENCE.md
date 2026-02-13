# RE Single Auto-Recommendation SQL Reference

## Quick Reference: What Gets Created

When you rate a factor as **1 or 2**, ONE recommendation is inserted:

### Example: `process_control_and_stability` rated as 1

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
  status,
  photos
) VALUES (
  'abc-123-document-id',
  'auto',
  NULL,
  'process_control_and_stability',
  'process_control_and_stability',  -- NO SUFFIX
  'Improve Process Control And Stability',
  'Process Control And Stability has been identified as requiring attention based on current site conditions. Control effectiveness is below acceptable standards and requires corrective action.',
  'Review and implement improvements to bring Process Control And Stability up to acceptable standards. Address identified deficiencies through documented corrective actions with clear ownership and target dates.',
  'Inadequate controls increase the likelihood of loss events escalating beyond planned defenses. A foreseeable incident could develop faster than current safeguards allow, increasing damage extent and recovery time. Strengthening this control reduces overall facility risk profile.',
  'High',  -- Rating 1 = High
  'Open',
  '[]'
);
```

### Example: `fire_protection_systems` rated as 2

```sql
INSERT INTO re_recommendations (
  ...
  title: 'Improve Fire Protection Systems',
  observation_text: 'Fire Protection Systems has been identified as requiring attention...',
  action_required_text: 'Review and implement improvements to bring Fire Protection Systems...',
  hazard_text: 'Inadequate controls increase the likelihood of loss events...',  -- SAME TEXT
  priority: 'Medium',  -- Rating 2 = Medium
  ...
);
```

**Key Point:** hazard_text is IDENTICAL for rating 1 and 2. Only priority differs.

---

## Query to View All Autos (Non-Suppressed)

```sql
SELECT
  source_factor_key,
  title,
  priority,
  status,
  is_suppressed,
  SUBSTRING(hazard_text, 1, 80) || '...' as hazard_preview,
  created_at
FROM re_recommendations
WHERE document_id = 'your-document-id'
  AND source_type = 'auto'
  AND is_suppressed = false
ORDER BY rec_number;
```

Expected output:
```
source_factor_key                 | title                                    | priority | is_suppressed
----------------------------------+------------------------------------------+----------+--------------
process_control_and_stability     | Improve Process Control And Stability   | High     | f
fire_protection_systems           | Improve Fire Protection Systems         | Medium   | f
```

---

## Query to Check for Duplicates (Should Return 0)

```sql
SELECT
  source_factor_key,
  COUNT(*) as rec_count
FROM re_recommendations
WHERE document_id = 'your-document-id'
  AND source_type = 'auto'
  AND is_suppressed = false
GROUP BY source_factor_key
HAVING COUNT(*) > 1;
```

Expected: 0 rows (no duplicates per factor)

---

## Query to Verify No Suffixes (Should Return 0)

```sql
SELECT
  source_factor_key,
  title
FROM re_recommendations
WHERE document_id = 'your-document-id'
  AND source_type = 'auto'
  AND (
    source_factor_key LIKE '%__A'
    OR source_factor_key LIKE '%__B'
  );
```

Expected: 0 rows (no suffixed keys)

---

## Query to Check Hazard Population

```sql
SELECT
  source_factor_key,
  LENGTH(title) as title_len,
  LENGTH(observation_text) as obs_len,
  LENGTH(action_required_text) as action_len,
  LENGTH(hazard_text) as hazard_len,
  CASE
    WHEN title IS NULL OR title = '' THEN 'BLANK'
    WHEN observation_text IS NULL OR observation_text = '' THEN 'BLANK'
    WHEN action_required_text IS NULL OR action_required_text = '' THEN 'BLANK'
    WHEN hazard_text IS NULL OR hazard_text = '' THEN 'BLANK'
    ELSE 'COMPLETE'
  END as completeness
FROM re_recommendations
WHERE document_id = 'your-document-id'
  AND source_type = 'auto'
  AND is_suppressed = false;
```

Expected: All rows show `completeness = 'COMPLETE'`

---

## Query to Compare Rating 1 vs Rating 2 Text

```sql
-- Create test data with rating 1 and 2, then:
SELECT
  source_factor_key,
  priority,
  hazard_text
FROM re_recommendations
WHERE document_id = 'your-document-id'
  AND source_type = 'auto'
  AND is_suppressed = false
ORDER BY priority DESC;
```

Expected: All `hazard_text` values are identical (generic fallback), only priority differs.

---

## Query to View Suppressed Recommendations

```sql
SELECT
  source_factor_key,
  title,
  priority,
  is_suppressed,
  updated_at as deleted_at
FROM re_recommendations
WHERE document_id = 'your-document-id'
  AND source_type = 'auto'
  AND is_suppressed = true
ORDER BY updated_at DESC;
```

Shows deleted AUTO recommendations (hidden from UI but preserved in DB).

---

## Query to Simulate Display Numbering

```sql
-- This mimics what the UI does
WITH filtered AS (
  SELECT
    *,
    ROW_NUMBER() OVER (ORDER BY rec_number) as display_index
  FROM re_recommendations
  WHERE document_id = 'your-document-id'
    AND is_suppressed = false
)
SELECT
  rec_number as stored_number,
  CONCAT('2026-', LPAD(display_index::text, 2, '0')) as display_number,
  title
FROM filtered
ORDER BY display_index;
```

Example output:
```
stored_number | display_number | title
--------------+----------------+----------------------------------
2026-01       | 2026-01        | Improve Process Control
2026-03       | 2026-02        | Improve Fire Protection (renumbered in UI)
2026-05       | 2026-03        | Improve Electrical Systems
```

---

## Operations

### Soft Delete an AUTO Recommendation

```sql
UPDATE re_recommendations
SET
  is_suppressed = true,
  updated_at = NOW()
WHERE id = 'rec-id-here'
  AND source_type = 'auto';
```

Result: Hidden from UI, preserved in DB for audit.

### Hard Delete a MANUAL Recommendation

```sql
DELETE FROM re_recommendations
WHERE id = 'rec-id-here'
  AND source_type = 'manual';
```

Result: Permanently removed.

### Restore a Suppressed Recommendation

```sql
UPDATE re_recommendations
SET
  is_suppressed = false,
  updated_at = NOW()
WHERE id = 'rec-id-here';
```

Result: Reappears in UI with original rec_number.

### Count Active vs Suppressed

```sql
SELECT
  is_suppressed,
  source_type,
  COUNT(*) as count
FROM re_recommendations
WHERE document_id = 'your-document-id'
GROUP BY is_suppressed, source_type
ORDER BY is_suppressed, source_type;
```

Example output:
```
is_suppressed | source_type | count
--------------+-------------+-------
f             | auto        | 12
f             | manual      | 8
t             | auto        | 3
```

---

## Migration: Clean Up Old Dual Autos

If you have leftover `__A` / `__B` recommendations from previous implementation:

### Option 1: Suppress All Suffixed Autos

```sql
UPDATE re_recommendations
SET is_suppressed = true
WHERE source_type = 'auto'
  AND (
    source_factor_key LIKE '%__A'
    OR source_factor_key LIKE '%__B'
  );
```

Result: Old dual autos hidden, won't appear in RE-09.

### Option 2: Delete All Suffixed Autos (CAUTION)

```sql
DELETE FROM re_recommendations
WHERE source_type = 'auto'
  AND (
    source_factor_key LIKE '%__A'
    OR source_factor_key LIKE '%__B'
  );
```

Result: Permanently removed (no audit trail).

**Recommended:** Option 1 (suppression) for safety.

### Verify Cleanup

```sql
SELECT COUNT(*) as remaining_dual_autos
FROM re_recommendations
WHERE source_type = 'auto'
  AND (
    source_factor_key LIKE '%__A'
    OR source_factor_key LIKE '%__B'
  )
  AND is_suppressed = false;
```

Expected: 0 (no visible dual autos)

---

## Testing Queries

### Test 1: Verify Single Auto Creation

```sql
-- After rating a factor as 1
SELECT COUNT(*) as rec_count
FROM re_recommendations
WHERE document_id = 'your-doc-id'
  AND source_type = 'auto'
  AND source_factor_key = 'process_control_and_stability'
  AND is_suppressed = false;
-- Expected: 1
```

### Test 2: Verify Idempotency

```sql
-- After rating same factor as 1 twice
-- Query above should still return 1
```

### Test 3: Verify Same Hazard Text for Rating 1 & 2

```sql
-- Create one rec with rating 1, another with rating 2
SELECT
  source_factor_key,
  priority,
  hazard_text
FROM re_recommendations
WHERE source_type = 'auto'
  AND is_suppressed = false
ORDER BY priority DESC;
-- Verify hazard_text is identical
```

### Test 4: Verify Display Numbering Logic

```sql
-- Create 5 recs, delete #2, then check UI
-- DB should show: 2026-01, [suppressed], 2026-03, 2026-04, 2026-05
-- UI should show: 2026-01, 2026-02 (was 03), 2026-03 (was 04), 2026-04 (was 05)

SELECT
  rec_number,
  is_suppressed,
  title
FROM re_recommendations
WHERE document_id = 'your-doc-id'
ORDER BY rec_number;
```

---

## Performance Considerations

### Index Recommendations

```sql
-- For faster filtering by document + suppressed
CREATE INDEX idx_re_recs_doc_suppressed
ON re_recommendations (document_id, is_suppressed)
WHERE is_suppressed = false;

-- For faster lookup of auto recs by factor
CREATE INDEX idx_re_recs_auto_factor
ON re_recommendations (document_id, source_type, source_factor_key)
WHERE source_type = 'auto';
```

### Query Optimization

The display numbering logic happens **client-side** (in JavaScript), not in SQL. This is intentional:
- Avoids complex window functions
- Keeps DB queries simple and fast
- Makes filtering logic easier
- Reduces DB load

For very large recommendation sets (100+), consider pagination.

---

## Troubleshooting

### Issue: Duplicate Autos Appearing

**Check:**
```sql
SELECT source_factor_key, COUNT(*)
FROM re_recommendations
WHERE document_id = ?
  AND source_type = 'auto'
  AND is_suppressed = false
GROUP BY source_factor_key
HAVING COUNT(*) > 1;
```

**Fix:** Suppress duplicates, keep most recent:
```sql
-- Keep newest, suppress older
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY source_factor_key
      ORDER BY created_at DESC
    ) as rn
  FROM re_recommendations
  WHERE document_id = ?
    AND source_type = 'auto'
)
UPDATE re_recommendations
SET is_suppressed = true
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);
```

### Issue: Blank Hazard Text

**Check:**
```sql
SELECT id, title, hazard_text
FROM re_recommendations
WHERE source_type = 'auto'
  AND (hazard_text IS NULL OR hazard_text = '');
```

**Should return 0 rows.** If found, contact dev team (fallback logic failed).

### Issue: Display Numbers Not Contiguous

**Verify suppressed filter:**
```sql
SELECT COUNT(*) as suppressed_count
FROM re_recommendations
WHERE document_id = ?
  AND is_suppressed = true;
```

If count > 0, these are hidden from UI and cause "gaps" in stored rec_numbers.
Display numbering should compensate automatically.

---

## Summary

**Key Points:**
- ONE auto recommendation per factor (no suffixes)
- SAME text for rating 1 and 2 (only priority differs)
- `is_suppressed` hides deleted autos (preserves audit trail)
- Display numbering is UI-only (doesn't touch DB)
- All fields always populated (fallback guarantees)

**Database stays immutable, UI shows user-friendly view.**
