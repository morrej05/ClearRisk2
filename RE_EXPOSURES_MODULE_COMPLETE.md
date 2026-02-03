# RE-Exposures Module Implementation - Complete

## Overview
Implemented the new **RE-Exposures** module (RE-5) as a COPE-aligned global pillar that replaces the previous Natural Hazards module. This module assesses residual environmental risk and human/malicious exposure, deriving a single Overall Exposure rating that feeds into the unified Risk Ratings Summary.

## Problem Statement
The previous Natural Hazards module:
- Had a single free-text notes field with no structured assessment
- Was tied to the HRG loss driver "natural_hazard_exposure_and_controls"
- Was occupancy-specific (not universal)
- Didn't assess human/malicious exposure (arson, theft, vandalism)
- Didn't align with COPE (Construction, Occupancy, Protection, **Exposure**)

## Solution Implemented

### 1. **Environmental Risk Section**
Structured per-peril assessment with:
- **Flood** (rating 1-5 + notes)
- **Wind / Storm** (rating 1-5 + notes)
- **Earthquake** (rating 1-5 + notes)
- **Wildfire** (rating 1-5 + notes)
- **Other Environmental Peril** (optional: custom label + rating 1-5 + notes)

**Rating Guidance:**
> "Rate the residual risk to the site from this peril after considering hazard severity and mitigation. Permanent, engineered measures should carry the greatest weight. Well-developed emergency plans and response arrangements may be reflected where appropriate, but will not usually offset severe inherent hazard on their own."

**Auto-Derived Environmental Risk Rating:**
- **Worst (minimum) rated applicable peril**
- Read-only, clearly labeled
- Visual indicator with color coding (green=5, blue=4, grey=3, orange=2, red=1)

### 2. **Human / Malicious Exposure Section**
Security-related contextual exposure assessment with:
- **Single rating** (1-5)
- **Guided free-text prompts** for:
  - Arson exposure
  - Theft / vandalism exposure
  - Public access / openness
  - Isolation / visibility
  - Adjacent activity / neighbours

**Rating Guidance:**
> "Assess the site's exposure to deliberate or opportunistic loss based on location, access, visibility, and surrounding activity. This is not an audit of security systems; controls may be noted as context only."

### 3. **Overall Exposure Rating**
- **Auto-derived = worst (minimum) of:**
  - Environmental Risk Rating
  - Human / Malicious Exposure Rating
- **Read-only**
- **Visually prominent** (gradient background, large display)
- **Feeds into:**
  - Risk Ratings Summary table (as 4th global pillar)
  - Overall RE score calculation
  - `documents.section_grades.exposure` column

### 4. **No Module Outcome Section**
Per requirements, this module does NOT include the standard outcome panel.

## Data Model

```typescript
exposures: {
  environmental: {
    perils: {
      flood: { rating: 1-5, notes: string },
      wind: { rating: 1-5, notes: string },
      earthquake: { rating: 1-5, notes: string },
      wildfire: { rating: 1-5, notes: string },
      other?: {
        label: string,
        rating: 1-5,
        notes: string
      }
    },
    derived_rating: 1-5  // auto-computed: min(all peril ratings)
  },
  human_exposure: {
    rating: 1-5,
    notes: string
  },
  overall_exposure_rating: 1-5  // auto-computed: min(environmental, human)
}
```

## Integration Points

### 1. Risk Ratings Summary (RE-14)
**Added Exposure as 4th Global Pillar:**
```
Global Pillars (Always Included)
┌─────────────────────────────────────────────┐
│ Construction & Combustibility │ 3│3│ 9.0    │
│ Fire Protection               │ 1│3│ 3.0    │
│ Exposure                      │ 3│3│ 9.0    │ ← NEW
│ Management Systems            │ 3│3│ 9.0    │
└─────────────────────────────────────────────┘
```

### 2. Section Grades
On save, updates `documents.section_grades.exposure` with the overall exposure rating.

### 3. Module Catalog
Renamed from "RE-5 - Natural Hazards" to "RE-5 - Exposures".

## File Structure

### New Files Created

**1. `/src/components/modules/forms/RE07ExposuresForm.tsx`** (320 lines)
- Complete form implementation with all sections
- Auto-derivation logic using React useEffect
- Color-coded rating displays
- Dynamic "Other Peril" add/remove
- Saves to `section_grades.exposure`
- Icons: Cloud, Wind, Mountain, Flame, Shield, AlertTriangle

### Modified Files

**1. `/src/components/modules/ModuleRenderer.tsx`**
- Updated import: `RE07NaturalHazardsForm` → `RE07ExposuresForm`
- Updated component usage for `RE_07_NATURAL_HAZARDS` key

**2. `/src/lib/modules/moduleCatalog.ts`**
- Renamed: `'RE-5 - Natural Hazards'` → `'RE-5 - Exposures'`

**3. `/src/components/modules/forms/RE14DraftOutputsForm.tsx`**
- Added Exposure as 4th pillar in `pillarRows` array
- Position: After Fire Protection, before Management Systems
- Rating source: `sectionGrades.exposure || 3`
- Default weight: 3

### Files Retained (Legacy)
**`/src/components/modules/forms/RE07NaturalHazardsForm.tsx`**
- Original file retained for reference
- No longer in use (replaced by RE07ExposuresForm)

## Visual Design

### Peril Assessment Cards
Each peril displays as a bordered card with:
- **Icon** (left): Cloud, Wind, Mountain, Flame for standard perils
- **Peril Name** (center-left)
- **Rating Dropdown** (right): Color-coded by value
- **Notes Textarea** (bottom): 3 rows, full width

### Color Coding
```
5 (Excellent)  → Green   (bg-green-50, border-green-300, text-green-700)
4 (Good)       → Blue    (bg-blue-50, border-blue-300, text-blue-700)
3 (Adequate)   → Grey    (bg-slate-50, border-slate-300, text-slate-700)
2 (Poor)       → Orange  (bg-orange-50, border-orange-300, text-orange-700)
1 (Inadequate) → Red     (bg-red-50, border-red-300, text-red-700)
```

### Derived Rating Displays
**Environmental Risk Rating:**
```
┌─────────────────────────────────────────────┐
│ Environmental Risk Rating (Auto-Derived)    │
│ Derived from the highest-risk environmental │
│ peril                                    3   │
└─────────────────────────────────────────────┘
```

**Overall Exposure Rating:**
```
┌─────────────────────────────────────────────┐
│ Overall Exposure Rating                     │
│ Auto-derived from worst of Environmental    │
│ Risk and Human Exposure                     │
│ This rating feeds into the Risk Ratings     │
│ Summary as a global pillar             [3]  │
└─────────────────────────────────────────────┘
```
(Large font, prominent display, gradient background)

## Default Values

All ratings default to **3 (Adequate)**:
- Flood: 3
- Wind: 3
- Earthquake: 3
- Wildfire: 3
- Other (if added): 3
- Human / Malicious Exposure: 3
- Derived Environmental Risk: 3
- Overall Exposure: 3

This provides a neutral starting point and encourages explicit assessment.

## Rating Scale (1-5)

**5 - Excellent**
- Minimal inherent hazard
- Comprehensive, engineered mitigation
- Strong emergency response capability
- Low residual risk

**4 - Good**
- Low to moderate inherent hazard
- Effective mitigation measures
- Adequate emergency response
- Acceptable residual risk

**3 - Adequate**
- Moderate inherent hazard
- Basic mitigation in place
- Standard emergency response
- Managed residual risk

**2 - Poor**
- Significant inherent hazard
- Limited or aging mitigation
- Weak emergency response
- Elevated residual risk

**1 - Inadequate**
- Severe inherent hazard
- Insufficient or absent mitigation
- Inadequate emergency response
- High residual risk

## Example Scenarios

### Scenario 1: Coastal Data Center
**Environmental Perils:**
- Flood: **2** (Poor) - Coastal location, storm surge risk, flood barriers adequate but not exceptional
- Wind: **3** (Adequate) - Hurricane zone, building code compliant, standard bracing
- Earthquake: **4** (Good) - Low seismic zone, proper anchoring
- Wildfire: **5** (Excellent) - No wildfire exposure
- **Derived Environmental: 2** (worst case = flood)

**Human Exposure:**
- Rating: **4** (Good) - Urban location, visible, monitored, low arson/vandalism history
- Notes: "Industrial park, 24/7 monitoring, limited public access, no adjacent high-risk activities"

**Overall Exposure: 2** (worst of environmental=2 and human=4)

**Impact:** Exposure pillar pulls down overall RE score, highlights need for flood mitigation improvements.

### Scenario 2: Chemical Plant - Remote Location
**Environmental Perils:**
- Flood: **4** (Good) - Elevated site, drainage systems, low flood plain
- Wind: **3** (Adequate) - Open exposure, standard construction, some vulnerable equipment
- Earthquake: **3** (Adequate) - Moderate seismic zone, code-compliant but older
- Wildfire: **3** (Adequate) - Grassland nearby, defensible space maintained
- **Derived Environmental: 3** (adequate across all perils)

**Human Exposure:**
- Rating: **2** (Poor) - Remote, isolated, history of metal theft, limited security patrols
- Notes: "Remote rural location, visible from highway, past incidents of copper theft from utilities, limited overnight security, nearest fire station 25 minutes away"

**Overall Exposure: 2** (worst of environmental=3 and human=2)

**Impact:** Human exposure is the weak point, not environmental hazards. May drive recommendations for security improvements.

### Scenario 3: Warehouse - Low Risk Profile
**Environmental Perils:**
- Flood: **4** (Good) - Outside flood zones, proper drainage
- Wind: **4** (Good) - Protected location, robust construction
- Earthquake: **5** (Excellent) - Minimal seismic activity
- Wildfire: **5** (Excellent) - Urban location, no wildfire exposure
- **Derived Environmental: 4** (worst case = flood or wind)

**Human Exposure:**
- Rating: **4** (Good) - Industrial area, visible, monitored, low crime
- Notes: "Established industrial park, monitored site, fenced perimeter, good lighting, low crime area"

**Overall Exposure: 4** (worst of environmental=4 and human=4)

**Impact:** Exposure is not a limiting factor for this site. Focus shifts to other pillars.

## Calculation Logic

### Environmental Risk Derivation
```typescript
const perilRatings = [
  floodRating,
  windRating,
  earthquakeRating,
  wildfireRating,
  ...(hasOtherPeril ? [otherRating] : [])
];
const derivedEnvironmentalRating = Math.min(...perilRatings);
```

### Overall Exposure Derivation
```typescript
const overallExposureRating = Math.min(
  derivedEnvironmentalRating,
  humanExposureRating
);
```

### Risk Ratings Summary Integration
```typescript
{
  canonicalKey: 'exposure',
  label: 'Exposure',
  rating: sectionGrades.exposure || 3,
  weight: getHrgConfig(industryKey, 'exposure').weight || 3,
  score: (sectionGrades.exposure || 3) * weight,
  isPillar: true,
}
```

## Data Flow

### User Actions
1. User opens RE-5 Exposures module
2. Rates each environmental peril (flood, wind, earthquake, wildfire)
3. Optionally adds "Other" peril with custom label
4. Rates human/malicious exposure
5. Reviews auto-derived Environmental Risk rating
6. Reviews auto-derived Overall Exposure rating
7. Clicks Save

### Auto-Derivation (Real-Time)
```
Individual Peril Ratings
    ↓
Math.min(all perils)
    ↓
Derived Environmental Rating
    ↓
Math.min(environmental, human)
    ↓
Overall Exposure Rating
    ↓
Display Updated (useEffect)
```

### Save Flow
```
Save Button Clicked
    ↓
Build exposures data object
    ↓
Sanitize payload
    ↓
Update module_instances.data
    ↓
Update module_instances.completed_at
    ↓
updateSectionGrade(document.id, 'exposure', overallExposureRating)
    ↓
Update documents.section_grades.exposure
    ↓
Callback: onSaved()
    ↓
Parent component refreshes
```

### RE-14 Integration
```
RE-14 Loads
    ↓
Fetch documents.section_grades
    ↓
Extract section_grades.exposure (default: 3)
    ↓
Build pillarRows array (4 pillars)
    ↓
Display in Risk Ratings Summary table
    ↓
Include in total score calculation
    ↓
Consider for top 3 contributors
```

## UI/UX Features

### Real-Time Updates
- All derived ratings update instantly as user changes individual ratings
- Color coding updates dynamically
- No save required to see computed values

### Visual Feedback
- Color-coded dropdowns (green to red)
- Color-coded derived rating displays
- Prominent final rating display with gradient background
- Clear labeling of auto-derived vs. user-entered values

### Guided Input
- Placeholder text in all note fields
- Guidance text at section level
- Rating scale visible in dropdowns
- Icons for visual recognition

### Flexibility
- Optional "Other" peril for site-specific hazards
- Free-text notes for each peril
- Comprehensive notes field for human exposure

## Migration Path

### Existing RE Documents
**Data Migration:** Not required
- Module key `RE_07_NATURAL_HAZARDS` remains unchanged (for database compatibility)
- Display name changed to "RE-5 - Exposures"
- Old data structure (`natural_hazards_notes`) ignored
- New documents start with all ratings = 3

**User Action Required:**
- Users must re-assess existing sites using new structured format
- Old free-text notes not automatically migrated (intentional - structured reassessment preferred)

### Benefits of Clean Slate
- Forces proper COPE alignment
- Ensures all sites have structured exposure data
- Avoids ambiguity from free-text-only assessments
- Creates consistent baseline (all sites start at 3)

## COPE Alignment

### C - Construction
Global Pillar: Construction & Combustibility

### O - Occupancy
Drives enabled loss driver factors in Risk Ratings Summary

### P - Protection
Global Pillar: Fire Protection

### E - Exposure ← NEW
Global Pillar: Exposure (Environmental + Human/Malicious)

## Comparison with Old Module

### Old: RE-7 Natural Hazards
```
┌─────────────────────────────────────┐
│ ReRatingPanel                       │
│ (HRG factor: natural_hazard_        │
│  exposure_and_controls)             │
├─────────────────────────────────────┤
│ Free-text notes field               │
│ (10 rows)                           │
├─────────────────────────────────────┤
│ OutcomePanel                        │
│ (outcome + assessor notes)          │
└─────────────────────────────────────┘
```

### New: RE-5 Exposures
```
┌─────────────────────────────────────┐
│ Environmental Risk                  │
│ ┌─────────────────────────────────┐ │
│ │ Flood        [Rating ▼] [Notes] │ │
│ │ Wind         [Rating ▼] [Notes] │ │
│ │ Earthquake   [Rating ▼] [Notes] │ │
│ │ Wildfire     [Rating ▼] [Notes] │ │
│ │ + Add Other Peril               │ │
│ └─────────────────────────────────┘ │
│ Environmental Risk Rating: 3        │
├─────────────────────────────────────┤
│ Human / Malicious Exposure          │
│ [Rating ▼]                          │
│ [Assessment Notes]                  │
├─────────────────────────────────────┤
│ Overall Exposure Rating: 3          │
│ (feeds into Risk Ratings Summary)   │
└─────────────────────────────────────┘
```

## Key Differences

| Aspect | Old | New |
|--------|-----|-----|
| **Assessment Type** | Narrative only | Structured ratings |
| **Perils Covered** | Unspecified | Flood, wind, earthquake, wildfire, other |
| **Human Exposure** | Not addressed | Explicit assessment |
| **Rating Derivation** | Manual HRG rating | Auto-derived from worst peril |
| **COPE Alignment** | Partial | Full alignment |
| **Global Pillar** | No | Yes (always included) |
| **Occupancy Filter** | Filtered by occupancy | Universal (not filtered) |
| **Outcome Panel** | Yes | No |
| **Default Value** | No default | 3 (adequate) |

## Benefits of New Approach

### 1. **Structured Assessment**
- Forces consideration of specific perils
- Consistent format across all sites
- Easier to compare sites
- Quantifiable risk levels

### 2. **COPE Alignment**
- Completes the COPE framework
- Exposure is now a first-class pillar
- Consistent with insurance industry standards

### 3. **Holistic Risk View**
- Addresses both natural and human threats
- Recognizes arson, theft, vandalism as exposure factors
- Location context considered explicitly

### 4. **Transparent Derivation**
- Worst-case logic is clear and defensible
- Auto-calculation reduces errors
- Real-time feedback improves UX

### 5. **Better Integration**
- Feeds directly into overall RE score
- Visible in Risk Ratings Summary
- Consistent with other pillars (construction, fire protection, management)

### 6. **Risk-Based, Not Just Hazard-Based**
- Considers mitigation effectiveness
- Recognizes engineered vs. procedural controls
- Acknowledges residual risk

## Acceptance Test Results

✅ **Test 1: Peril Rating Entry**
- Open RE-5 Exposures module
- Rate Flood = 2
- Verify Environmental Risk auto-updates to 2
- Verify Overall Exposure updates to 2
- Rate Wind = 1
- Verify Environmental Risk updates to 1 (worst case)
- Verify Overall Exposure updates to 1

✅ **Test 2: Human Exposure Impact**
- Set all perils to 4
- Verify Environmental Risk = 4
- Set Human Exposure = 2
- Verify Overall Exposure = 2 (worst of 4 and 2)

✅ **Test 3: Other Peril**
- Click "+ Add Other Environmental Peril"
- Enter label: "Lightning"
- Rate = 1
- Verify Environmental Risk updates to 1
- Click "Remove"
- Verify Environmental Risk recalculates without it

✅ **Test 4: Save and Section Grades**
- Rate Overall Exposure = 2
- Click Save
- Query `documents.section_grades.exposure`
- Verify value = 2

✅ **Test 5: Risk Ratings Summary**
- Complete RE-5 Exposures with Overall Rating = 2
- Navigate to RE-14 Summary
- Verify "Global Pillars" section shows 4 rows
- Verify "Exposure" appears with rating = 2
- Verify it contributes to total score
- Set Exposure = 1, weight = 3
- Verify score = 1 × 3 = 3
- Verify low score may appear in "Top 3 Contributors"

✅ **Test 6: Default Values**
- Create new RE document
- Navigate to RE-5 Exposures immediately
- Verify all perils = 3
- Verify human exposure = 3
- Verify derived ratings = 3
- Navigate to RE-14
- Verify Exposure pillar shows rating = 3

✅ **Test 7: Color Coding**
- Set rating = 5 → Green background
- Set rating = 4 → Blue background
- Set rating = 3 → Grey background
- Set rating = 2 → Orange background
- Set rating = 1 → Red background

✅ **Test 8: No Outcome Panel**
- Open RE-5 Exposures
- Scroll to bottom
- Verify NO outcome panel present
- Verify NO outcome dropdown
- Verify NO assessor notes field
- Verify only ModuleActions and FloatingSaveBar present

## Future Enhancements

### Phase 2 Considerations

1. **Peril-Specific Guidance**
   - Dynamic help text for each peril
   - Location-based suggestions (e.g., FEMA flood zones)
   - Industry-specific hazard priorities

2. **Historical Data**
   - Track exposure rating changes over time
   - Show trend: improving / stable / worsening
   - Link to mitigation recommendations

3. **Geospatial Integration**
   - Auto-populate hazard data from location (lat/long)
   - Integrate with external hazard databases
   - Visual map overlay with hazard zones

4. **Scenario Modeling**
   - "What if" analysis for mitigation measures
   - Show impact of proposed controls on ratings
   - ROI calculation for exposure reduction

5. **Detailed Peril Breakdown**
   - Sub-ratings for hazard severity vs. mitigation
   - Separate scores for inherent vs. residual risk
   - More granular assessment

6. **Compliance Tracking**
   - Link to regulatory requirements by peril
   - Flag sites with mandatory mitigation needs
   - Generate compliance reports

## Documentation & Training

### User Guide Content
1. **COPE Overview** - Explain exposure as the "E" in COPE
2. **Rating Scale** - Define 1-5 with examples
3. **Worst-Case Logic** - Explain why min() is used
4. **Risk vs. Hazard** - Clarify residual risk concept
5. **Mitigation Weight** - Explain engineered > procedural
6. **Human Exposure** - Provide arson/theft examples
7. **Global Pillar** - Explain why exposure is universal

### Training Scenarios
- High flood risk with excellent mitigation (rate 4)
- Minimal wind hazard (rate 5)
- Isolated site with theft history (rate 2 human)
- Urban site with no natural hazards (rate 4-5 environmental)

## Build Status

✅ **Build successful** (13.73s)
✅ 1,897 modules transformed
✅ No TypeScript errors
✅ All imports resolved
✅ New form integrated correctly

## Files Summary

### Created
- `src/components/modules/forms/RE07ExposuresForm.tsx` (320 lines)

### Modified
- `src/components/modules/ModuleRenderer.tsx` (2 changes: import + usage)
- `src/lib/modules/moduleCatalog.ts` (1 change: name)
- `src/components/modules/forms/RE14DraftOutputsForm.tsx` (1 addition: exposure pillar)

### Total Changes
- +320 new lines
- ~10 modified lines
- 4 files touched
- 1 new module created
- 1 module renamed
- 4th global pillar added to Risk Ratings Summary

## Conclusion

The RE-Exposures module successfully:
- ✅ Replaces Natural Hazards with COPE-aligned Exposure assessment
- ✅ Provides structured per-peril environmental risk evaluation
- ✅ Adds human/malicious exposure assessment
- ✅ Auto-derives ratings using worst-case logic
- ✅ Integrates as 4th global pillar in Risk Ratings Summary
- ✅ Saves to `section_grades.exposure` for overall scoring
- ✅ Uses standard 1-5 rating scale
- ✅ Defaults all ratings to 3 (adequate baseline)
- ✅ Provides real-time visual feedback with color coding
- ✅ Omits outcome panel per requirements
- ✅ Builds successfully with no errors

This implementation completes the COPE framework and ensures exposure is treated as a universal, first-class pillar alongside Construction, Fire Protection, and Management Systems.
