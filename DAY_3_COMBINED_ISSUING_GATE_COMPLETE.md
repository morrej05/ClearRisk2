# Day 3: Combined Issuing Gate Implementation Complete

## Objective
For documents with both FRA and FSD modules enabled, enforce that BOTH FRA and FSD requirements must pass before the document can be issued.

## Status: ✅ COMPLETE

Combined issuing validation fully implemented. Documents with multiple enabled modules (e.g., FRA + FSD) are validated against ALL module requirements before issuance.

---

## Implementation Summary

### Server-Side Validation (Edge Function)

#### File: `supabase/functions/issue-survey/index.ts`

**Already Implemented:**
- Reads `enabled_modules` from survey (lines 185-187)
- Falls back to `survey_type` for backward compatibility
- Calls `validateIssueEligibilityForModules` for combined validation

**Key Logic:**
```typescript
// Determine which modules need validation
const modulesToValidate = survey.enabled_modules && survey.enabled_modules.length > 0
  ? survey.enabled_modules
  : [survey.document_type as SurveyType];

const validation = validateIssueEligibilityForModules(
  modulesToValidate as SurveyType[],
  ctx,
  survey.form_data || {},
  moduleProgress,
  actions || []
);

if (!validation.eligible) {
  return new Response(
    JSON.stringify({
      error: 'Survey does not meet issue requirements',
      blockers: validation.blockers,
    }),
    {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
```

**Combined Validation Function:**
```typescript
function validateIssueEligibilityForModules(
  types: SurveyType[],
  ctx: IssueCtx,
  answers: any,
  moduleProgress: ModuleProgress,
  actions: Array<{ status: string }>
): ValidationResult {
  const allBlockers: Blocker[] = [];

  // Validate each module type
  for (const type of types) {
    const validation = validateIssueEligibility(type, ctx, answers, moduleProgress, actions);
    allBlockers.push(...validation.blockers);
  }

  return {
    eligible: allBlockers.length === 0,
    blockers: allBlockers,
  };
}
```

**How It Works:**
1. For each enabled module (FRA, FSD, DSEAR):
   - Runs module-specific validation
   - Collects all blockers from all modules
2. Document is eligible ONLY if NO blockers exist from ANY module
3. Returns 400 error with all blockers if any module fails

---

### Client-Side Validation

#### File: `src/utils/issueValidation.ts`

**Already Implemented:**
- Mirrors server-side logic exactly
- Same `validateIssueEligibilityForModules` function
- Used by UI for real-time feedback

**Function Signature:**
```typescript
export function validateIssueEligibilityForModules(
  types: SurveyType[],
  ctx: IssueCtx,
  answers: any,
  moduleProgress: ModuleProgress,
  actions: Array<{ status: ActionStatus }>
): ValidationResult {
  const allBlockers: Blocker[] = [];

  // Validate each module type
  for (const type of types) {
    const validation = validateIssueEligibility(type, ctx, answers, moduleProgress, actions);
    allBlockers.push(...validation.blockers);
  }

  return {
    eligible: allBlockers.length === 0,
    blockers: allBlockers,
  };
}
```

**Module-Specific Validation:**
- `validateFra()` - FRA-specific rules
- `validateFsd()` - FSD-specific rules  
- `validateDsear()` - DSEAR-specific rules

Each function checks:
- Required modules completed
- Conditional requirements met
- Survey-specific business rules

---

### UI Component Updates

#### File: `src/components/issue/IssueReadinessPanel.tsx`

**Updated to Support Combined Modules:**

**New Props:**
```typescript
interface IssueReadinessPanelProps {
  surveyId: string;
  surveyType?: SurveyType;        // Optional (for backward compatibility)
  enabledModules?: SurveyType[];  // NEW: Array of enabled modules
  ctx: IssueCtx;
  moduleProgress: ModuleProgress;
  answers: any;
  actions: any[];
  canIssue: boolean;
}
```

**Validation Logic:**
```typescript
const modulesToValidate = enabledModules && enabledModules.length > 0
  ? enabledModules
  : surveyType ? [surveyType] : [];

const validation = modulesToValidate.length > 1
  ? validateIssueEligibilityForModules(modulesToValidate, ctx, answers, moduleProgress, actions)
  : validateIssueEligibility(modulesToValidate[0] || 'FRA', ctx, answers, moduleProgress, actions);
```

**Module Deduplication:**
```typescript
const allRequiredModules = new Map<string, ReturnType<typeof getRequiredModules>>();
modulesToValidate.forEach((type) => {
  allRequiredModules.set(type, getRequiredModules(type, ctx));
});

const requiredModules = Array.from(allRequiredModules.values()).flat();
const uniqueRequiredModules = Array.from(
  new Map(requiredModules.map(m => [m.key, m])).values()
);
```

**Combined Requirements Display:**
When multiple modules are enabled, conditional requirements show module tags:
- `[FRA] Recommendations OR "No Significant Findings" confirmed`
- `[FSD] Limitations documented (engineered solutions)`
- `[DSEAR] Zone classification OR "No zoned areas" confirmed`

**Benefits:**
- Clear visual indication of which module each requirement belongs to
- Easy to identify which module is blocking issuance
- All requirements from all modules shown in single panel

---

## Validation Requirements by Module

### FRA (Fire Risk Assessment)

**Required Modules:**
- A1_DOC_CONTROL (Survey Info)
- A2_BUILDING_PROFILE (Property Details)
- A3_PERSONS_AT_RISK
- A4_MANAGEMENT_CONTROLS
- A5_EMERGENCY_ARRANGEMENTS
- FRA_1_HAZARDS
- FRA_2_ESCAPE_ASIS (Means of Escape)
- FRA_3_PROTECTION_ASIS (Fire Protection)
- FRA_4_SIGNIFICANT_FINDINGS

**Conditional Requirements:**
- **IF** scope is limited/desktop → Scope limitations text required
- **ALWAYS** → Must have recommendations OR "No Significant Findings" confirmed

### FSD (Fire Strategy Document)

**Required Modules:**
- A1_DOC_CONTROL (Survey Info)
- A2_BUILDING_PROFILE (Property Details)
- A3_PERSONS_AT_RISK
- FSD_1_REG_BASIS (Regulatory Basis)
- FSD_2_EVAC_STRATEGY (Evacuation Strategy)
- FSD_3_ESCAPE_DESIGN
- FSD_4_PASSIVE_PROTECTION
- FSD_5_ACTIVE_SYSTEMS
- FSD_6_FRS_ACCESS (Fire Service Access)
- **Conditional:** FSD_8_SMOKE_CONTROL (if smoke control applicable)

**Conditional Requirements:**
- **IF** engineered solutions used → Limitations text required
- **IF** engineered solutions used → Management assumptions text required

### DSEAR (Explosive Atmospheres)

**Required Modules:**
- A1_DOC_CONTROL (Survey Info)
- A2_BUILDING_PROFILE (Property Details)
- A3_PERSONS_AT_RISK
- DSEAR_1_DANGEROUS_SUBSTANCES
- DSEAR_2_PROCESS_RELEASES
- DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION
- DSEAR_4_IGNITION_SOURCES
- DSEAR_5_EXPLOSION_PROTECTION
- DSEAR_6_RISK_ASSESSMENT
- DSEAR_10_HIERARCHY_OF_CONTROL
- DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE

**Conditional Requirements:**
- **ALWAYS** → Substances identified OR "No dangerous substances" confirmed
- **ALWAYS** → Zone classification OR "No zoned areas" confirmed
- **ALWAYS** → Actions OR "Controls adequate" confirmed

---

## Combined Validation Example

### Scenario: FRA + FSD Document

**Enabled Modules:** `['FRA', 'FSD']`

**Required Modules (Merged & Deduplicated):**
1. A1_DOC_CONTROL (shared - appears once)
2. A2_BUILDING_PROFILE (shared - appears once)
3. A3_PERSONS_AT_RISK (shared - appears once)
4. A4_MANAGEMENT_CONTROLS (FRA)
5. A5_EMERGENCY_ARRANGEMENTS (FRA)
6. FRA_1_HAZARDS (FRA)
7. FRA_2_ESCAPE_ASIS (FRA)
8. FRA_3_PROTECTION_ASIS (FRA)
9. FRA_4_SIGNIFICANT_FINDINGS (FRA)
10. FSD_1_REG_BASIS (FSD)
11. FSD_2_EVAC_STRATEGY (FSD)
12. FSD_3_ESCAPE_DESIGN (FSD)
13. FSD_4_PASSIVE_PROTECTION (FSD)
14. FSD_5_ACTIVE_SYSTEMS (FSD)
15. FSD_6_FRS_ACCESS (FSD)
16. FSD_8_SMOKE_CONTROL (FSD - if applicable)

**Conditional Requirements:**
- [FRA] Recommendations OR "No Significant Findings" confirmed
- [FSD] Limitations documented (if engineered solutions used)
- [FSD] Management assumptions documented (if engineered solutions used)

**Validation Process:**
1. Run FRA validation → collect FRA blockers
2. Run FSD validation → collect FSD blockers
3. Merge all blockers
4. **Eligible = TRUE** only if BOTH FRA and FSD pass (no blockers)

---

## Testing Scenarios

### Test 1: Combined Survey - FRA Complete, FSD Incomplete

**Setup:**
- Document with `enabled_modules = ['FRA', 'FSD']`
- All FRA modules completed
- FSD modules incomplete

**Expected Result:**
```json
{
  "eligible": false,
  "blockers": [
    {
      "type": "module_incomplete",
      "moduleKey": "FSD_1_REG_BASIS",
      "message": "Module FSD_1_REG_BASIS must be completed"
    },
    {
      "type": "module_incomplete",
      "moduleKey": "FSD_2_EVAC_STRATEGY",
      "message": "Module FSD_2_EVAC_STRATEGY must be completed"
    },
    // ... other FSD blockers
  ]
}
```

**Outcome:**
- ❌ Issue button disabled
- ⚠️ Error shows FSD blockers
- ✅ FRA requirements satisfied but not sufficient

### Test 2: Combined Survey - FSD Complete, FRA Incomplete

**Setup:**
- Document with `enabled_modules = ['FRA', 'FSD']`
- All FSD modules completed
- FRA modules incomplete

**Expected Result:**
```json
{
  "eligible": false,
  "blockers": [
    {
      "type": "module_incomplete",
      "moduleKey": "FRA_1_HAZARDS",
      "message": "Module FRA_1_HAZARDS must be completed"
    },
    {
      "type": "module_incomplete",
      "moduleKey": "FRA_2_ESCAPE_ASIS",
      "message": "Module FRA_2_ESCAPE_ASIS must be completed"
    },
    // ... other FRA blockers
  ]
}
```

**Outcome:**
- ❌ Issue button disabled
- ⚠️ Error shows FRA blockers
- ✅ FSD requirements satisfied but not sufficient

### Test 3: Combined Survey - Both Complete

**Setup:**
- Document with `enabled_modules = ['FRA', 'FSD']`
- All FRA modules completed
- All FSD modules completed
- All conditional requirements met

**Expected Result:**
```json
{
  "eligible": true,
  "blockers": []
}
```

**Outcome:**
- ✅ Issue button enabled
- ✅ "Ready to Issue" status shown
- ✅ Document can be issued successfully
- ✅ Combined PDF generated

### Test 4: Combined Survey - Conditional Requirements

**Setup:**
- Document with `enabled_modules = ['FRA', 'FSD']`
- All modules completed
- FSD has engineered solutions but no limitations documented

**Expected Result:**
```json
{
  "eligible": false,
  "blockers": [
    {
      "type": "conditional_missing",
      "message": "Limitations required when using engineered solutions"
    },
    {
      "type": "conditional_missing",
      "message": "Management assumptions required when using engineered solutions"
    }
  ]
}
```

**Outcome:**
- ❌ Issue button disabled
- ⚠️ Shows FSD conditional requirements not met
- 📝 User must document limitations and assumptions

### Test 5: Single Module (FRA-only) - Backward Compatibility

**Setup:**
- Document with `enabled_modules = ['FRA']` (or legacy `survey_type = 'FRA'`)
- All FRA modules completed

**Expected Result:**
```json
{
  "eligible": true,
  "blockers": []
}
```

**Outcome:**
- ✅ Behaves exactly as before
- ✅ Only FRA requirements validated
- ✅ No changes to existing functionality

### Test 6: Single Module (FSD-only) - Backward Compatibility

**Setup:**
- Document with `enabled_modules = ['FSD']` (or legacy `survey_type = 'FSD'`)
- All FSD modules completed

**Expected Result:**
```json
{
  "eligible": true,
  "blockers": []
}
```

**Outcome:**
- ✅ Behaves exactly as before
- ✅ Only FSD requirements validated
- ✅ No changes to existing functionality

---

## User Experience Flow

### Combined FRA + FSD Document Issuance

**Step 1: Complete FRA Modules**
- User completes all FRA-specific modules
- Readiness panel shows:
  - ✅ FRA modules complete (7/7)
  - ⚠️ FSD modules incomplete (0/6)
  - Overall: Not Ready (FSD blockers present)

**Step 2: Complete FSD Modules**
- User completes all FSD-specific modules
- Readiness panel shows:
  - ✅ FRA modules complete (7/7)
  - ✅ FSD modules complete (6/6)
  - Overall: Not Ready (conditional requirements)

**Step 3: Meet Conditional Requirements**
- User adds recommendations (FRA)
- User documents limitations (FSD, if using engineered solutions)
- Readiness panel shows:
  - ✅ All modules complete
  - ✅ All conditional requirements met
  - Overall: Ready to Issue

**Step 4: Issue Document**
- User clicks "Issue Document"
- Server validates both FRA and FSD requirements
- If all pass:
  - Combined PDF generated
  - Document marked as issued
  - PDF locked
- If any fail:
  - Returns blockers
  - User must resolve before retry

---

## Technical Details

### Blocker Structure

```typescript
interface Blocker {
  type: BlockerType;
  moduleKey?: string;      // Optional: specific module that's blocking
  fieldKey?: string;        // Optional: specific field that's missing
  message: string;          // Human-readable error message
}

type BlockerType =
  | 'module_incomplete'      // Module not completed
  | 'missing_field'          // Required field missing
  | 'conditional_missing'    // Conditional requirement not met
  | 'confirm_missing'        // Confirmation checkbox not checked
  | 'no_recommendations';    // No recommendations or confirmation
```

### Validation Result Structure

```typescript
interface ValidationResult {
  eligible: boolean;         // TRUE if can issue, FALSE if blocked
  blockers: Blocker[];       // Array of all issues preventing issuance
}
```

### Issue Context (IssueCtx)

```typescript
interface IssueCtx {
  scope_type?: 'full' | 'limited' | 'desktop' | 'other';
  engineered_solutions_used?: boolean;
  suppression_applicable?: boolean;
  smoke_control_applicable?: boolean;
}
```

**Context determines conditional requirements:**
- Limited/desktop scope → FRA scope limitations required
- Engineered solutions → FSD limitations + assumptions required
- Smoke control applicable → FSD smoke control module required

---

## Backward Compatibility

### Legacy Documents

**Documents without `enabled_modules`:**
- Falls back to `document_type` field
- Validated as single-module document
- No breaking changes

**Example:**
```typescript
// Legacy document
{
  document_type: 'FRA',
  enabled_modules: null  // or undefined
}

// Validation treats as: enabled_modules = ['FRA']
```

### Legacy API Calls

**Edge function handles both:**
```typescript
const modulesToValidate = survey.enabled_modules && survey.enabled_modules.length > 0
  ? survey.enabled_modules
  : [survey.document_type as SurveyType];
```

### UI Components

**IssueReadinessPanel:**
- Accepts both `surveyType` (legacy) and `enabledModules` (new)
- Prioritizes `enabledModules` if provided
- Falls back to `surveyType` for backward compatibility

---

## Security & Integrity

### Server is Source of Truth

**Client-side validation:**
- Provides real-time UX feedback
- Disables issue button when blocked
- Shows helpful error messages

**Server-side validation:**
- ALWAYS runs on issue attempt
- Cannot be bypassed
- Returns 400 error if any blockers
- Prevents issuing incomplete documents

### Defense in Depth

**Multiple layers of protection:**
1. UI disables issue button (UX)
2. Client validation shows blockers (UX)
3. Server validation enforces rules (security)
4. Edge function runs same logic (consistency)
5. Database RLS prevents unauthorized access (security)
6. Approval workflow gate (if enabled)

---

## Key Implementation Notes

### 1. Module Deduplication

Shared modules (A1, A2, A3) appear in both FRA and FSD skeletons.

**Problem:** Without deduplication, shared modules counted twice.

**Solution:** Use Map to deduplicate by module key:
```typescript
const uniqueRequiredModules = Array.from(
  new Map(requiredModules.map(m => [m.key, m])).values()
);
```

### 2. Conditional Module Requirements

Some modules are conditionally required based on context:

**FSD:** Smoke control module only required if `smoke_control_applicable = true`

**Implementation:**
```typescript
if (type === 'FSD') {
  const modules = [
    ...common,
    MODULE_KEYS.regulatory_basis,
    // ... other always-required modules
  ];

  if (ctx.smoke_control_applicable) {
    modules.push(MODULE_KEYS.smoke_control);
  }

  return modules;
}
```

### 3. Blocker Merging

Blockers from all modules merged into single array:

```typescript
for (const type of types) {
  const validation = validateIssueEligibility(type, ctx, answers, moduleProgress, actions);
  allBlockers.push(...validation.blockers);  // Spread all blockers
}
```

**Result:** Single list of all issues across all modules.

### 4. Module Labels in Combined View

When multiple modules enabled, requirements show module prefix:

```typescript
const fraLabel = modulesToValidate.length > 1 ? '[FRA] ' : '';
const fsdLabel = modulesToValidate.length > 1 ? '[FSD] ' : '';

conditionals.push({
  label: `${fraLabel}Recommendations OR "No Significant Findings" confirmed`,
  met: hasRecommendations || noSignificantFindings,
  moduleType: 'FRA',
});
```

**Benefits:**
- Clear which module each requirement belongs to
- Easy to identify blocking module
- No confusion in combined views

---

## Files Modified

### Server-Side
```
supabase/functions/issue-survey/index.ts
  - Already had combined validation logic
  - Reads enabled_modules from survey
  - Calls validateIssueEligibilityForModules
  - Returns merged blockers
```

### Client-Side Validation
```
src/utils/issueValidation.ts
  - Already had validateIssueEligibilityForModules
  - Mirrors server-side logic
  - Used by UI components
```

### UI Components
```
src/components/issue/IssueReadinessPanel.tsx
  - Added enabledModules prop
  - Supports combined module validation
  - Shows module-tagged requirements
  - Deduplicates shared modules
  - Backward compatible with surveyType prop
```

---

## Summary

✅ **Server-Side Validation:** Already implemented (validates all enabled modules)
✅ **Client-Side Validation:** Already implemented (mirrors server logic)
✅ **UI Component:** Updated to support combined modules
✅ **Backward Compatible:** Legacy documents work unchanged
✅ **Security:** Server enforces rules (cannot be bypassed)
✅ **UX:** Clear feedback on which modules are blocking
✅ **Build:** Succeeds with no TypeScript errors

**Combined issuing gate is production-ready!**

Documents with both FRA and FSD enabled must pass BOTH sets of requirements before issuance. The system correctly validates, displays, and enforces these requirements across all layers (UI, client validation, server validation).

---

## Next Steps (Not Part of This Implementation)

**Potential Future Enhancements:**
1. Visual grouping of requirements by module in readiness panel
2. Collapsible sections for each module's requirements
3. Progress bars per module (FRA: 7/7, FSD: 4/6)
4. "Complete FRA First" or "Complete FSD First" workflow hints
5. Dependency warnings (e.g., "Complete shared modules before module-specific ones")

These are NOT required for the current implementation - the system is fully functional as-is.

---

## End of Combined Issuing Gate Implementation
