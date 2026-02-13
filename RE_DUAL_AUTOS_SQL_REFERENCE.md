# RE Dual Auto-Recommendations SQL Reference

## Quick Reference: What Gets Created

When you rate a factor as **1 or 2**, TWO recommendations are inserted:

### Example: `process_control_and_stability` rated as 1

```sql
-- Recommendation A (Action-focused)
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
  'process_control_and_stability__A',
  'Improve Process Control And Stability',
  'Process Control And Stability is currently rated as Critical (rating 1/5). This indicates a critical control gap that requires attention.',
  'Review and implement improvements to bring Process Control And Stability up to acceptable standards. Address identified deficiencies through documented corrective actions.',
  'Current conditions indicate a critical control gap. A fire or equipment failure may escalate rapidly, increasing the likelihood of major loss and prolonged shutdown. Immediate corrective action is required to reduce exposure.',
  'High',
  'Open',
  '[]'
);

-- Recommendation B (Assurance-focused)
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
  'process_control_and_stability__B',
  'Strengthen assurance for Process Control And Stability',
  'The rating of 1/5 for Process Control And Stability reflects insufficient verification or monitoring of control effectiveness.',
  'Establish ongoing assurance mechanisms for Process Control And Stability. Implement regular reviews, testing schedules, or monitoring protocols to maintain control integrity.',
  'Current conditions indicate a critical control gap. A fire or equipment failure may escalate rapidly, increasing the likelihood of major loss and prolonged shutdown. Immediate corrective action is required to reduce exposure.',
  'High',
  'Open',
  '[]'
);
```

## Query to View All Dual Autos

```sql
SELECT
  source_factor_key,
  title,
  priority,
  status,
  SUBSTRING(hazard_text, 1, 80) || '...' as hazard_preview,
  created_at
FROM re_recommendations
WHERE document_id = 'your-document-id'
  AND source_type = 'auto'
  AND library_id IS NULL
ORDER BY source_factor_key;
```

Expected output:
```
source_factor_key                        | title                                           | priority | status
-----------------------------------------+-------------------------------------------------+----------+--------
process_control_and_stability__A         | Improve Process Control And Stability          | High     | Open
process_control_and_stability__B         | Strengthen assurance for Process Control...    | High     | Open
```

## Query to Count Autos Per Factor

```sql
SELECT
  REGEXP_REPLACE(source_factor_key, '__(A|B)$', '') as base_factor,
  COUNT(*) as auto_count,
  MAX(priority) as highest_priority
FROM re_recommendations
WHERE document_id = 'your-document-id'
  AND source_type = 'auto'
  AND library_id IS NULL
GROUP BY base_factor
ORDER BY base_factor;
```

## Query to Check Idempotency

Run this BEFORE and AFTER rating the same factor twice:

```sql
SELECT
  source_factor_key,
  created_at,
  updated_at
FROM re_recommendations
WHERE document_id = 'your-document-id'
  AND source_type = 'auto'
  AND source_factor_key LIKE '%process_control%'
ORDER BY created_at;
```

Should show same 2 rows with unchanged `created_at` timestamps.

## Filter Queries

### Get only Action-focused recs:
```sql
SELECT * FROM re_recommendations
WHERE source_factor_key LIKE '%__A'
  AND source_type = 'auto';
```

### Get only Assurance-focused recs:
```sql
SELECT * FROM re_recommendations
WHERE source_factor_key LIKE '%__B'
  AND source_type = 'auto';
```

### Get all autos for a specific base factor:
```sql
SELECT * FROM re_recommendations
WHERE source_factor_key LIKE 'process_control_and_stability__%'
  AND source_type = 'auto';
```

## Text Comparison: Rating 1 vs Rating 2

### Rating = 1 (Critical)

**Hazard Text:**
> Current conditions indicate a critical control gap. A fire or equipment failure may escalate rapidly, increasing the likelihood of major loss and prolonged shutdown. Immediate corrective action is required to reduce exposure.

**Priority:** High

### Rating = 2 (Below Standard)

**Hazard Text:**
> Controls are below standard. A foreseeable event could develop faster than planned defenses, increasing damage extent and recovery time. Improvements should be implemented to strengthen resilience.

**Priority:** Medium

## Schema Alignment

Columns used:
- ✅ `document_id` (FK to documents)
- ✅ `source_type` = 'auto'
- ✅ `library_id` = NULL
- ✅ `source_module_key` (canonical key)
- ✅ `source_factor_key` (canonical key + __A or __B)
- ✅ `title` (verb-first)
- ✅ `observation_text` (context)
- ✅ `action_required_text` (what to do)
- ✅ `hazard_text` (why it matters, 2-3 sentences)
- ✅ `priority` ('High' | 'Medium')
- ✅ `status` ('Open')
- ✅ `photos` ([])

Columns NOT used:
- ❌ `organisation_id` (if exists in schema, will be NULL or set by DB)
- ❌ Other optional fields

## Testing SQL

### 1. Check dual creation:
```sql
-- After rating a factor as 1
SELECT COUNT(*) as rec_count
FROM re_recommendations
WHERE document_id = 'your-doc-id'
  AND source_module_key = 'your_canonical_key'
  AND source_type = 'auto';
-- Expected: 2
```

### 2. Verify suffixes:
```sql
SELECT source_factor_key
FROM re_recommendations
WHERE document_id = 'your-doc-id'
  AND source_module_key = 'your_canonical_key'
  AND source_type = 'auto';
-- Expected: your_canonical_key__A, your_canonical_key__B
```

### 3. Check library_id is null:
```sql
SELECT source_factor_key, library_id
FROM re_recommendations
WHERE document_id = 'your-doc-id'
  AND source_type = 'auto';
-- Expected: All library_id values are NULL
```

### 4. Verify hazard length:
```sql
SELECT
  source_factor_key,
  LENGTH(hazard_text) as char_count,
  LENGTH(hazard_text) - LENGTH(REPLACE(hazard_text, '.', '')) as sentence_count
FROM re_recommendations
WHERE source_type = 'auto'
  AND document_id = 'your-doc-id';
-- Expected: char_count > 100, sentence_count >= 2
```
