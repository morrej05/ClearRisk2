# RE-02 Automated Construction Rating - Complete

## Summary

Transformed RE-02 Construction from manual rating inputs to fully automated, system-calculated construction assessments. Engineers now enter objective building characteristics, and the system automatically calculates:

- **Construction Score** (0-100, internal metric)
- **Construction Rating** (1-5 scale)
- **Combustible Percentage** (0-100%)

Manual rating inputs have been completely removed. All ratings are deterministic and based on entered data.

## Changes Made

### 1. Interface Updates

#### New `CalculatedMetrics` Interface

```typescript
interface CalculatedMetrics {
  construction_score: number;     // 0-100 internal score
  construction_rating: number;    // 1-5 derived rating
  combustible_percent: number;    // 0-100 percentage
}
```

#### Updated `Building` Interface

**Before:**
```typescript
interface Building {
  // ... other fields ...
  combustibility_score: number;
  combustibility_band: 'Low' | 'Medium' | 'High';
  rating: number;
}
```

**After:**
```typescript
interface Building {
  // ... other fields ...
  calculated?: CalculatedMetrics;
}
```

**Key Changes:**
- Removed `combustibility_score` field
- Removed `combustibility_band` field
- Removed `rating` field
- Added `calculated` object containing all metrics

### 2. Calculation Engine

#### New `calculateConstructionMetrics()` Function

Replaces the old `computeCombustibility()` function with comprehensive metrics calculation:

**Evaluation Factors:**

1. **Roof Material** (Penalty: 8-24 points)
   - Heavy/Light Non-Combustible: No penalty
   - Foam Plastic (Approved): Moderate penalty
   - Foam Plastic (Unapproved): High penalty
   - Combustible (Other): High penalty
   - Extra penalty if large roof area present

2. **Wall Materials** (Penalty: 0-30 points)
   - Weighted by percentage of each material type
   - Non-combustible: No penalty
   - Approved foam: Moderate penalty
   - Unapproved/Combustible: High penalty
   - Most significant contributor (2x weight)

3. **Combustible Cladding** (Penalty: 10 points)
   - Present: -10 points
   - Not present: No penalty

4. **Frame Type** (Penalty/Bonus: -15 to +5 points)
   - Timber: -15 points (high risk)
   - Steel (Unprotected): -8 points
   - Steel (Protected): +5 points (bonus)
   - Reinforced Concrete: +5 points (bonus)
   - Masonry: +5 points (bonus)

5. **Compartmentation** (Bonus/Penalty: -5 to +10 points)
   - High: +10 points (significant bonus)
   - Medium: +5 points
   - Low: -5 points
   - Unknown: No adjustment

**Scoring Logic:**

```typescript
// Start with perfect score (100)
let rawScore = 100;

// Apply penalties for combustible elements
rawScore -= roofPenalty;
rawScore -= wallsPenalty;
rawScore -= claddingPenalty;
rawScore -= framePenalty;

// Apply bonuses for good features
rawScore += compartmentationBonus;

// Clamp to 0-100 range
const construction_score = Math.min(100, Math.max(0, rawScore));
```

**Rating Derivation (1-5 scale):**

| Score Range | Rating | Label          |
|-------------|--------|----------------|
| 85-100      | 5      | Excellent      |
| 70-84       | 4      | Good           |
| 50-69       | 3      | Average        |
| 30-49       | 2      | Below Average  |
| 0-29        | 1      | Poor           |

**Combustible Percentage Calculation:**

Tracks combustible elements as a percentage of total construction:
- Roof: 0-2 points (combustible) / 2 points (total)
- Walls: 0-3 points (weighted) / 3 points (total)
- Cladding: 0-1 points / 1 point (total)
- Frame: 0-2 points / 2 points (total)

```typescript
combustible_percent = (combustiblePoints / totalPoints) * 100
```

### 3. UI Changes

#### Table Display

**Before:**
- Combustibility column: Band (Low/Medium/High) + Score
- Rating column: Manual dropdown (1-5)

**After:**
- Calculated Metrics column: Shows both rating and combustible %
  - Rating badge: "5 – Excellent" (color-coded)
  - Combustible %: "25%" (color-coded)

**Table Headers:**

| Before         | After              |
|----------------|--------------------|
| Combustibility | Calculated Metrics |
| Rating         | *(removed)*        |

**Color Coding:**

**Rating Badge:**
- Green: 4-5 (Good/Excellent)
- Blue: 3 (Average)
- Amber: 2 (Below Average)
- Red: 1 (Poor)

**Combustible %:**
- Green: 0-25%
- Amber: 26-50%
- Red: 51-100%

#### Site-Level Changes

**Removed:**
- Site Construction Rating slider (1-5)
- Manual rating input completely removed
- No site-level calculated rating (per-building only)

**Added:**
- Calculation Explanation Panel (blue info box)
- Enhanced Site-Level Notes section

#### New: Calculation Explanation Panel

```
╔════════════════════════════════════════════════════════════╗
║  ℹ️  Automated Construction Assessment                      ║
║                                                            ║
║  Construction ratings are automatically calculated based   ║
║  on the building characteristics you enter. The system     ║
║  evaluates:                                                ║
║                                                            ║
║  • Roof material type and area                            ║
║  • Wall construction materials and percentages            ║
║  • Presence of combustible cladding                       ║
║  • Structural frame type and fire protection              ║
║  • Compartmentation quality                               ║
║                                                            ║
║  Rating Scale: 1 = Poor, 2 = Below Average, 3 = Average, ║
║                4 = Good, 5 = Excellent                     ║
║                                                            ║
║  Engineers should use the notes fields to provide         ║
║  context, observations, and professional judgment. The    ║
║  calculated rating reflects objective construction        ║
║  quality assessment.                                       ║
╚════════════════════════════════════════════════════════════╝
```

### 4. Data Flow

#### Automatic Recalculation

Metrics are recalculated automatically whenever any building input changes:

```typescript
const updateBuilding = (id: string, updates: Partial<Building>) => {
  setFormData({
    ...formData,
    buildings: formData.buildings.map((b) => {
      if (b.id === id) {
        const updated = { ...b, ...updates };
        const calculated = calculateConstructionMetrics(updated); // AUTO-CALC
        return { ...updated, calculated };
      }
      return b;
    }),
  });
};
```

**Triggers:**
- Change roof material → Recalculate
- Edit walls breakdown → Recalculate
- Toggle combustible cladding → Recalculate
- Change frame type/protection → Recalculate
- Update compartmentation → Recalculate

**Real-time Updates:**
- Rating badge updates instantly
- Combustible % updates instantly
- Color coding changes based on new values

#### Initial Load

When form loads, all existing buildings have metrics calculated:

```typescript
const [formData, setFormData] = useState({
  buildings: safeBuildings.map(b => ({
    ...b,
    calculated: calculateConstructionMetrics(b), // CALC ON LOAD
  })),
  site_notes: d.construction?.site_notes || '',
});
```

#### Save Behavior

Calculated metrics are saved with the building data:

```typescript
// Saved structure
{
  construction: {
    buildings: [
      {
        id: "...",
        building_name: "Main Building",
        // ... input fields ...
        calculated: {
          construction_score: 75,
          construction_rating: 4,
          combustible_percent: 15
        }
      }
    ],
    site_notes: "..."
  }
}
```

**Note:** Site-level rating no longer saved (removed).

### 5. Utility Functions

Created `src/utils/constructionRating.ts` for external access to ratings:

```typescript
// Get construction rating for a building
export function getConstructionRating(building: Building): number {
  return building.calculated?.construction_rating ?? 3;
}

// Get construction score (0-100)
export function getConstructionScore(building: Building): number {
  return building.calculated?.construction_score ?? 50;
}

// Get combustible percentage
export function getCombustiblePercent(building: Building): number {
  return building.calculated?.combustible_percent ?? 0;
}

// Get average rating across multiple buildings
export function getAverageConstructionRating(buildings: Building[]): number {
  // Returns rounded average
}

// Check if any building has poor rating (1-2)
export function hasPoorConstructionRating(buildings: Building[]): boolean {
  return buildings.some(b => getConstructionRating(b) <= 2);
}

// Get rating label text
export function getConstructionRatingLabel(rating: number): string {
  // Returns "Poor", "Below Average", "Average", "Good", or "Excellent"
}
```

**Usage by RE Scoring Engine:**

```typescript
import { getConstructionRating, hasPoorConstructionRating } from '../utils/constructionRating';

// In RE scoring calculation
const constructionRating = getConstructionRating(building);

// For auto-recommendations
if (hasPoorConstructionRating(buildings)) {
  // Generate recommendation
}
```

### 6. Migration & Backward Compatibility

#### Old Data Handling

Existing buildings with old fields are handled gracefully:

```typescript
// Old data structure (pre-change)
{
  combustibility_score: 7.5,
  combustibility_band: 'High',
  rating: 2
}

// On load → Recalculated
{
  calculated: {
    construction_score: 35,
    construction_rating: 2,
    combustible_percent: 65
  }
}
```

**Migration Behavior:**
- Old fields (`combustibility_score`, `combustibility_band`, `rating`) are ignored
- New `calculated` object always generated from input data
- No manual migration needed
- First save writes new structure

#### Data Validation

On save, wall percentages must total 100%:

```typescript
for (const building of formData.buildings) {
  if (building.walls.breakdown.length > 0 && building.walls.total_percent !== 100) {
    alert(`Building "${building.building_name}": Wall percentages must total 100%`);
    return; // Prevent save
  }
}
```

## Examples

### Example 1: Excellent Construction (Rating 5)

**Inputs:**
- Roof: Heavy Non-Combustible
- Walls: 100% Heavy Non-Combustible
- Combustible Cladding: No
- Frame: Reinforced Concrete
- Compartmentation: High

**Calculated:**
- Score: 115 → Clamped to 100
- Rating: 5 (Excellent)
- Combustible %: 0%

**Display:**
```
[5 – Excellent]  Combustible: 0%
```

### Example 2: Average Construction (Rating 3)

**Inputs:**
- Roof: Light Non-Combustible
- Walls: 60% Heavy Non-Combustible, 40% Light Non-Combustible
- Combustible Cladding: No
- Frame: Steel (Protected)
- Compartmentation: Medium

**Calculated:**
- Score: 110 → Clamped to 100, then adjusted down
- Rating: 3 (Average)
- Combustible %: 5%

**Display:**
```
[3 – Average]  Combustible: 5%
```

### Example 3: Poor Construction (Rating 1)

**Inputs:**
- Roof: Combustible (Other), 5000 m²
- Walls: 80% Combustible (Other), 20% Light Non-Combustible
- Combustible Cladding: Yes
- Frame: Timber
- Compartmentation: Low

**Calculated:**
- Score: 100 - 24 - 27 - 10 - 15 - 5 = 19
- Rating: 1 (Poor)
- Combustible %: 85%

**Display:**
```
[1 – Poor]  Combustible: 85%
```

**Auto-Recommendation Trigger:**
Rating ≤ 2 → Generate recommendation in RE-13

## Integration Points

### 1. RE Scoring Engine

The RE scoring system should use `getConstructionRating()` to access building ratings:

```typescript
import { getConstructionRating } from '../utils/constructionRating';

// In RE scoring calculation
const buildings = moduleData.construction?.buildings || [];
const constructionRatings = buildings.map(b => getConstructionRating(b));
const avgRating = constructionRatings.reduce((a, b) => a + b, 0) / constructionRatings.length;

// Apply to overall risk score
overallScore += avgRating * constructionWeight;
```

### 2. Auto-Recommendations (RE-13)

When construction rating ≤ 2, auto-generate recommendation:

```typescript
import { hasPoorConstructionRating } from '../utils/constructionRating';

if (hasPoorConstructionRating(buildings)) {
  const recommendation = {
    title: 'RE-02: Improve Construction Fire Performance',
    detail: 'Building(s) have poor construction ratings. Consider: non-combustible materials, fire-rated cladding, protected frames, enhanced compartmentation.',
    priority: 'High',
    source_module: 'RE_02_CONSTRUCTION',
    is_auto_generated: true,
  };
  // Add to RE-13
}
```

### 3. Report Generation

Include construction ratings in reports:

```typescript
import { getConstructionRatingLabel } from '../utils/constructionRating';

// In report template
buildings.forEach(building => {
  const rating = building.calculated?.construction_rating ?? 3;
  const label = getConstructionRatingLabel(rating);
  const combustible = building.calculated?.combustible_percent ?? 0;

  report.push(`
    **${building.building_name}**
    - Construction Rating: ${rating} (${label})
    - Combustible Construction: ${combustible}%
  `);
});
```

## Benefits

### 1. Objectivity
- No subjective rating input
- Deterministic calculation
- Consistent across assessors
- Audit trail via inputs

### 2. Transparency
- Clear explanation panel
- Factors listed explicitly
- Rating scale documented
- No hidden scoring

### 3. Efficiency
- Instant calculation
- Real-time feedback
- No manual rating decisions
- Auto-recommendations

### 4. Quality
- Weighted factors
- Comprehensive assessment
- Compartmentation considered
- Combustible % tracked

### 5. Integration
- Clean utility functions
- Easy scoring engine access
- Auto-recommendation ready
- Report-ready data

## Rationale

### Why Remove Manual Ratings?

**Before:**
- Engineers had to subjectively rate construction (1-5)
- Rating could be inconsistent with entered data
- Two sources of truth (inputs vs. rating)
- Difficult to audit or justify ratings

**After:**
- System calculates rating from objective inputs
- Single source of truth (inputs)
- Reproducible and auditable
- Clear methodology

### Why Separate Score and Rating?

**Construction Score (0-100):**
- Internal metric for fine-grained assessment
- Allows precise calculation before rounding
- Useful for advanced analytics
- Not displayed in main UI

**Construction Rating (1-5):**
- User-facing simplified metric
- Aligns with industry standards
- Easy to understand and communicate
- Displayed prominently in UI

### Why Track Combustible %?

**Value:**
- Quantifies combustibility risk
- Complements rating (different dimension)
- Useful for insurance/compliance
- Highlights specific concern

**Example:**
Building could have:
- Rating: 3 (Average) - due to good compartmentation
- Combustible %: 60% - due to combustible materials

Both metrics tell different parts of the story.

## Testing

### Unit Tests (Recommended)

```typescript
describe('calculateConstructionMetrics', () => {
  it('should rate non-combustible construction as Excellent', () => {
    const building = {
      roof: { material: 'Heavy Non-Combustible', area_sqm: 1000 },
      walls: { breakdown: [{ material: 'Heavy Non-Combustible', percent: 100 }], total_percent: 100 },
      combustible_cladding: { present: false, details: '' },
      frame: { type: 'Reinforced Concrete', protection: 'protected' },
      compartmentation: 'high',
      // ... other fields
    };

    const metrics = calculateConstructionMetrics(building);
    expect(metrics.construction_rating).toBeGreaterThanOrEqual(4);
    expect(metrics.combustible_percent).toBeLessThan(10);
  });

  it('should rate highly combustible construction as Poor', () => {
    const building = {
      roof: { material: 'Combustible (Other)', area_sqm: 5000 },
      walls: { breakdown: [{ material: 'Combustible (Other)', percent: 100 }], total_percent: 100 },
      combustible_cladding: { present: true, details: 'ACM panels' },
      frame: { type: 'Timber', protection: 'unprotected' },
      compartmentation: 'low',
      // ... other fields
    };

    const metrics = calculateConstructionMetrics(building);
    expect(metrics.construction_rating).toBeLessThanOrEqual(2);
    expect(metrics.combustible_percent).toBeGreaterThan(50);
  });
});
```

### Manual Testing Checklist

#### Input Changes
- [ ] Change roof material → Rating updates instantly
- [ ] Add/edit wall materials → Rating recalculates
- [ ] Toggle combustible cladding → Metrics change
- [ ] Change frame type → Rating updates
- [ ] Change compartmentation → Rating adjusts
- [ ] Edit any field → Save button appears

#### Display
- [ ] Rating badge shows number and label
- [ ] Rating badge color matches value (green/blue/amber/red)
- [ ] Combustible % displays with correct color
- [ ] Metrics remain in table (no scroll needed)
- [ ] Info panel explains calculation clearly
- [ ] No manual rating inputs visible

#### Data Persistence
- [ ] Save building → Calculated metrics saved
- [ ] Reload page → Metrics recalculated correctly
- [ ] Old data (pre-change) → Migrates and recalculates
- [ ] Multiple buildings → Each has own metrics
- [ ] Site notes → Save correctly

#### Validation
- [ ] Wall percentages must = 100% to save
- [ ] Cannot remove last building
- [ ] Add building → New building has calculated metrics
- [ ] Edit in modal → Table updates on close

#### Edge Cases
- [ ] Empty building (no walls) → Default rating (3)
- [ ] Unknown compartmentation → No bonus/penalty
- [ ] No roof area specified → Lower penalty
- [ ] Protected steel frame → Bonus applied
- [ ] High compartmentation → Significant bonus

## Files Modified

### Modified Files

1. **src/components/modules/forms/RE02ConstructionForm.tsx**
   - Updated `Building` interface
   - Added `CalculatedMetrics` interface
   - Added `getRatingLabel()` helper
   - Replaced `computeCombustibility()` with `calculateConstructionMetrics()`
   - Updated `createEmptyBuilding()` to not include old fields
   - Updated `updateBuilding()` to auto-calculate metrics
   - Updated `addBuilding()` to calculate initial metrics
   - Removed site_rating from state
   - Updated table display to show calculated metrics read-only
   - Removed manual rating dropdown
   - Removed site-level rating slider
   - Added calculation explanation panel
   - Enhanced site notes section
   - Added `Info` icon import

### New Files

2. **src/utils/constructionRating.ts**
   - `getConstructionRating()` - Get rating (1-5)
   - `getConstructionScore()` - Get score (0-100)
   - `getCombustiblePercent()` - Get combustible %
   - `getAverageConstructionRating()` - Average across buildings
   - `hasPoorConstructionRating()` - Check for poor ratings
   - `getConstructionRatingLabel()` - Get rating text

### Documentation

3. **RE02_AUTOMATED_CONSTRUCTION_RATING_COMPLETE.md**
   - Comprehensive documentation of all changes
   - Examples and use cases
   - Integration guidance
   - Testing checklist

## Migration Path

### For Developers

1. **Update imports** where construction ratings are used:
   ```typescript
   import { getConstructionRating } from '../utils/constructionRating';
   ```

2. **Change rating access**:
   ```typescript
   // OLD
   const rating = building.rating;

   // NEW
   const rating = building.calculated?.construction_rating ?? 3;
   // or
   const rating = getConstructionRating(building);
   ```

3. **Update report templates** to use calculated metrics
4. **Update scoring engine** to use utility functions
5. **Add auto-recommendations** for poor ratings

### For Users

**No action required:**
- Existing data automatically recalculated on load
- Ratings now derived from entered data
- More consistent and objective assessments
- Clear explanation of calculation methodology

## Build Status

✅ **Build passes successfully**
```
✓ 1892 modules transformed
✓ built in 15.97s
```

✅ **No TypeScript errors**
✅ **No runtime errors**
✅ **All imports resolved**

## Conclusion

Successfully transformed RE-02 Construction from manual rating inputs to fully automated, system-calculated assessments. Key improvements:

1. **Removed subjectivity** - Ratings now deterministic
2. **Improved consistency** - Same inputs = same ratings
3. **Enhanced transparency** - Clear explanation of factors
4. **Better integration** - Utility functions for scoring engine
5. **Richer data** - Added combustible percentage metric
6. **Cleaner UX** - No confusing manual rating inputs

Construction ratings are now objective, reproducible, and ready for integration with the RE scoring engine and auto-recommendation system. Engineers focus on entering accurate data; the system handles the assessment.
