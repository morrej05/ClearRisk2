# RE-06 Fire Protection UI Fix — Complete

## Status: ✅ Fixed

The RE-06 Fire Protection form now renders the correct UI instead of BuildingsGrid.

---

## File Modified

**ONLY FILE CHANGED**: `src/components/modules/forms/RE06FireProtectionForm.tsx`

---

## Changes Made

### 1. Removed BuildingsGrid as Primary UI (Line 293)

**Before**:
```typescript
export default function RE06FireProtectionForm({
  moduleInstance,
  document,
  onSaved
}: RE06FireProtectionFormProps) {
  return <BuildingsGrid documentId={document.id} mode="fire_protection" onAfterSave={onSaved} />;
  const [isSaving, setIsSaving] = useState(false);
  // ... rest of code was unreachable
```

**After**:
```typescript
export default function RE06FireProtectionForm({
  moduleInstance,
  document,
  onSaved
}: RE06FireProtectionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  // ... rest of code now executes
```

---

### 2. Added Missing Imports (Lines 1-24)

**Added**:
```typescript
import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Flame, Shield, Bell, CheckCircle2, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import RatingButtons from '../../re/RatingButtons';
import SectionGrade from '../../SectionGrade';
import FloatingSaveBar from './FloatingSaveBar';

async function updateSectionGrade(documentId: string, sectionKey: string, value: number) {
  // ... implementation
}
```

**Removed**:
```typescript
import BuildingsGrid from "../../re/BuildingsGrid";
```

---

### 3. Removed Impairment Management Rating

#### a) Interface (Lines 120-123)

**Before**:
```typescript
interface OperationalReadiness {
  testing_rating: 1 | 2 | 3 | 4 | 5;
  impairment_management_rating: 1 | 2 | 3 | 4 | 5;  // ❌ REMOVED
  emergency_response_rating: 1 | 2 | 3 | 4 | 5;
  notes: string;
}
```

**After**:
```typescript
interface OperationalReadiness {
  testing_rating: 1 | 2 | 3 | 4 | 5;
  emergency_response_rating: 1 | 2 | 3 | 4 | 5;
  notes: string;
}
```

#### b) Default Data (Lines 251-260)

**Before**:
```typescript
function createDefaultSiteData(): SiteData {
  return {
    water_supply_reliability: 'unknown',
    water_supply_notes: '',
    operational_readiness: {
      testing_rating: 3,
      impairment_management_rating: 3,  // ❌ REMOVED
      emergency_response_rating: 3,
      notes: ''
    }
  };
}
```

**After**:
```typescript
function createDefaultSiteData(): SiteData {
  return {
    water_supply_reliability: 'unknown',
    water_supply_notes: '',
    operational_readiness: {
      testing_rating: 3,
      emergency_response_rating: 3,
      notes: ''
    }
  };
}
```

#### c) UI Field (Lines 1395-1405)

**Before**:
```typescript
<RatingSelector
  value={formData.fire_protection.site.operational_readiness.testing_rating}
  onChange={(v) => updateSiteField(['operational_readiness', 'testing_rating'], v)}
  label="Testing & Inspection Adequacy"
/>

<RatingSelector  // ❌ REMOVED THIS ENTIRE BLOCK
  value={formData.fire_protection.site.operational_readiness.impairment_management_rating}
  onChange={(v) => updateSiteField(['operational_readiness', 'impairment_management_rating'], v)}
  label="Impairment Management Effectiveness"
/>

<RatingSelector
  value={formData.fire_protection.site.operational_readiness.emergency_response_rating}
  onChange={(v) => updateSiteField(['operational_readiness', 'emergency_response_rating'], v)}
  label="Emergency Response / Fire Brigade Interface Readiness"
/>
```

**After**:
```typescript
<RatingSelector
  value={formData.fire_protection.site.operational_readiness.testing_rating}
  onChange={(v) => updateSiteField(['operational_readiness', 'testing_rating'], v)}
  label="Testing & Inspection Adequacy"
/>

<RatingSelector
  value={formData.fire_protection.site.operational_readiness.emergency_response_rating}
  onChange={(v) => updateSiteField(['operational_readiness', 'emergency_response_rating'], v)}
  label="Emergency Response / Fire Brigade Interface Readiness"
/>
```

---

## Current UI Structure

### Header
- Title: "RE-04 - Fire Protection"
- Subtitle: "Active fire protection effectiveness assessment"

### Horizontal Building Tabs (Mobile-First)
```
┌────────────────────────────────────────────┐
│ [Building A] [Building B] [Building C] → │  ← Scrollable on mobile
└────────────────────────────────────────────┘
```

### Per-Building Content (Selected Building)

#### 1. Water Supply Warning (Conditional)
- Shows if site water is unreliable AND building has sprinklers/water mist

#### 2. Suppression - Whole-building / Area Protection

**Sprinklers** (Toggle-able):
- % Floor Area Protected (0-100, nullable)
- % Floor Area Required (0-100, nullable)
- Coverage gap indicator (if provided < required)
- Notes textarea
- Rating selector (1-5)
- System details (expandable):
  - System Standard (EN12845, NFPA13, FM, LPC, Other, Unknown)
  - System Type (Wet, Dry, Pre-action, Deluge, Unknown)
  - Hazard Class
  - Last Service Date
  - Known Impairments (Yes/No/Unknown)
  - Valve Supervision (Yes/Partial/No/Unknown)
  - Heating Adequate (if wet system)
  - Impairments Details (if has impairments)

**Water Mist** (Toggle-able):
- % Floor Area Protected (0-100, nullable)
- % Floor Area Required (0-100, nullable)
- Coverage gap indicator (if provided < required)
- Notes textarea
- Rating selector (1-5)

#### 3. Localised Fire Protection / Special Hazards

**Foam** (Toggle-able):
- Hazard Protected? (Yes/Partial/No/Unknown buttons)
- Notes textarea

**Gaseous** (Toggle-able):
- Hazard Protected? (Yes/Partial/No/Unknown buttons)
- Notes textarea

#### 4. Detection & Alarm
- System Type (text input)
- Coverage Adequacy (Poor/Adequate/Good/Unknown buttons)
- Monitoring (None/Keyholder/ARC/Unknown buttons)
- Notes textarea
- Rating selector (1-5)

#### 5. Building Summary - NLE Influence
- Checkbox: "Installed protection materially reduces site-wide NLE for this building"
- Rationale textarea (optional)

### Site-Wide Content (Collapsible)

#### 1. Water Supply Reliability
- Assessment (Reliable/Unreliable/Unknown buttons)
- Notes / Rationale textarea

#### 2. Operational Readiness (Site-Wide)
- Testing & Inspection Adequacy (Rating 1-5)
- Emergency Response / Fire Brigade Interface Readiness (Rating 1-5)
- Notes textarea

**NOTE**: Impairment Management field removed from this section.

### Footer
- Section Grade selector
- FloatingSaveBar (save button)

---

## Data Structure

Persists to `moduleInstance.data.fire_protection`:

```typescript
{
  buildings: {
    [buildingId]: {
      suppression: {
        sprinklers?: {
          provided_pct?: number | null,
          required_pct?: number | null,
          notes: string,
          rating: 1 | 2 | 3 | 4 | 5,
          system_standard?: string,
          system_type?: string,
          hazard_class?: string,
          last_service_date?: string | null,
          has_impairments?: string,
          impairments_notes?: string,
          valve_supervision?: string,
          heating_adequate?: string
        },
        water_mist?: {
          provided_pct?: number | null,
          required_pct?: number | null,
          notes: string,
          rating: 1 | 2 | 3 | 4 | 5
        }
      },
      localised_protection: {
        foam?: {
          protected: 'yes' | 'partial' | 'no' | 'unknown',
          notes: string
        },
        gaseous?: {
          protected: 'yes' | 'partial' | 'no' | 'unknown',
          notes: string
        }
      },
      detection_alarm: {
        system_type?: string,
        coverage?: 'poor' | 'adequate' | 'good' | 'unknown',
        monitoring?: 'none' | 'keyholder' | 'arc' | 'unknown',
        notes: string,
        rating: 1 | 2 | 3 | 4 | 5
      },
      nle_reduction_applicable?: boolean | null,
      nle_reduction_notes?: string,
      notes: string
    }
  },
  site: {
    water_supply_reliability: 'reliable' | 'unreliable' | 'unknown',
    water_supply_notes: string,
    operational_readiness: {
      testing_rating: 1 | 2 | 3 | 4 | 5,
      emergency_response_rating: 1 | 2 | 3 | 4 | 5,  // NO impairment_management_rating
      notes: string
    }
  }
}
```

---

## What's NOT Included

✅ **No BuildingsGrid as primary UI** (removed completely)
✅ **No impairment management field** (removed from UI and data)
❌ **No passive fire protection** (out of scope)
❌ **No fire control systems** (out of scope)
❌ **No loss expectancy calculations** (out of scope)

---

## Persistence

- Saves to `module_instances.data` JSONB column
- Uses existing `handleSave()` function
- Debounced save pattern via FloatingSaveBar
- No new tables created
- No schema changes

---

## Build Status ✅

```bash
npm run build
✓ 1910 modules transformed
✓ built in 15.40s
```

Build passes successfully with all changes.

---

## Testing Checklist

### Basic Flow
1. Navigate to RE-06 Fire Protection module
2. Verify horizontal building tabs appear (not BuildingsGrid)
3. Select a building tab
4. Verify building-specific sprinklers section appears
5. Input provided/required percentages
6. Verify coverage gap indicator shows when provided < required
7. Select sprinkler rating (1-5)
8. Expand site-wide section
9. Select water supply reliability
10. Verify only 2 operational readiness ratings (not 3)
11. Save and verify data persists

### Edge Cases
- No buildings: Shows "No Buildings Found" message with link to RE-02
- Site water unreliable + sprinklers present: Shows warning banner
- Wet sprinkler system: Shows "Heating Adequate" field
- Has impairments = Yes: Shows impairments details textarea
- Coverage gap: Shows amber indicator with percentage shortfall

---

## Summary

**ONLY FILE MODIFIED**: `src/components/modules/forms/RE06FireProtectionForm.tsx`

**Changes**:
1. ✅ Removed BuildingsGrid early return (line 293)
2. ✅ Added missing imports and helper function
3. ✅ Fixed import paths (SectionGrade)
4. ✅ Removed impairment_management_rating from interface
5. ✅ Removed impairment_management_rating from default data
6. ✅ Removed impairment_management_rating UI field
7. ✅ Build passes

**Result**:
- RE-06 now shows correct UI with building tabs, sprinklers, site water, and operational readiness
- No BuildingsGrid as primary UI
- No impairment management field anywhere
- All data persists to moduleInstance.data safely
- Mobile-first responsive layout maintained
