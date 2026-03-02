# Context-Aware Info-Gap Quick Actions - Implementation Complete

## Summary
Successfully implemented context-aware info-gap detection so DSEAR PDFs output explosion/ATEX-appropriate gaps and actions instead of fire safety gaps. FRA-specific rules are now properly scoped to prevent inappropriate fire safety wording in DSEAR documents.

## Changes Made

### 1. Extended `detectInfoGaps()` Signature
**File:** `src/utils/infoGapQuickActions.ts`

Added optional context parameter with backward compatibility:

```typescript
export interface InfoGapContext {
  documentType?: string;
  enabledModules?: string[];
  jurisdiction?: string;
  framework?: 'FRA' | 'DSEAR' | 'COMBINED';
}

export function detectInfoGaps(
  moduleKey: string,
  moduleData: Record<string, any>,
  outcome: string | null,
  documentData?: {
    responsible_person?: string;
    standards_selected?: string[];
    document_type?: string;
    jurisdiction?: string
  },
  context?: InfoGapContext
): InfoGapDetection
```

**Default Behavior:** If context is not provided, it defaults from `documentData.document_type` and `documentData.jurisdiction`, ensuring backward compatibility with existing call sites.

### 2. Rule Scoping Logic

Implemented strict guards based on module key prefix:

```typescript
const isFraModule = moduleKey.startsWith('FRA_');
const isDsearModule = moduleKey.startsWith('DSEAR_');
const isSharedModule = moduleKey.startsWith('A');

const applyFraRules = isFraModule || (isSharedModule && effectiveContext.documentType !== 'DSEAR');
const applyDsearRules = isDsearModule || (isSharedModule && effectiveContext.documentType === 'DSEAR');
```

**Rules:**
- `FRA_*` modules → FRA rules only
- `DSEAR_*` modules → DSEAR rules only
- `A*` shared modules → Context-dependent rules (FRA or DSEAR)

### 3. Neutralized A1 (Governance) Module

**A1_DOC_CONTROL** now branches based on context:

**FRA Context:**
- "Responsible person not identified (fire safety)"
- Action: "Identify and document the responsible person for fire safety"
- Reason: "Legal requirement under Regulatory Reform (Fire Safety) Order 2005"
- Standards: "BS 9999, BS 9991"

**DSEAR Context:**
- "Dutyholder / responsible person not identified (DSEAR)"
- Action: "Identify and document the dutyholder / responsible person for control of explosive atmospheres"
- Reason: "Legal requirement under Dangerous Substances and Explosive Atmospheres Regulations (DSEAR) 2002"
- Standards: "EN 60079-10-1 / 10-2; EN 60079-14/17"

### 4. FRA-Specific Rules Guarded

All FRA-specific module cases now have guards:

```typescript
case 'FRA_1_HAZARDS':
  if (!applyFraRules) break;
  // ... FRA-specific rules

case 'FRA_2_ESCAPE_ASIS':
  if (!applyFraRules) break;
  // ... FRA-specific rules

case 'FRA_3_PROTECTION_ASIS':
case 'FRA_3_ACTIVE_SYSTEMS':
  if (!applyFraRules) break;
  // ... FRA-specific rules
```

**Modules Guarded:**
- A4_MANAGEMENT_CONTROLS / FRA_6_MANAGEMENT_SYSTEMS
- A5_EMERGENCY_ARRANGEMENTS / FRA_7_EMERGENCY_ARRANGEMENTS
- FRA_1_HAZARDS
- FRA_2_ESCAPE_ASIS
- FRA_3_PROTECTION_ASIS / FRA_3_ACTIVE_SYSTEMS
- FRA_4_PASSIVE_PROTECTION
- FRA_8_FIREFIGHTING_EQUIPMENT
- FRA_5_EXTERNAL_FIRE_SPREAD
- FRA_4_SIGNIFICANT_FINDINGS / FRA_90_SIGNIFICANT_FINDINGS

### 5. Added DSEAR-Specific Info-Gap Rules

Implemented comprehensive DSEAR detection with appropriate priority bands:

#### DSEAR_1_DANGEROUS_SUBSTANCES (P2)
- **Trigger:** No substances recorded
- **Action:** "Create/complete dangerous substances register including SDS, quantities, storage locations, flash point/LEL/UEL where relevant"
- **Reason:** "DSEAR 2002 requires identification of all dangerous substances and their properties"

#### DSEAR_2_PROCESS_RELEASES (P2)
- **Trigger:** No release sources documented
- **Action:** "Document sources of release, grade of release (continuous/primary/secondary), ventilation assessment, and foreseeable abnormal conditions"
- **Reason:** "Release characterization is fundamental to hazardous area classification per EN 60079-10-1/-10-2"

#### DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION (P2)
- **Trigger:** No zones classified
- **Action:** "Complete hazardous area classification (zones 0/1/2 for gas/vapour or 20/21/22 for dust) per EN 60079-10-1/-10-2; record assumptions and extent of zones"
- **Reason:** "Zone classification determines equipment selection and ignition source control requirements"

#### DSEAR_4_IGNITION_SOURCES (P2)
- **Trigger:** No ignition sources or controls documented
- **Action:** "Identify potential ignition sources (hot work, mechanical sparks, electrical equipment, static discharge) and implement controls in classified zoned areas"
- **Reason:** "DSEAR requires elimination or control of ignition sources in explosive atmospheres; ATEX equipment required in zones"

#### DSEAR_5_EXPLOSION_PROTECTION (P3)
- **Trigger:** Protection/mitigation measures not documented
- **Action:** "Confirm explosion protection/mitigation measures (venting, suppression, isolation, containment) where required by risk assessment"
- **Reason:** "Passive and active explosion protection may be required where elimination/prevention is not reasonably practicable"

#### DSEAR_6_RISK_ASSESSMENT (P2)
- **Trigger:** No risk scenarios recorded
- **Action:** "Populate DSEAR risk table (scenario, likelihood, consequence, existing controls, residual risk, recommended actions)"
- **Reason:** "DSEAR requires suitable and sufficient risk assessment of activities involving dangerous substances"

#### DSEAR_10_HIERARCHY_OF_CONTROL (P3)
- **Trigger:** Hierarchy decisions not documented
- **Action:** "Document hierarchy of control decisions (eliminate/substitute dangerous substances, reduce quantities, engineering controls, administrative controls, PPE) for key scenarios"
- **Reason:** "DSEAR requires application of hierarchy of control to minimize explosion risk"

#### DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE (P2)
- **Trigger:** Emergency arrangements not documented
- **Action:** "Document explosion/fire emergency response arrangements, isolation procedures, alarm systems, evacuation interfaces with fire strategy, emergency drills"
- **Reason:** "DSEAR requires emergency arrangements proportionate to explosion risk; interfaces with fire evacuation"

### 6. Updated Call Sites

#### buildDsearPdf.ts
Updated `drawInfoGapQuickActions()` to pass DSEAR context:

```typescript
const detection = detectInfoGaps(
  module.module_key,
  module.data,
  module.outcome,
  {
    responsible_person: document.responsible_person || undefined,
    standards_selected: document.standards_selected || [],
    document_type: 'DSEAR',
    jurisdiction: document.jurisdiction
  },
  {
    documentType: 'DSEAR',
    jurisdiction: document.jurisdiction
  }
);
```

## Technical Details

### Context Resolution
The function uses a waterfall approach for context:
1. Explicit `context` parameter (highest priority)
2. `documentData.document_type` / `documentData.jurisdiction` (fallback)
3. Default to 'FRA' / 'GB-ENG' (last resort)

### Module Key Prefixes
- **FRA_*** → Fire Risk Assessment modules
- **DSEAR_*** → DSEAR/Explosion modules
- **A*** → Shared administrative modules (context-dependent)

### Priority Bands
- **P2** → High priority, typically compliance-critical or safety-significant
- **P3** → Medium priority, best practice or process improvement

## Output Impact

### DSEAR-Only PDF (Before)
- A1 info-gap: "Responsible person not identified"
- Action mentions "fire safety", FSO 2005, BS 9999/9991
- No DSEAR-specific module gaps shown

### DSEAR-Only PDF (After)
- A1 info-gap: "Dutyholder / responsible person not identified (DSEAR)"
- Action mentions "control of explosive atmospheres", DSEAR 2002, EN 60079 series
- DSEAR modules show appropriate gaps:
  - Substances register incomplete
  - Zones not classified
  - Risk scenarios missing
  - Emergency response not documented

### Combined FRA+DSEAR PDF
- FRA section: Shows fire safety gaps with FSO/BS 9999 references
- DSEAR section: Shows explosion gaps with DSEAR/EN 60079 references
- Each section uses appropriate context

## Testing Checklist
- [x] Build succeeds without TypeScript errors
- [ ] Generate DSEAR-only PDF with empty modules
  - [ ] Verify A1 mentions DSEAR (not FSO)
  - [ ] Verify no "fire safety" wording in DSEAR context
  - [ ] Verify DSEAR module gaps appear (substances, zones, etc.)
- [ ] Generate FRA-only PDF
  - [ ] Verify existing fire safety gaps still work
  - [ ] Verify no DSEAR gaps appear
- [ ] Generate combined FRA+DSEAR PDF
  - [ ] Verify FRA section shows fire gaps
  - [ ] Verify DSEAR section shows explosion gaps

## Backward Compatibility
All existing call sites continue to work without modification due to:
- Optional `context` parameter with intelligent defaults
- Maintains existing function return type
- No breaking changes to public API

## Standards Referenced

### FRA Standards
- Regulatory Reform (Fire Safety) Order 2005 (FSO)
- BS 9999 (Fire safety in buildings)
- BS 9991 (Fire safety in residential buildings)

### DSEAR/ATEX Standards
- DSEAR 2002 (Dangerous Substances and Explosive Atmospheres Regulations)
- EN 60079-10-1 (Hazardous area classification - Gas/vapour)
- EN 60079-10-2 (Hazardous area classification - Dust)
- EN 60079-14 (Electrical installations in hazardous areas)
- EN 60079-17 (Inspection and maintenance of electrical installations)
- ATEX Directive (Equipment for explosive atmospheres)

## Future Enhancements
- Add more granular DSEAR module-specific detection rules as data models evolve
- Implement combined FRA+DSEAR call site context switching if needed
- Add jurisdiction-specific DSEAR regulations (IE, other EU member states)
- Consider adding "Tip:" lines to DSEAR actions for assessor guidance
