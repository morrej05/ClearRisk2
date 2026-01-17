# Recommendation Templates CSV Import System

## Overview

The system now supports importing recommendation templates from CSV files. This allows bulk seeding and updating of the recommendation library without manual database operations.

## Components Implemented

### 1. Edge Function: `seed-recommendation-templates`
- **Location**: `supabase/functions/seed-recommendation-templates/index.ts`
- **Purpose**: Processes CSV data and upserts into `recommendation_templates` table
- **Security**: Only accessible to super admins (verified via `super_admins` table)
- **Deployed**: Yes (using Supabase Edge Functions)

### 2. Admin UI Component: `RecommendationCSVImport`
- **Location**: `src/components/RecommendationCSVImport.tsx`
- **Purpose**: Provides drag-and-drop CSV upload interface
- **Features**:
  - File upload with validation
  - CSV parsing with proper quote handling
  - Real-time import progress
  - Detailed summary (inserted, updated, skipped counts)
  - Error reporting
- **Integrated**: Added to Super Admin Dashboard → Recommendation Library section

### 3. Database Migration
- **Location**: `supabase/migrations/seed_recommendation_templates_from_csv_v2.sql`
- **Purpose**: Creates unique index for upsert operations
- **Index**: `(scope, hazard, LEFT(description, 255))`

## CSV Format Requirements

The CSV file must have the following columns (in any order):

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `hazard` | text | Yes | Hazard identification (e.g., "Hot Work", "DSEAR") |
| `description` | text | Yes | Detailed observation/description |
| `action` | text | Yes | Recommended corrective action |
| `client_response_prompt` | text | Yes | Default prompt for client response |
| `category` | text | Yes | One of: "Management Systems", "Fire Protection & Detection", "Construction", "Special Hazards", "Business Continuity" |
| `default_priority` | int | Yes | Priority level (1-5) |
| `is_active` | boolean | Yes | Active status (true/false) |
| `scope` | text | Yes | Scope identifier (e.g., "global") |

### Example CSV Row

```csv
hazard,description,action,client_response_prompt,category,default_priority,is_active,scope
"Hot Work","There is no formal hot work permit system in use on site.","Develop a comprehensive hot work permit to work procedure.","Site Response","Management Systems",3,true,global
```

## How to Use

### Step 1: Prepare CSV File
1. Create or export your CSV file with the required columns
2. Ensure all required fields are populated
3. Use proper CSV escaping for fields containing commas or quotes
4. Verify category names match exactly (case-sensitive)

### Step 2: Access Super Admin Dashboard
1. Sign in as a super admin user
2. Navigate to: **Dashboard → Super Admin → Recommendation Library**
3. The CSV import panel appears at the top of the page

### Step 3: Upload CSV
1. Click "Choose CSV File" button or drag and drop file
2. System automatically:
   - Parses CSV data
   - Validates format
   - Sends to Edge Function
   - Displays progress

### Step 4: Review Results
After import completes, you'll see:
- **Total Rows**: Number of rows in CSV
- **Inserted**: New templates created
- **Updated**: Existing templates updated
- **Skipped**: Rows that failed (with error details)

## Upsert Logic

The system uses intelligent upsert logic to avoid duplicates:

### Matching Criteria
A template is considered "existing" if it matches on:
- `scope` (exact match)
- `hazard` (exact match)
- First 100 characters of `description` (case-insensitive)

### Update vs Insert
- **If match found**: Updates all fields except ID and timestamps
- **If no match**: Inserts as new template

### Benefits
- Re-importing same CSV updates existing records
- No duplicate templates created
- Safe to run multiple times

## API Details

### Endpoint
```
POST {SUPABASE_URL}/functions/v1/seed-recommendation-templates
```

### Headers
```
Authorization: Bearer {USER_JWT_TOKEN}
Content-Type: application/json
```

### Request Body
```json
{
  "csvData": [
    {
      "hazard": "Hot Work",
      "description": "...",
      "action": "...",
      "client_response_prompt": "Site Response",
      "category": "Management Systems",
      "default_priority": 3,
      "is_active": true,
      "scope": "global"
    }
  ]
}
```

### Response (Success)
```json
{
  "success": true,
  "summary": {
    "total": 165,
    "inserted": 150,
    "updated": 10,
    "skipped": 5
  },
  "errors": [
    "Insert failed for \"XYZ\": category constraint violation"
  ]
}
```

### Response (Error)
```json
{
  "error": "Only super admins can seed templates"
}
```

## Security Features

1. **Authentication Required**: Must have valid JWT token
2. **Super Admin Only**: Verified against `super_admins` table
3. **RLS Protected**: Database policies enforce access control
4. **Input Validation**: CSV data validated before processing
5. **Error Handling**: Graceful failure with detailed error messages

## Troubleshooting

### Common Issues

**Problem**: "Only super admins can seed templates"
- **Solution**: Ensure your user ID exists in `super_admins` table

**Problem**: "Invalid CSV data format"
- **Solution**: Check CSV has all required columns with correct names

**Problem**: Category constraint violation
- **Solution**: Verify category matches one of the 5 valid options exactly

**Problem**: High skipped count
- **Solution**: Review errors array in response for specific issues

### Validation Tips

1. **Test with small CSV first**: Try 5-10 rows before full import
2. **Check encoding**: Use UTF-8 encoding for CSV files
3. **Verify quotes**: Ensure proper escaping of commas and quotes
4. **Review categories**: Must match database constraint exactly

## Seeding the Initial 165 Templates

The provided CSV file (`recommendation_templates_seed.csv`) contains 165 pre-defined templates from Endurance Risk Management standards.

To seed these:
1. Navigate to Super Admin → Recommendation Library
2. Upload the `recommendation_templates_seed.csv` file
3. Wait for completion (typically 10-30 seconds)
4. Verify summary shows successful import

Expected results:
- Total: 165
- Inserted: 165 (first run)
- Updated: 0 (first run)
- Skipped: 0 (if no errors)

## Future Enhancements

Potential improvements:
- Batch processing for very large CSV files
- Export existing templates to CSV
- Template preview before import
- Duplicate detection warnings
- Bulk deactivation/activation
- Import history/audit log

## Related Files

- Edge Function: `supabase/functions/seed-recommendation-templates/index.ts`
- UI Component: `src/components/RecommendationCSVImport.tsx`
- Dashboard: `src/pages/SuperAdminDashboard.tsx`
- Migration: `supabase/migrations/seed_recommendation_templates_from_csv_v2.sql`
- Sample CSV: `recommendation_templates_seed.csv`
