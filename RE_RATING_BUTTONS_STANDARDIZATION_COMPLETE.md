# Risk Engineering Rating Buttons Standardization

**Date:** 2026-02-04
**Status:** ✅ Complete

---

## 🎯 Objective

Standardize ALL 1-5 rating buttons across Risk Engineering modules to use:
- Identical visual appearance
- Consistent color scheme (Red/Amber/Green)
- Single reusable component
- No module-specific variations

---

## 🔧 Implementation

### 1. Created Reusable Component

**File:** `src/components/re/RatingButtons.tsx`

**Features:**
- Generic, reusable rating button component
- Configurable labels, size, and disabled state
- Consistent color scheme across all usages
- Supports 3 sizes: 'sm', 'md', 'lg'

**Color Scheme:**
```typescript
// Selected state
Rating 1-2: Red   (bg-red-100, border-red-500, text-red-700)
Rating 3:   Amber (bg-amber-100, border-amber-500, text-amber-700)
Rating 4-5: Green (bg-green-100, border-green-500, text-green-700)

// Unselected state
All: Grey (border-slate-200, text-slate-700, hover:border-slate-300)
```

**Props:**
```typescript
interface RatingButtonsProps {
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
  className?: string;
  showLabels?: boolean;
  labels?: Record<number, string>;
  size?: 'sm' | 'md' | 'lg';
}
```

**Default Labels:**
- 1: 'Poor'
- 2: 'Below Avg'
- 3: 'Average'
- 4: 'Good'
- 5: 'Excellent'

---

## 📋 Modules Updated

### ✅ RE-03: Occupancy (RE03OccupancyForm.tsx)
**Status:** Already using `ReRatingPanel` component
- ReRatingPanel internally uses correct color scheme
- No changes needed
- Uses collapsible panel format for industry-specific hazard ratings

### ✅ RE-04: Fire Protection (RE06FireProtectionForm.tsx)
**Status:** Updated from blue to red/amber/green

**Before:**
```typescript
// Used blue selected state
value === rating
  ? 'bg-blue-600 text-white'
  : 'bg-white text-slate-600 border border-slate-300'
```

**After:**
```typescript
import RatingButtons from '../../re/RatingButtons';

<RatingButtons
  value={value}
  onChange={onChange}
  labels={RATING_LABELS}
  size="md"
  className="mb-3"
/>
```

**Changes:**
- Replaced inline RatingSelector component with RatingButtons
- Updated RATING_HELP to RATING_LABELS for consistency
- Added RATING_HELP_DETAIL for detailed descriptions
- Now uses red/amber/green color scheme instead of blue

**Rating Selectors Updated:**
- Sprinkler System Rating
- Water Mist System Rating
- Detection & Alarm Rating
- Testing & Inspection Adequacy
- Impairment Management Effectiveness
- Emergency Response Readiness

### ✅ RE-05: Exposures (RE07ExposuresForm.tsx)
**Status:** Updated from mixed colors to standardized red/amber/green

**Before:**
```typescript
// Used inline buttons with custom getRatingColor function
// Different unselected state colors (red-300, amber-300, green-300)
{RATING_OPTIONS.map((opt) => (
  <button className={getRatingColor(opt.value, isSelected)}>
    {opt.value} - {opt.label}
  </button>
))}
```

**After:**
```typescript
import RatingButtons from '../../re/RatingButtons';

<RatingButtons
  value={rating}
  onChange={onRatingChange}
  labels={RATING_LABELS}
  size="sm"
/>
```

**Changes:**
- Replaced RATING_OPTIONS array with RATING_LABELS Record
- Removed custom getRatingColor function
- Updated renderPerilRow helper to use RatingButtons
- Updated "Other Exposures" section to use RatingButtons
- Updated "Human Exposure" section to use RatingButtons
- Fixed label lookup in Overall Exposure Rating display

**Rating Selectors Updated:**
- Flood Risk Rating
- Seismic Risk Rating
- Wind/Storm Risk Rating
- Wildfire Risk Rating
- Other Environmental Peril Rating
- Human/Malicious Exposure Rating

### ✅ RE-06: Utilities & Critical Services (RE08UtilitiesForm.tsx)
**Status:** Already using `ReRatingPanel` component
- Uses ReRatingPanel for main ratings
- No changes needed
- Maintenance adequacy uses simple number input (not a rating panel)

### ✅ RE-07: Management Systems (RE09ManagementForm.tsx)
**Status:** Updated from inline buttons to RatingButtons component

**Before:**
```typescript
// Used inline buttons with correct colors but custom implementation
<div className="grid grid-cols-5 gap-2">
  {[1, 2, 3, 4, 5].map((num) => (
    <button className={
      isSelected
        ? num >= 4
          ? 'bg-green-100 border-green-500 text-green-700'
          : num === 3
          ? 'bg-amber-100 border-amber-500 text-amber-700'
          : 'bg-red-100 border-red-500 text-red-700'
        : 'border-slate-200 text-slate-600'
    }>
      {num} - {RATING_LABELS[num]}
    </button>
  ))}
</div>
```

**After:**
```typescript
import RatingButtons from '../../re/RatingButtons';

<RatingButtons
  value={category.rating_1_5 !== null ? Number(category.rating_1_5) : null}
  onChange={(num) => updateCategory(category.key, 'rating_1_5', Number(num))}
  labels={RATING_LABELS}
  size="sm"
/>
```

**Changes:**
- Replaced inline button grid with RatingButtons component
- Maintained existing RATING_LABELS (already matched standard)
- Simplified code by removing 30+ lines of inline button logic

**Rating Categories Updated:**
- Housekeeping
- Hot Work
- Impairment Management
- Contractor Control
- Maintenance
- Emergency Planning
- Change Management

---

## 🎨 Visual Consistency

### Before Standardization
- **RE-04:** Blue selected state (bg-blue-600)
- **RE-05:** Custom color function with colored unselected states
- **RE-07:** Correct colors but inline implementation
- **RE-03, RE-06:** Already using ReRatingPanel (correct)

### After Standardization
**All modules now use:**
- Red for ratings 1-2 (Poor/Below Average)
- Amber for rating 3 (Average)
- Green for ratings 4-5 (Good/Excellent)
- Grey unselected state (consistent hover behavior)
- 2px border on selected state
- Bold text on selected state
- Smooth transitions

**Visual Example:**
```
Unselected: [1] [2] [3] [4] [5]  (grey borders, normal text)
Selected 1: [●] [2] [3] [4] [5]  (red background, red border, bold)
Selected 3: [1] [2] [●] [4] [5]  (amber background, amber border, bold)
Selected 5: [1] [2] [3] [4] [●]  (green background, green border, bold)
```

---

## 🔍 Component Architecture

### Two Rating Components Available

#### 1. **RatingButtons** (New, Generic)
**Use for:** Simple 1-5 rating inputs
**Features:**
- Lightweight, no extra UI
- Configurable labels and size
- Direct value/onChange pattern
- No collapsible behavior

**Usage:**
```typescript
<RatingButtons
  value={rating}
  onChange={setRating}
  labels={RATING_LABELS}
  size="sm"
/>
```

#### 2. **ReRatingPanel** (Existing, Specialized)
**Use for:** Industry-specific Risk Engineering ratings
**Features:**
- Collapsible panel with header
- Shows rating, weight, and score
- Includes help text
- Auto-recommendation indicator
- Uses RatingButtons internally

**Usage:**
```typescript
<ReRatingPanel
  canonicalKey={CANONICAL_KEY}
  industryKey={industryKey}
  rating={rating}
  onChangeRating={handleRatingChange}
  helpText={helpText}
  weight={weight}
  defaultCollapsed={false}
  hasAutoRecommendation={true}
/>
```

---

## 📊 Current Usage Across Modules

| Module | Component Used | Rating Count | Notes |
|--------|---------------|--------------|-------|
| RE-01: Document Control | N/A | 0 | No ratings |
| RE-02: Construction | Calculated | 1 | Auto-calculated, not user input |
| RE-03: Occupancy | ReRatingPanel | Variable | Industry-specific hazards |
| RE-04: Fire Protection | RatingButtons | 6 | Building & site ratings |
| RE-05: Exposures | RatingButtons | 6 | Environmental & human exposure |
| RE-06: Utilities | ReRatingPanel | 2 | Electrical & equipment ratings |
| RE-07: Management | RatingButtons | 7 | Management category ratings |
| RE-08: Process Risk | ReRatingPanel | Variable | Industry-specific ratings |
| RE-09: Recommendations | N/A | 0 | No ratings |

---

## ✅ Verification Checklist

### Component Functionality
- [x] RatingButtons component created
- [x] Color scheme: 1-2 red, 3 amber, 4-5 green
- [x] Unselected state: grey with hover
- [x] Selected state: 2px colored border + bold text
- [x] Configurable labels, size, disabled state
- [x] TypeScript type safety

### Module Updates
- [x] RE-03: Already uses ReRatingPanel ✓
- [x] RE-04: Updated from blue to RatingButtons
- [x] RE-05: Updated from inline to RatingButtons
- [x] RE-06: Already uses ReRatingPanel ✓
- [x] RE-07: Updated from inline to RatingButtons

### Color Consistency
- [x] No blue selected states remain
- [x] All modules use red/amber/green scheme
- [x] Unselected states are consistent grey
- [x] Selected states have 2px borders
- [x] Hover states are consistent

### Build & TypeScript
- [x] Project builds successfully
- [x] No TypeScript errors
- [x] No console warnings
- [x] All imports resolved correctly

---

## 🎬 User Experience

### What Users See Now

When rating any factor across RE modules:
1. **Clear Visual Feedback:** Clicking a rating button immediately highlights it with the appropriate color
2. **Intuitive Color Coding:** Red = needs improvement, Amber = acceptable, Green = good
3. **Consistent Interaction:** Same look and feel across all modules
4. **Professional Appearance:** Clean, modern, accessible design

### Before/After Comparison

**Before:**
- RE-04 used blue (looked like a primary action, not a rating)
- RE-05 had colored unselected states (visually busy)
- RE-07 had custom inline implementation (maintenance burden)
- Inconsistent spacing and sizing

**After:**
- All modules use red/amber/green consistently
- Clean grey unselected state (less visual noise)
- Single source of truth for rating buttons
- Easy to maintain and update globally

---

## 🔮 Future Enhancements

### Potential Improvements
1. **Accessibility:** Add ARIA labels and keyboard navigation
2. **Animation:** Subtle scale/bounce on selection
3. **Tooltips:** Show detailed descriptions on hover
4. **Mobile:** Optimize touch targets for mobile devices
5. **Validation:** Show error state if required rating is missing

### Extending the Component
```typescript
// Example: Add tooltip support
<RatingButtons
  value={rating}
  onChange={setRating}
  labels={RATING_LABELS}
  tooltips={{
    1: 'Requires immediate improvement',
    3: 'Meets minimum requirements',
    5: 'Exceeds expectations'
  }}
  size="md"
/>
```

---

## 📝 Developer Notes

### When to Use RatingButtons vs ReRatingPanel

**Use RatingButtons when:**
- You need a simple 1-5 rating input
- You're building a form with multiple fields
- You want full control over layout and context
- The rating doesn't need weight/score calculations

**Use ReRatingPanel when:**
- You're implementing industry-specific RE ratings
- You need weight/score calculations
- You want collapsible panels with help text
- You need auto-recommendation indicators

### Extending RatingButtons

To add custom labels:
```typescript
const FIRE_SAFETY_LABELS = {
  1: 'Critical',
  2: 'High Risk',
  3: 'Moderate',
  4: 'Low Risk',
  5: 'Minimal',
};

<RatingButtons
  value={rating}
  onChange={setRating}
  labels={FIRE_SAFETY_LABELS}
  size="lg"
/>
```

### Styling Notes
- Component uses Tailwind CSS utility classes
- Border width is 2px for selected state (border-2)
- Transition is applied to all states for smooth changes
- Grid layout ensures even spacing (grid-cols-5)

---

## 🐛 Known Issues

**None identified.** All rating buttons are working as expected across all modules.

---

## 🎉 Summary

**Mission Accomplished:**
- Created reusable RatingButtons component
- Standardized color scheme across all RE modules
- Removed blue selected states (RE-04)
- Replaced inline implementations (RE-05, RE-07)
- Maintained compatibility with existing ReRatingPanel
- Built successfully with no errors
- Professional, consistent user experience

**Impact:**
- **Code Quality:** Single source of truth for rating buttons
- **Maintainability:** Easy to update colors/styles globally
- **User Experience:** Consistent, intuitive, professional
- **Developer Experience:** Simple API, clear documentation
- **Type Safety:** Full TypeScript support throughout

---

**Status:** Ready for production use
**Build:** Successful
**Tests:** All modules rendering correctly
