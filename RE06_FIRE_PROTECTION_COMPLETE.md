# RE-06 Fire Protection - COMPLETE

## Overview
Built comprehensive fire protection assessment module (RE-06) for Risk Engineering assessments, covering site-level water supply/pumps and building-level sprinkler systems with intelligent scoring and validation.

## Database Schema

### Tables Created
1. **re06_site_water** (site-level water supply)
   - `id` (uuid, pk)
   - `document_id` (uuid, fk documents.id) - UNIQUE
   - `data` (jsonb) - water reliability, supply type, pumps, power, testing
   - `water_score_1_5` (int 1-5)
   - `comments` (text)
   - `created_at`, `updated_at`

2. **re06_building_sprinklers** (building-level sprinklers)
   - `id` (uuid, pk)
   - `document_id` (uuid, fk documents.id)
   - `building_id` (uuid, fk re_buildings.id)
   - `data` (jsonb) - coverage %, standard, adequacy, maintenance
   - `sprinkler_score_1_5` (int 1-5)
   - `final_active_score_1_5` (int 1-5) - min(sprinkler, water)
   - `comments` (text)
   - `created_at`, `updated_at`
   - UNIQUE constraint on (document_id, building_id)

### Security
- RLS enabled on both tables
- Policies restrict access to documents within user's organisation
- Separate policies for SELECT, INSERT, UPDATE
- Updated_at triggers for automatic timestamp management

## Data Model & Scoring Logic

### Site Water Score (1-5)
**Factors:**
- Water reliability: Reliable | Unreliable | Unknown
- Supply type (text): town main / tank / reservoir / ring main
- Pumps present (boolean)
- Pump arrangement: None | Single | Duty+Standby | Unknown
- Power resilience: Good | Mixed | Poor | Unknown
- Testing regime: Documented | Some evidence | None | Unknown
- Key weaknesses (text)

**Scoring guidance:**
- **5**: Reliable + robust config + documented testing + no SPOF
- **4**: Generally reliable with minor gaps
- **3**: Uncertain / mixed / limited evidence (explicitly acceptable)
- **2**: Likely unreliable with clear vulnerabilities
- **1**: Unreliable / major defects / not credible

**Auto-calculation:** `calculateWaterScore()` suggests score based on inputs; user can override.

### Building Sprinkler Score (1-5 or N/A)
**Factors:**
- Coverage required (%)
- Coverage installed (%)
- Sprinkler standard (text): BS EN 12845 / NFPA 13 / other
- Hazard class (text): OH1, OH2, etc.
- Maintenance status: Good | Mixed | Poor | Unknown
- Sprinkler adequacy: Adequate | Inadequate | Unknown
- Justification if required < 100%

**Scoring guidance:**
Let C = installed / required (capped at 1.0)
- If required = 0: **N/A** (set score = 5, excluded from roll-up)
- **5**: Adequate + C ≥ 0.95 + good maintenance + suitable standard
- **4**: Largely adequate (0.80 ≤ C < 0.95) or C ≥ 0.95 with minor gaps
- **3**: Partially adequate/uncertain (0.60 ≤ C < 0.80) or missing data
- **2**: Inadequate (0.30 ≤ C < 0.60) or significant functional gaps
- **1**: Seriously inadequate (C < 0.30) or system not credible

**Auto-calculation:** `calculateSprinklerScore()` suggests score; user can override.

### Final Active Score
**Formula:** `final_active_score_1_5 = min(sprinkler_score_1_5, water_score_1_5)`
- Reflects that excellent sprinklers are limited by poor water supply
- If sprinklers not required (coverage = 0), final score = 5 (N/A)

## UI Features

### Layout
```
┌─────────────────────────────────────────────────────────┐
│ Header: RE-06 Fire Protection + Document Title         │
├─────────────────────────────────────────────────────────┤
│ Site Water & Fire Pumps (card)                         │
│ - Water reliability, supply type, pumps, testing       │
│ - Water score 1-5 with visual indicators               │
│ - Comments + guidance popover                          │
├──────────────────┬──────────────────────────────────────┤
│ Building List    │ Building Sprinkler Panel            │
│ (left sidebar)   │ (main content)                      │
│ - Building name  │ - Auto-flags (warnings/info)        │
│ - Area (m²)      │ - Coverage required/installed       │
│ - Final score    │ - Standard, hazard class            │
│                  │ - Maintenance, adequacy             │
│                  │ - Justification field (conditional) │
│                  │ - Final score display               │
│                  │ - Comments                          │
├──────────────────┴──────────────────────────────────────┤
│ Site Roll-up (bottom)                                   │
│ - Area-weighted average final score                    │
│ - Buildings assessed count                             │
│ - Total area (m²)                                       │
└─────────────────────────────────────────────────────────┘
```

### Auto-Flags (Non-blocking Prompts)
1. **Coverage Gap** (warning): Required % > Installed %
   - "Coverage gap: 100% required but only 75% installed"

2. **Inconsistency** (warning): Sprinkler score ≥4 but water score ≤2
   - "Sprinkler system rated highly (4/5) but water supply is unreliable (2/5)"

3. **Rationale Check** (info): Required = 0 but installed > 0
   - "Sprinklers installed but marked as not required - verify rationale"

### Site Roll-up Calculation
**Formula:** Area-weighted average of `final_active_score_1_5`
- **Only includes** buildings where `sprinkler_coverage_required_pct > 0`
- **Excludes** buildings with no sprinkler requirement (N/A)
- **Displays:**
  - Average score (1 decimal place)
  - Buildings assessed count
  - Total area (m²)

**Example:**
- Building A: 1000 m², final score 4
- Building B: 2000 m², final score 3
- Building C: 500 m², required = 0 (excluded)
- Roll-up = (1000×4 + 2000×3) / (1000+2000) = 3.3

## UX Design Principles

### Supportive Wording
- "This structures your judgement; it doesn't replace it"
- Guidance notes in blue info panels
- Score of 3 explicitly acceptable when evidence limited
- No harsh red warnings, just amber/blue prompts

### Progressive Flow
1. **Facts first**: Coverage %, supply type, pump config
2. **Qualitative assessment**: Adequacy, maintenance status
3. **Suggested score**: Auto-calculated from inputs
4. **Override allowed**: User can adjust score based on judgement
5. **Notes**: Comments for rationale/context

### Help Text Strategy
- Inline guidance for critical fields
- Popovers for detailed scoring guidance (future enhancement)
- No massive walls of text
- Keep forms scannable and unintimidating

## Data Persistence

### Strategy
- **Debounced auto-save**: 1000ms (1 second) after last edit
- **Resilient upserts**: Creates records if missing, updates if exists
- **No duplication**: Reuses buildings from RE-02 (canonical source)
- **Cascade deletes**: Building/document deletes cascade to sprinkler records

### Initialization
1. On page load, fetch or create `re06_site_water` for document
2. Fetch buildings from `re_buildings` for document
3. Ensure `re06_building_sprinklers` records exist for all buildings
4. Auto-select first building

### Save Flow
```
User edits field
  ↓
State updated (React)
  ↓
useEffect triggered
  ↓
1000ms debounce timer starts
  ↓
(User continues editing → timer resets)
  ↓
Timer expires
  ↓
Upsert to Supabase
  ↓
State updated with saved record
```

## Engineering Decisions

### Why Separate Tables?
- **Site water**: One per document (site-level infrastructure)
- **Building sprinklers**: One per building per document (building-specific)
- Prevents redundant site water data across buildings
- Enables efficient roll-up queries

### Why Store Scores in DB?
- Enables reporting without recomputing
- Allows user overrides to be persisted
- Historical tracking of score changes
- Simplifies aggregation queries

### Why Exclude Required=0 from Roll-up?
- Buildings with no sprinkler requirement shouldn't dilate average
- N/A ≠ score of 5; it's absence of requirement
- Roll-up reflects "how well are required sprinklers protected?"

### Why Final = Min(Sprinkler, Water)?
- Water supply is a limiting factor
- Excellent sprinklers + poor water = unreliable protection
- Reflects engineering reality of system dependencies

## Files Created/Modified

### New Files
1. `supabase/migrations/20260205150000_create_re06_fire_protection_tables.sql`
   - Database schema + RLS policies

2. `src/lib/re/fireProtectionModel.ts` (275 lines)
   - TypeScript types
   - Scoring functions
   - Auto-flag generation
   - Site roll-up calculation

3. `src/lib/re/fireProtectionRepo.ts` (98 lines)
   - CRUD operations for both tables
   - Get-or-create helpers
   - Bulk initialization for buildings

4. `src/pages/re/FireProtectionPage.tsx` (650+ lines)
   - Full-featured UI component
   - Site water form + score display
   - Building list + selection
   - Building sprinkler form + validation
   - Auto-flags display
   - Site roll-up metrics
   - Debounced persistence

### Modified Files
1. `src/App.tsx`
   - Added import for FireProtectionPage
   - Added route: `/documents/:id/re/fire-protection`

## Access & Navigation

### URL
```
/documents/{documentId}/re/fire-protection
```

### Integration Points
- Link from Document Overview (RE module nav)
- Link from RE-02 Buildings page (future)
- Accessible via document workspace sidebar (future)

## Testing Checklist

### Data Creation
- [x] Site water record auto-created on first visit
- [x] Building sprinkler records auto-created for all buildings
- [x] No duplication of records on re-visits

### Site Water Form
- [x] All fields editable
- [x] Water score auto-calculates from inputs
- [x] User can override water score
- [x] Comments field persists
- [x] Debounced save (1s delay)

### Building Sprinkler Form
- [x] Building selection switches context
- [x] Coverage % fields validate (0-100)
- [x] Sprinkler score auto-calculates
- [x] Final score = min(sprinkler, water)
- [x] Justification field shows when required < 100%
- [x] Comments field persists
- [x] Debounced save (1s delay)

### Auto-Flags
- [x] Coverage gap flag when required > installed
- [x] Inconsistency flag when sprinkler high + water low
- [x] Rationale check when required=0 but installed>0
- [x] Flags update dynamically as user edits

### Site Roll-up
- [x] Average score calculated correctly (area-weighted)
- [x] Only includes buildings with required > 0
- [x] Buildings assessed count correct
- [x] Total area sum correct
- [x] Warning shown when no buildings assessed

### Edge Cases
- [x] No buildings: Shows message, no errors
- [x] All buildings required=0: Roll-up shows warning
- [x] Mixed required/not-required: Only required in roll-up
- [x] Large area numbers: Formatted with commas

## Build Status
✅ **Build successful** (1906 modules, 16.42s)

## Next Steps (Future Enhancements)

1. **Navigation Integration**
   - Add link in DocumentWorkspace sidebar
   - Add "Next: Fire Protection" button in RE-02 Buildings

2. **Score Popover Guidance**
   - Add detailed scoring guidance in expandable panels
   - Show examples for each score level

3. **Validation Warnings**
   - Soft warnings for missing standard/hazard class
   - Prompt if coverage installed > required (unusual)

4. **Reports Integration**
   - Include RE-06 scores in PDF reports
   - Show site roll-up in executive summary
   - Export sprinkler details to CSV

5. **Historical Tracking**
   - Show score history over time
   - Highlight changes since last assessment
   - Track recommendation implementation impact

6. **Bulk Operations**
   - Copy water supply details across similar buildings
   - Apply standard configurations to building groups
   - Batch update maintenance status

## Summary
RE-06 Fire Protection is fully functional with:
- Complete database schema + RLS
- Intelligent auto-scoring with override capability
- Non-blocking auto-flag prompts
- Area-weighted site roll-up
- Debounced auto-save persistence
- Reuses RE-02 buildings (no duplication)
- Supportive UX with progressive disclosure
- Engineer-friendly guidance and scoring

**Key Achievement:** Complex scoring logic (water × sprinkler dependencies) made simple and transparent for engineers through clear UI and supportive guidance.
