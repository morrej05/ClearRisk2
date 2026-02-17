# FRA PDF Refactor - Code Changes Diff

**Visual summary of key code changes made to implement the fixed 1-14 skeleton.**

---

## Main Rendering Loop

### BEFORE (Module-Based)
```typescript
// ❌ OLD: Module-based ordering and rendering
const MODULE_ORDER_LEGACY = [
  'A1_DOC_CONTROL',
  'A2_BUILDING_PROFILE',
  'A3_PERSONS_AT_RISK',
  'FRA_4_SIGNIFICANT_FINDINGS',
  'FRA_90_SIGNIFICANT_FINDINGS',
  'FRA_1_HAZARDS',
  'A4_MANAGEMENT_CONTROLS',
  'FRA_6_MANAGEMENT_SYSTEMS',
  'A5_EMERGENCY_ARRANGEMENTS',
  'FRA_7_EMERGENCY_ARRANGEMENTS',
  'A7_REVIEW_ASSURANCE',
  'FRA_2_ESCAPE_ASIS',
  'FRA_3_PROTECTION_ASIS',
  'FRA_5_EXTERNAL_FIRE_SPREAD',
];

const MODULE_ORDER_SPLIT = [
  'A1_DOC_CONTROL',
  'A2_BUILDING_PROFILE',
  'A3_PERSONS_AT_RISK',
  'FRA_4_SIGNIFICANT_FINDINGS',
  'FRA_90_SIGNIFICANT_FINDINGS',
  'FRA_1_HAZARDS',
  'A4_MANAGEMENT_CONTROLS',
  'FRA_6_MANAGEMENT_SYSTEMS',
  'A5_EMERGENCY_ARRANGEMENTS',
  'FRA_7_EMERGENCY_ARRANGEMENTS',
  'A7_REVIEW_ASSURANCE',
  'FRA_2_ESCAPE_ASIS',
  'FRA_3_ACTIVE_SYSTEMS',
  'FRA_4_PASSIVE_PROTECTION',
  'FRA_8_FIREFIGHTING_EQUIPMENT',
  'FRA_5_EXTERNAL_FIRE_SPREAD',
];

const sortedModules = sortModules(moduleInstances);
const fra4Module = sortedModules.find((m) =>
  m.module_key === 'FRA_4_SIGNIFICANT_FINDINGS' ||
  m.module_key === 'FRA_90_SIGNIFICANT_FINDINGS'
);

if (fra4Module) {
  const result = addNewPage(pdfDoc, isDraft, totalPages);
  page = result.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawExecutiveSummary(page, fra4Module, actions, ...);
  yPosition = drawRiskRatingExplanation(page, fra4Module, ...);
}

// ❌ OLD LOOP: Iterated through sorted modules
for (const module of sortedModules) {
  if (module.module_key === 'FRA_4_SIGNIFICANT_FINDINGS' ||
      module.module_key === 'FRA_90_SIGNIFICANT_FINDINGS') continue;

  const result = addNewPage(pdfDoc, isDraft, totalPages);
  page = result.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawModuleSummary(page, module, document, ...);
  // ↑ This printed "FRA-1: Fire Hazards" as a heading
}
```

### AFTER (Section-Based)
```typescript
// ✅ NEW: Section-based rendering using fixed skeleton
import { FRA_REPORT_STRUCTURE, getSectionTitle } from './fraReportStructure';

const fra4Module = moduleInstances.find((m) =>
  m.module_key === 'FRA_4_SIGNIFICANT_FINDINGS' ||
  m.module_key === 'FRA_90_SIGNIFICANT_FINDINGS'
);

// ✅ NEW LOOP: Iterates through fixed section structure
for (const section of FRA_REPORT_STRUCTURE) {
  // Skip section 1 (cover pages handled separately above)
  if (section.id === 1) continue;

  // Find modules for this section
  const sectionModules = moduleInstances.filter(m =>
    section.moduleKeys.includes(m.module_key)
  );

  // Skip empty sections (except special sections)
  if (sectionModules.length === 0 && section.id !== 13 && section.id !== 14) continue;

  // Create new page for section
  const result = addNewPage(pdfDoc, isDraft, totalPages);
  page = result.page;
  yPosition = PAGE_HEIGHT - MARGIN;

  // ✅ Draw section header (NO module keys)
  yPosition = drawSectionHeader(page, section.id, section.title, font, fontBold, yPosition);
  // ↑ Prints: "5. Fire Hazards & Ignition Sources"
  yPosition -= 10;

  // ✅ Section-specific rendering
  switch (section.id) {
    case 2: // Premises & General Information
      yPosition = renderSection2Premises(page, sectionModules, document, ...);
      break;

    case 3: // Occupants & Vulnerability
      yPosition = renderSection3Occupants(page, sectionModules, document, ...);
      break;

    case 4: // Legislation & Duty Holder
      yPosition = renderSection4Legislation(page, sectionModules, document, ...);
      break;

    case 7: // Fire Detection, Alarm & Warning
      yPosition = renderSection7Detection(page, sectionModules, document, ...);
      break;

    case 8: // Emergency Lighting
      yPosition = renderSection8EmergencyLighting(page, sectionModules, document, ...);
      break;

    case 10: // Fixed Fire Suppression & Firefighting Facilities
      yPosition = renderSection10Suppression(page, sectionModules, document, ...);
      break;

    case 11: // Fire Safety Management & Procedures
      yPosition = renderSection11Management(page, sectionModules, moduleInstances, document, ...);
      break;

    case 13: // Significant Findings, Risk Evaluation & Action Plan
      if (fra4Module) {
        yPosition = drawExecutiveSummary(page, fra4Module, actions, actionRatings, ...);
        yPosition = drawRiskRatingExplanation(page, fra4Module, ...);
      }
      break;

    case 14: // Review & Reassessment
      yPosition = renderSection14Review(page, document, ...);
      break;

    default:
      // Generic section rendering for standard modules
      for (const module of sectionModules) {
        yPosition = drawModuleContent(page, module, document, ...);
        // ↑ Does NOT print module key as heading
      }
      break;
  }
}
```

---

## Module Rendering Function

### BEFORE (drawModuleSummary - with module name)
```typescript
// ❌ OLD: Printed module name as heading
function drawModuleSummary(
  page: PDFPage,
  module: ModuleInstance,
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  const moduleName = getModuleName(module.module_key);
  // ↑ Returns "FRA-1: Fire Hazards"

  yPosition -= 20;
  // ❌ PRINTED MODULE KEY AS HEADING
  page.drawText(moduleName, {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  // ↑ This printed "FRA-1: Fire Hazards" in the PDF

  yPosition -= 25;

  // Outcome badge
  if (module.outcome) {
    const outcomeLabel = getOutcomeLabel(module.outcome);
    const outcomeColor = getOutcomeColor(module.outcome);
    // ... render outcome badge ...
  }

  // Assessor notes
  if (module.assessor_notes && module.assessor_notes.trim()) {
    // ... render assessor notes ...
  }

  // Module data
  yPosition = drawModuleKeyDetails(page, module, document, ...);

  // Info gap quick actions
  yPosition = drawInfoGapQuickActions(page, module, document, ...);

  return yPosition;
}
```

### AFTER (drawModuleContent - NO module name)
```typescript
// ✅ NEW: Does NOT print module name
function drawModuleContent(
  page: PDFPage,
  module: ModuleInstance,
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  // ✅ NO MODULE NAME RETRIEVAL
  // ✅ NO MODULE NAME PRINTING

  // Outcome badge (PRESERVED)
  if (module.outcome) {
    const outcomeLabel = getOutcomeLabel(module.outcome);
    const outcomeColor = getOutcomeColor(module.outcome);

    page.drawText('Outcome:', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    page.drawRectangle({
      x: MARGIN + 70,
      y: yPosition - 3,
      width: 140,
      height: 18,
      color: outcomeColor,
    });
    page.drawText(outcomeLabel, {
      x: MARGIN + 75,
      y: yPosition,
      size: 10,
      font,
      color: rgb(1, 1, 1),
    });

    yPosition -= 25;
  }

  // Assessor notes (PRESERVED)
  if (module.assessor_notes && module.assessor_notes.trim()) {
    page.drawText('Assessor Notes:', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 18;
    const notesLines = wrapText(module.assessor_notes, CONTENT_WIDTH, 10, font);
    for (const line of notesLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }
    yPosition -= 10;
  }

  // Module data (PRESERVED)
  yPosition = drawModuleKeyDetails(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // Info gap quick actions (PRESERVED)
  yPosition = drawInfoGapQuickActions(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  return yPosition;
}
```

---

## Section Header Function (NEW)

```typescript
// ✅ NEW FUNCTION: Draws section number and title
function drawSectionHeader(
  page: PDFPage,
  sectionId: number,
  sectionTitle: string,
  font: any,
  fontBold: any,
  yPosition: number
): number {
  yPosition -= 20;

  const headerText = `${sectionId}. ${sectionTitle}`;
  // ↑ e.g., "5. Fire Hazards & Ignition Sources"

  page.drawText(headerText, {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  yPosition -= 30;
  return yPosition;
}
```

---

## Page 1 (Risk Summary)

### BEFORE (Old Layout)
```typescript
// ❌ OLD: drawRiskSummaryPage
const riskSummaryPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
totalPages.push(riskSummaryPage);
drawRiskSummaryPage(riskSummaryPage, scoringResult, priorityActions, font, fontBold, document);
// ↑ Old layout with heavy borders and 5×5 matrix style

if (isDraft) {
  drawDraftWatermark(riskSummaryPage, fontBold);
}
```

### AFTER (Clean Audit Layout)
```typescript
// ✅ NEW: drawCleanAuditPage1
const riskSummaryPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
totalPages.push(riskSummaryPage);
drawCleanAuditPage1(riskSummaryPage, scoringResult, priorityActions, font, fontBold, document, organisation);
// ↑ New clean layout with:
//   - Centered title: "Fire Risk Assessment"
//   - Site name, client, date, jurisdiction
//   - Clean bordered risk panel
//   - Auto-generated narrative
//   - P1-P4 priority boxes (minimal design)

if (isDraft) {
  drawDraftWatermark(riskSummaryPage, fontBold);
}
```

---

## FRA3 Split (Detection vs Emergency Lighting)

### BEFORE (Combined)
```typescript
// ❌ OLD: FRA_3_ACTIVE_SYSTEMS rendered as one section
case 'FRA_3_ACTIVE_SYSTEMS':
  yPosition = drawModuleSummary(page, module, document, ...);
  // ↑ Rendered ALL FRA_3 fields together
```

### AFTER (Split into 2 Sections)
```typescript
// ✅ NEW: Section 7 - Detection only
case 7: // Fire Detection, Alarm & Warning
  yPosition = renderSection7Detection(page, sectionModules, document, ...);
  // ↑ Renders ONLY detection fields:
  //   - detection_system_type
  //   - detection_system_grade
  //   - alarm_type
  //   - alarm_audibility
  break;

// ✅ NEW: Section 8 - Emergency lighting only
case 8: // Emergency Lighting
  yPosition = renderSection8EmergencyLighting(page, sectionModules, document, ...);
  // ↑ Renders ONLY lighting fields:
  //   - emergency_lighting_type
  //   - emergency_lighting_coverage
  //   - emergency_lighting_duration
  break;
```

---

## FRA8 Split (Suppression vs Equipment)

### BEFORE (Combined)
```typescript
// ❌ OLD: FRA_8_FIREFIGHTING_EQUIPMENT rendered as one section
case 'FRA_8_FIREFIGHTING_EQUIPMENT':
  yPosition = drawModuleSummary(page, module, document, ...);
  // ↑ Rendered "FRA-8: Firefighting Equipment As-Is" with ALL fields
```

### AFTER (Split into 2 Sections)
```typescript
// ✅ NEW: Section 10 - Suppression systems only
case 10: // Fixed Fire Suppression & Firefighting Facilities
  yPosition = renderSection10Suppression(page, sectionModules, document, ...);
  // ↑ Renders ONLY suppression fields:
  //   - sprinkler_system
  //   - rising_mains
  //   - firefighting_lift
  break;

// ✅ NEW: Section 11 - Portable equipment
case 11: // Fire Safety Management & Procedures
  yPosition = renderSection11Management(page, sectionModules, allModules, document, ...);
  // ↑ Renders management modules PLUS portable equipment from FRA_8:
  //   - portable_extinguishers
  //   - hose_reels
  //   - fire_blankets
  break;
```

---

## Legacy Code Removed

```typescript
// ❌ REMOVED: No longer needed
const MODULE_ORDER_LEGACY = [...];
const MODULE_ORDER_SPLIT = [...];

function sortModules(moduleInstances: ModuleInstance[]): ModuleInstance[] {
  const hasLegacyProtection = moduleInstances.some(...);
  const moduleOrder = hasLegacyProtection ? MODULE_ORDER_LEGACY : MODULE_ORDER_SPLIT;
  return [...moduleInstances]
    .filter(...)
    .sort(...);
}
```

---

## PDF Output Comparison

### BEFORE
```
PAGE 1: Old title page with large "FRA" text
PAGE 2: Executive Summary
PAGE 3: Regulatory Framework
PAGE 4: Responsible Person
PAGE 5: ❌ "FRA-1: Fire Hazards"           ← MODULE KEY VISIBLE
PAGE 6: ❌ "FRA-2: Means of Escape"        ← MODULE KEY VISIBLE
PAGE 7: ❌ "FRA-3: Active Systems As-Is"   ← MODULE KEY VISIBLE
PAGE 8: ❌ "FRA-8: Firefighting Equipment As-Is" ← MODULE KEY VISIBLE
```

### AFTER
```
PAGE 1: ✅ Clean Audit Page 1
  - Fire Risk Assessment (title)
  - Site, client, date, jurisdiction
  - Risk panel (L | C | Overall)
  - Auto narrative
  - P1-P4 boxes

PAGE 2: Executive Summary
PAGE 3: Regulatory Framework
PAGE 4: Responsible Person
PAGE 5: ✅ "2. Premises & General Information"
PAGE 6: ✅ "3. Occupants & Vulnerability"
PAGE 7: ✅ "4. Relevant Legislation & Duty Holder"
PAGE 8: ✅ "5. Fire Hazards & Ignition Sources"
PAGE 9: ✅ "6. Means of Escape"
PAGE 10: ✅ "7. Fire Detection, Alarm & Warning"
PAGE 11: ✅ "8. Emergency Lighting"
PAGE 12: ✅ "9. Passive Fire Protection"
PAGE 13: ✅ "10. Fixed Fire Suppression & Firefighting Facilities"
PAGE 14: ✅ "11. Fire Safety Management & Procedures"
PAGE 15: ✅ "12. External Fire Spread"
PAGE 16: ✅ "13. Significant Findings, Risk Evaluation & Action Plan"
PAGE 17: ✅ "14. Review & Reassessment"
```

---

## Summary of Changes

| Aspect | Before | After |
|--------|--------|-------|
| **Loop Type** | Module-based (`for (module of sortedModules)`) | Section-based (`for (section of FRA_REPORT_STRUCTURE)`) |
| **Ordering** | Dynamic (MODULE_ORDER arrays) | Fixed (1-14 skeleton) |
| **Headers** | "FRA-1: Fire Hazards" | "5. Fire Hazards & Ignition Sources" |
| **Module Keys** | Visible in PDF | Hidden (not printed) |
| **FRA3** | Single section | Split (Section 7 + 8) |
| **FRA8** | Single section | Split (Section 10 + 11) |
| **Page 1** | Old title page | Clean Audit layout |
| **A2/A3** | May not render | Always render (Sections 2 & 3) |
| **Legacy Code** | MODULE_ORDER, sortModules | Removed |
| **Lines Changed** | - | ~650 added, ~60 removed |

---

**Result:** PDF now uses fixed PAS-79 aligned 1-14 skeleton with NO module keys visible.
