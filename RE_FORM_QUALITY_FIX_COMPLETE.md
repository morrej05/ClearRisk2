# Risk Engineering Form Quality Fix - Complete

## Overview
Completely rebuilt RiskEngineeringForm to remove placeholders and implement production-ready functionality with Document Control, proper tables, and comprehensive Loss Expectancy modeling.

## A) Document Control Section - IMPLEMENTED ✅

**Always Visible (Not Collapsible)**
Located at the top of the form with Building2 icon in a neutral-50 background panel.

**Fields Implemented:**
- **Assessor Name** - Default from profile.name, editable
- **Assessor Role** - Optional text field
- **Assessment Date** - Date input, defaults to today
- **Review Date** - Optional date input
- **Client / Site Name** - Defaults to document.title, editable
- **Scope / Limitations** - Textarea for scope description
- **Standards / Frameworks** - Textarea for standards (e.g., BS 9999, NFPA 101, FM Global)

**Persistence:** All fields stored in `module_instances.data.docControl.*`

## B) Construction + Fire Protection Tables - IMPLEMENTED ✅

### Construction Table
**Rows (5 total):**
1. Frame
2. External Walls
3. Roof
4. Floors
5. Compartments/Fire Stopping

**Columns:**
- Element (fixed, gray background)
- Type / Material (editable input)
- Fire Resistance (mins) (editable input)
- Comments (editable input)

**Features:**
- Always visible when section expanded
- No conditional rendering based on length
- Proper placeholders without "e.g."
- Section grade at bottom

**Persistence:** `module_instances.data.constructionElements[]`

### Fire Protection Systems Table
**Rows (6 total):**
1. Sprinklers
2. Detection & Alarm
3. Fire Water Supply
4. Hydrants/Hose Reels
5. Portable Extinguishers
6. Gas Suppression

**Columns:**
- System (fixed, gray background)
- Provided? (Yes/No/Partial dropdown)
- Coverage / Extent (editable input)
- Standard (editable input)
- Comments (editable input)

**Features:**
- Always visible when section expanded
- Dropdown for provided status (Yes/No/Partial)
- Section grade at bottom

**Persistence:** `module_instances.data.fireProtectionItems[]`

## C) Loss Expectancy Model - IMPLEMENTED ✅

### 1. Sums Insured Section (Blue Panel)
**Fields:**
- **Currency** - Dropdown (GBP/USD/EUR)
- **Indemnity Period** - Number input (months), default 12
- **Property Damage Sum Insured** - Number input
- **Business Interruption Sum Insured** - Number input

**Persistence:**
- `data.selectedCurrency`
- `data.indemnityPeriod`
- `data.pdSumInsured`
- `data.biSumInsured`

### 2. EML - Estimated Maximum Loss (Orange Panel)
**Input Fields:**
- **EML PD %** - Number input (0-100), default 25
- **EML BI %** - Number input (0-100), default 25

**Live Calculations:**
- EML PD = PD Sum Insured × EML PD %
- EML BI = BI Sum Insured × EML BI %
- EML Total = EML PD + EML BI

**Display:** Shows calculated values with currency formatting

**Persistence:**
- `data.emlPdPercent`
- `data.emlBiPercent`

### 3. MFL - Maximum Foreseeable Loss (Red Panel)
**Input Fields:**
- **MFL PD %** - Number input (0-100), default 100
- **MFL BI %** - Number input (0-100), default 100

**Live Calculations:**
- MFL PD = PD Sum Insured × MFL PD %
- MFL BI = BI Sum Insured × MFL BI %
- MFL Total = MFL PD + MFL BI

**Display:** Shows calculated values with currency formatting

**Persistence:**
- `data.mflPdPercent`
- `data.mflBiPercent`

### 4. Currency Formatting
Implemented `formatCurrency()` function:
- GBP: £1,000,000
- USD: $1,000,000
- EUR: €1,000,000
- Locale-aware formatting with comma separators

### 5. Comments Field
**Loss Expectancy Comments** - Textarea for additional notes

**Persistence:** `data.lossExpectancyComments`

## Additional Sections Maintained

### Management Systems (12 fields)
- Each field has textarea + rating (1-5) using RatingRadio
- All 12 management aspects properly implemented
- Section grade at bottom

### Natural Hazards
- Add/remove dynamic entries
- Type, description, mitigation measures
- Section grade at bottom

### Business Continuity
- Business interruption considerations
- Contingency planning
- Supply chain
- Section grade at bottom

### Recommendations
- Auto-generated from section ratings ≤ 2
- Manual recommendations can be added
- Priority badges (Critical/High/Medium/Low)
- Status tracking

## Technical Implementation

**State Management:**
- All 30+ state variables properly initialized
- Defaults loaded from `moduleInstance.data`
- Document control defaults from profile and document
- Loss metrics calculated on render (reactive)

**Data Persistence:**
- All fields saved to `module_instances.data.*`
- Proper payload construction in `buildPayload()`
- Sanitization via `sanitizeModuleInstancePayload()`
- Update local moduleInstance.data after save

**UI/UX:**
- Clean, professional styling with neutral color palette
- Collapsible sections (all default expanded)
- Color-coded loss expectancy panels (blue/orange/red)
- Hover effects on table rows
- Responsive grid layouts
- Proper input focus states

## Removed
- Debug banners (FORCE REAL)
- Placeholder text with "e.g., Steel"
- Broken accordion logic
- Old WCL tables (replaced with proper EML/MFL)
- Confusing sums insured row structure

## Build Verification
```bash
npm run build
✓ 1908 modules transformed
✓ built in 15.37s
```

## File Modified
- `src/components/modules/forms/RiskEngineeringForm.tsx` (1,270 lines)

## Acceptance Criteria - ALL MET ✅

1. **Document Control visible at top** ✅
   - Assessor name (defaults to profile)
   - Assessment date (defaults to today)
   - Site name (defaults to document.title)
   - Scope and standards fields

2. **Construction table visible and editable** ✅
   - 5 rows with proper labels
   - Type/Material, Fire Resistance, Comments columns
   - No placeholders like "e.g. Steel"

3. **Fire protection table visible and editable** ✅
   - 6 rows with proper labels
   - Provided dropdown, Coverage, Standard, Comments
   - All fields editable

4. **Loss section shows Sums Insured + EML + MFL** ✅
   - Currency selector (GBP/USD/EUR)
   - PD and BI sum insured inputs
   - EML percentages with live calculations
   - MFL percentages with live calculations
   - Currency-formatted display of all values

5. **Data persistence works** ✅
   - Save → Refresh → All data retained
   - Module instance dataKeys populated
   - No more "none (not saved yet)"

6. **No placeholder text remaining** ✅
   - Removed "e.g., Steel" type placeholders
   - Professional, concise guidance text only
