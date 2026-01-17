# Legacy Auto-Recommendation Triggers

This document explains how the legacy auto-recommendation system works and how it integrates with the Smart Recommendations table.

## Overview

The system automatically generates recommendations when certain survey fields are rated as "Poor," "Inadequate," "Unreliable," or "Tolerable" (depending on the field). These auto-generated recommendations are now routed through the `survey_recommendations` table for unified management.

## How It Works

### 1. Legacy Mapping

All legacy recommendation mappings are stored in: `src/data/legacyRecommendationMap.json`

Each mapping contains:
- `field_key`: The survey field that triggers the recommendation
- `section_key`: The section code where the field appears (e.g., FP_09_Management)
- `trigger_values`: Array of rating values that trigger the recommendation (e.g., ["Poor", "Inadequate"])
- `category`: One of 5 categories (Management Systems, Fire Protection & Detection, etc.)
- `hazard`: Short hazard identification
- `observation`: Observation text describing the issue
- `action_text`: Recommended action to address the issue
- `priority`: Priority level (1-5, where 5 is critical)

### 2. Database Schema

The `survey_recommendations` table includes special fields for triggered recommendations:

```sql
-- Unique identifier for auto-triggered recommendations
trigger_key text NULL
  Format: "{survey_id}:{section_key}:{field_key}:{rating_value}"
  Or for building-specific: "{survey_id}:{section_key}:{field_key}:{building_id}"

-- JSON context about what triggered this recommendation
trigger_context jsonb NULL
  Contains: {
    section_key,
    field_key,
    rating_value,
    building_id (optional),
    building_name (optional)
  }
```

**Unique Constraint:**
- Each `trigger_key` is unique per survey (via unique index)
- Prevents duplicate triggered recommendations

### 3. Triggering Logic

When a user changes a rating field:

1. **Detection**: The system checks if the rating change should trigger a recommendation using `shouldTriggerRecommendation()`

2. **Upsert**: If triggered, the system calls `handleLegacyTrigger()` which:
   - Creates a unique `trigger_key` for this trigger
   - Checks if a recommendation with this `trigger_key` already exists
   - If exists: Updates it (ensures it's active, open, and included in report)
   - If new: Inserts a new recommendation with `source='triggered'`

3. **Deactivation**: When a rating improves (e.g., Poor → Adequate):
   - Sets `include_in_report=false`
   - Sets `status='deferred'`
   - Does NOT delete (preserves history)

### 4. Implementation Files

**Core Logic:**
- `src/utils/legacyTriggers.ts` - Main trigger handling logic
- `src/data/legacyRecommendationMap.json` - All trigger mappings

**Integration Points:**
- `src/components/NewSurveyReport.tsx` - Calls trigger logic in useEffect hooks

### 5. Triggered Fields

**Management Systems (FP_09_Management):**
- commitmentLossPrevention_rating
- controlHotWork_rating
- electricalMaintenance_rating
- generalMaintenance_rating
- smokingControls_rating
- fireSafetyHousekeeping_rating
- selfInspections_rating
- changeManagement_rating
- contractorControls_rating
- emergencyResponse_rating
- fireEquipmentTesting_rating
- impairmentHandling_rating

**Fire Protection (FP_06_FireProtection):**
- fireDetectionNotes_rating
- fire_protection_adequacy (per building)

**Firefighting Access (FP_07_FirefightingAccess):**
- fireHydrantNotes_rating
- waterSupplyNotes_rating
- water_supply_reliability (per building)

**Business Continuity (FP_11_Summary):**
- bcp_rating

### 6. User Experience

**From User Perspective:**

1. User selects "Poor" or "Inadequate" for a rating field
2. Recommendation automatically appears in Smart Recommendations table
3. Recommendation has `source='triggered'` badge
4. User can edit, add client response, change priority, etc.
5. Recommendation flows to report via normal workflow

**Key Benefits:**

- Single source of truth: All recommendations in one table
- Editable: Users can customize auto-generated text
- Trackable: Full audit trail with trigger context
- No duplicates: Unique constraint prevents multiple identical triggers
- Preserves history: Deactivated instead of deleted

### 7. Future Enhancements

Possible future improvements:
- Allow users to customize trigger mappings
- Add more sophisticated trigger conditions
- Enable/disable specific triggers per organization
- Create template library based on triggered recommendations

## Example Flow

```typescript
// 1. User changes rating
formData.controlHotWork_rating = 'Poor'

// 2. System detects trigger
shouldTriggerRecommendation('controlHotWork_rating', 'Adequate', 'Poor') // true

// 3. System handles trigger
await handleLegacyTrigger(
  surveyId: '123-456',
  fieldKey: 'controlHotWork_rating',
  newValue: 'Poor',
  oldValue: 'Adequate'
)

// 4. Recommendation created/updated in survey_recommendations
{
  survey_id: '123-456',
  trigger_key: '123-456:FP_09_Management:controlHotWork_rating',
  trigger_context: {
    section_key: 'FP_09_Management',
    field_key: 'controlHotWork_rating',
    rating_value: 'Poor'
  },
  hazard: 'Hot Work Controls',
  description_final: 'Hot work activities present ignition risks...',
  action_final: 'Implement a formal hot work permit system...',
  category: 'Management Systems',
  priority: 4,
  source: 'triggered',
  status: 'open',
  include_in_report: true
}

// 5. Appears immediately in Smart Recommendations table
// 6. User can edit, respond, and include in final report
```

## Maintenance Notes

**Adding New Triggers:**
1. Add mapping to `legacyRecommendationMap.json`
2. Add field to monitoring in `NewSurveyReport.tsx` useEffect
3. Test that trigger creates recommendation correctly

**Modifying Existing Triggers:**
1. Update mapping in `legacyRecommendationMap.json`
2. Changes apply to new triggers immediately
3. Existing triggered recommendations preserve their snapshot text

**Debugging:**
- Check browser console for trigger errors
- Query `survey_recommendations` for `source='triggered'`
- Inspect `trigger_context` field for trigger details
- Look for `trigger_key` format errors
