# Day 9: Core Fixes Complete

## Overview
Fixed four critical core issues to stabilize Document Overview and PDF output:
- A) Disabled Defence Pack with "Coming Soon" badge
- B) Fixed Continue vs Open Workspace routing
- C) Fixed Issued PDF showing DRAFT instead of ISSUED
- D) Removed contradictory info-gap notes

All fixes maintain existing functionality while improving UX and data accuracy.

---

## A) Disable Defence Pack (Coming Soon) ✅

### Problem
- Defence Pack generation called edge function that returned 401 errors
- Feature not launch-critical but visible to users
- Clicking caused console errors and broken UX

### Solution Implemented

**Disabled Button with Badge**
```tsx
<Button
  variant="secondary"
  disabled={true}
  title="Defence Pack export will be available post-launch"
>
  <Shield className="w-4 h-4 mr-2" />
  Generate Defence Pack
  <Badge className="ml-2 text-xs bg-neutral-200 text-neutral-600">
    Coming Soon
  </Badge>
</Button>
```

**Changes Made:**
- Removed all edge function calls (no network requests)
- Set button to `disabled={true}`
- Added "Coming Soon" badge for clarity
- Added tooltip explaining availability
- Removed state management for building/downloading

### Files Modified
- `src/pages/documents/DocumentOverview.tsx`

### Benefits
- ✅ No 401 errors
- ✅ Clear user communication
- ✅ Professional appearance
- ✅ Feature preserved for future
- ✅ No console errors

---

## B) Fix Continue vs Open Workspace Routing ✅

### Problem
- Both "Continue Assessment" and "Open Workspace" navigated to the same module
- Users expected different behavior:
  - Continue → next incomplete module
  - Open Workspace → last visited module
- localStorage was being saved on Overview click, making destinations identical

### Solution Implemented

**Continue Assessment (Next Incomplete)**
```typescript
const handleContinueAssessment = () => {
  if (!id) return;

  // Find first incomplete REQUIRED module
  const firstIncomplete = modules.find(m => !m.completed_at);

  if (firstIncomplete) {
    // Don't save to localStorage - let workspace save it when loaded
    // This keeps Continue and Open Workspace destinations separate
    navigate(`/documents/${id}/workspace?m=${firstIncomplete.id}`, {
      state: { returnTo: `/documents/${id}` }
    });
  } else {
    // All complete, go to last visited or first
    const lastVisited = getLastVisitedModule();
    const targetModule = lastVisited && modules.find(m => m.id === lastVisited)
      ? lastVisited
      : modules[0]?.id;

    if (targetModule) {
      navigate(`/documents/${id}/workspace?m=${targetModule}`, {
        state: { returnTo: `/documents/${id}` }
      });
    }
  }
};
```

**Open Workspace (Last Visited or First)**
```typescript
const handleOpenWorkspace = () => {
  if (!id) return;

  // Check last visited module first, or fall back to first module
  const lastVisited = getLastVisitedModule();
  const targetModule = lastVisited && modules.find(m => m.id === lastVisited)
    ? lastVisited
    : modules[0]?.id;

  if (targetModule) {
    // Don't save to localStorage - let workspace save it when loaded
    navigate(`/documents/${id}/workspace?m=${targetModule}`, {
      state: { returnTo: `/documents/${id}` }
    });
  } else {
    navigate(`/documents/${id}/workspace`, {
      state: { returnTo: `/documents/${id}` }
    });
  }
};
```

**Key Changes:**
1. Removed `saveLastVisitedModule()` calls from Overview page
2. localStorage save now happens only in DocumentWorkspace when module loads
3. Continue always finds first incomplete (ignores last visited)
4. Open Workspace always checks last visited first

**Behavior:**
```
User completes A1, working on A2
  ↓
User clicks Back to Overview
  ↓
localStorage = "A2" (saved by workspace)
  ↓
User clicks "Continue Assessment"
  → Routes to A3 (next incomplete)
  ↓
User clicks "Open Workspace"
  → Routes to A2 (last visited)
```

### Files Modified
- `src/pages/documents/DocumentOverview.tsx`

### Benefits
- ✅ Clear functional difference between buttons
- ✅ Continue = progress forward
- ✅ Open Workspace = resume where left off
- ✅ No localStorage conflicts
- ✅ Intuitive UX

---

## C) Fix Issued PDF Showing DRAFT ✅

### Problem
- Locked/issued PDFs showed "DRAFT" status badge on cover page
- Issue: PDF generated before `issue_status` changed to 'issued'
- Users received official issued documents marked as drafts
- Undermined document authority and professionalism

### Solution Implemented

**1. Added `renderMode` Parameter to All PDF Builders**

**Interface Changes (all PDF builders):**
```typescript
interface BuildPdfOptions {
  document: Document;
  moduleInstances: ModuleInstance[];
  actions: Action[];
  actionRatings: ActionRating[];
  organisation: Organisation;
  renderMode?: 'preview' | 'issued';  // NEW
}

export async function buildFraPdf(options: BuildPdfOptions): Promise<Uint8Array> {
  const { document, moduleInstances, actions, actionRatings, organisation, renderMode } = options;
  // ... rest of function
}
```

**2. Updated drawCoverPage Functions**

**All PDF builders now use renderMode to override status:**
```typescript
function drawCoverPage(
  page: PDFPage,
  document: Document,
  organisation: Organisation,
  font: any,
  fontBold: any,
  yPosition: number,
  renderMode?: 'preview' | 'issued'  // NEW PARAMETER
): number {
  // ... cover page setup ...

  // Use renderMode to override status if provided
  let issueStatus = renderMode === 'issued'
    ? 'issued'
    : ((document as any).issue_status || document.status);

  const isIssued = issueStatus === 'issued';
  const isSuperseded = issueStatus === 'superseded';
  const statusColor = isIssued
    ? rgb(0.13, 0.55, 0.13)  // Green
    : isSuperseded
      ? rgb(0.7, 0.5, 0)      // Gold
      : rgb(0.5, 0.5, 0.5);   // Gray

  const statusText = sanitizePdfText(
    issueStatus ? issueStatus.toUpperCase() : 'DRAFT'
  );

  // Draw status badge...
}
```

**3. Pass renderMode from IssueDocumentModal**

**When issuing document:**
```typescript
const buildOptions = {
  document,
  moduleInstances: modules || [],
  actions: actions || [],
  actionRatings: [],
  organisation: org,
  renderMode: 'issued' as const,  // FORCE ISSUED STATUS
};

// Generate PDF with "ISSUED" badge
if (isCombined) {
  pdfBytes = await buildCombinedPdf(buildOptions);
} else if (document.document_type === 'FRA') {
  pdfBytes = await buildFraPdf(buildOptions);
} else if (document.document_type === 'FSD') {
  pdfBytes = await buildFsdPdf(buildOptions);
} else if (document.document_type === 'DSEAR') {
  pdfBytes = await buildDsearPdf(buildOptions);
}
```

**4. Preview Page (No Change)**

Preview page does NOT pass renderMode, so defaults to showing actual document status (DRAFT):
```typescript
const pdfOptions = {
  document,
  moduleInstances: moduleInstances || [],
  actions: enrichedActions,
  actionRatings,
  organisation: { id: organisation.id, name: organisation.name },
  // No renderMode - shows actual status (DRAFT)
};
```

### Status Badge Rendering Logic

| Context | renderMode | Document Status | Badge Shows |
|---------|-----------|-----------------|-------------|
| Preview Page | undefined | draft | **DRAFT** (gray) |
| Preview Page | undefined | issued | **ISSUED** (green) |
| Issue Modal | 'issued' | draft | **ISSUED** (green) |
| Issue Modal | 'issued' | issued | **ISSUED** (green) |
| Locked PDF | 'issued' | issued | **ISSUED** (green) |

### Files Modified
- `src/lib/pdf/buildFraPdf.ts`
- `src/lib/pdf/buildFsdPdf.ts`
- `src/lib/pdf/buildDsearPdf.ts`
- `src/lib/pdf/buildCombinedPdf.ts`
- `src/components/documents/IssueDocumentModal.tsx`

### Benefits
- ✅ Issued PDFs always show "ISSUED" badge
- ✅ Preview PDFs still show "DRAFT"
- ✅ Status badge color correct (green for issued)
- ✅ Professional document appearance
- ✅ Clear visual distinction between draft/issued
- ✅ No database changes required

---

## D) Remove Contradictory Info-Gap Notes ✅

### Problem
- PDF showed "Assessment notes (incomplete information)" for A1_DOC_CONTROL
- Flagged "Responsible person not identified" even when displayed in Key Details
- Flagged "No assessment standards selected" even when displayed in Key Details
- Created contradictions within same document section
- Undermined document credibility

**Example Contradiction:**
```
Key Details:
  Responsible Person: John Smith
  Standards Selected: BS 9999, BS 9991

Assessment notes (incomplete information):
  - Responsible person not identified
  - No assessment standards selected
```

### Root Cause
- `detectInfoGaps()` checked `moduleData.responsible_person`
- But A1_DOC_CONTROL stores these fields at **document level**, not module level
- `drawModuleKeyDetails()` correctly read from `document.responsible_person`
- `drawInfoGapQuickActions()` incorrectly read from `moduleData.responsible_person`

### Solution Implemented

**1. Updated detectInfoGaps Signature**

```typescript
export function detectInfoGaps(
  moduleKey: string,
  moduleData: Record<string, any>,
  outcome: string | null,
  documentData?: {                          // NEW PARAMETER
    responsible_person?: string;
    standards_selected?: string[];
  }
): InfoGapDetection {
  const reasons: string[] = [];
  const quickActions: InfoGapQuickAction[] = [];

  if (outcome === 'info_gap') {
    reasons.push('Module outcome marked as Information Gap');
  }

  switch (moduleKey) {
    case 'A1_DOC_CONTROL':
      // Check document-level fields (not module data) for A1
      if (documentData) {
        if (!documentData.responsible_person ||
            !documentData.responsible_person.trim()) {
          reasons.push('Responsible person not identified');
          quickActions.push({
            action: 'Identify and document the responsible person for fire safety',
            reason: 'Legal requirement under Regulatory Reform (Fire Safety) Order 2005',
            priority: 'P2',
          });
        }
        if (!documentData.standards_selected ||
            documentData.standards_selected.length === 0) {
          reasons.push('No assessment standards selected');
          quickActions.push({
            action: 'Select and document applicable fire safety standards',
            reason: 'Defines assessment methodology and compliance framework',
            priority: 'P3',
          });
        }
      }
      break;

    // Other modules unchanged (check moduleData as before)
    case 'A4_MANAGEMENT_CONTROLS':
      if (moduleData.testing_records === 'unknown' || !moduleData.testing_records) {
        reasons.push('Testing records availability unknown');
        // ... etc
      }
      break;
  }

  return {
    hasInfoGap: reasons.length > 0,
    reasons,
    quickActions,
  };
}
```

**2. Updated All PDF Builders to Pass Document Data**

**buildFraPdf.ts:**
```typescript
function drawInfoGapQuickActions(
  page: PDFPage,
  module: ModuleInstance,
  document: Document,        // NEW PARAMETER
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  const detection = detectInfoGaps(
    module.module_key,
    module.data,
    module.outcome,
    {
      responsible_person: document.responsible_person || undefined,
      standards_selected: document.standards_selected || []
    }
  );

  if (!detection.hasInfoGap) {
    return yPosition;  // No info gap - skip section
  }

  // Draw info gap section...
}
```

**Call site updated:**
```typescript
yPosition = drawModuleKeyDetails(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

// Draw info gap quick actions if detected
yPosition = drawInfoGapQuickActions(
  page,
  module,
  document,  // Pass document
  font,
  fontBold,
  yPosition,
  pdfDoc,
  isDraft,
  totalPages
);
```

**Same changes applied to:**
- buildFsdPdf.ts
- buildDsearPdf.ts
- buildCombinedPdf.ts

### Before vs After

**Before (Contradictory):**
```
A1 – Document Control

Key Details:
  Responsible Person: John Smith
  Assessor Name: Jane Doe
  Standards Selected: BS 9999, BS 9991

ℹ Assessment notes (incomplete information)
  - Responsible person not identified
  - No assessment standards selected
```

**After (Consistent):**
```
A1 – Document Control

Key Details:
  Responsible Person: John Smith
  Assessor Name: Jane Doe
  Standards Selected: BS 9999, BS 9991

(No info-gap section - all fields present)
```

**If Actually Missing:**
```
A1 – Document Control

Key Details:
  Assessor Name: Jane Doe

ℹ Assessment notes (incomplete information)
  - Responsible person not identified
  - No assessment standards selected

Quick Actions:
  [P2] Identify and document the responsible person
       Legal requirement under RRO 2005
```

### Files Modified
- `src/utils/infoGapQuickActions.ts`
- `src/lib/pdf/buildFraPdf.ts`
- `src/lib/pdf/buildFsdPdf.ts`
- `src/lib/pdf/buildDsearPdf.ts`
- `src/lib/pdf/buildCombinedPdf.ts`

### Benefits
- ✅ No contradictions within document
- ✅ Info-gap notes only show for actual gaps
- ✅ Consistent data source (document level for A1)
- ✅ Professional document quality
- ✅ Accurate reporting
- ✅ User trust maintained

---

## Build Verification

```bash
npm run build
```

**Result:**
```
✓ 1901 modules transformed.
dist/index.html                     1.18 kB │ gzip:   0.50 kB
dist/assets/index-BSbLIj2r.css     60.24 kB │ gzip:   9.77 kB
dist/assets/index-DkoOVpUB.js   1,680.25 kB │ gzip: 442.01 kB
✓ built in 12.44s
```

All TypeScript compilation successful. No errors. ✅

---

## Complete Feature Matrix

### Document Overview Actions

| Action | Behavior | Status |
|--------|----------|--------|
| Continue Assessment | Routes to next incomplete module | ✅ Fixed |
| Open Workspace | Routes to last visited or first module | ✅ Fixed |
| Preview Report | Always shows DRAFT (current status) | ✅ Works |
| Issue Document | Validates → guides to missing modules | ✅ Works |
| Generate Defence Pack | Disabled with "Coming Soon" badge | ✅ Fixed |
| Delete Draft | Soft deletes via Supabase | ✅ Works |

### PDF Status Rendering

| Context | Status Badge | Color | Correct |
|---------|-------------|-------|---------|
| Preview (draft) | DRAFT | Gray | ✅ |
| Preview (issued) | ISSUED | Green | ✅ |
| Issue Modal | ISSUED | Green | ✅ Fixed |
| Locked PDF | ISSUED | Green | ✅ Fixed |
| Superseded | SUPERSEDED | Gold | ✅ |

### PDF Data Consistency

| Module | Data Source | Info-Gap Check | Status |
|--------|------------|----------------|--------|
| A1_DOC_CONTROL | Document level | Document level | ✅ Fixed |
| A2_BUILDING_PROFILE | Module data | Module data | ✅ Works |
| A4_MANAGEMENT | Module data | Module data | ✅ Works |
| All other modules | Module data | Module data | ✅ Works |

---

## Testing Checklist

### A) Defence Pack Disabled
- [x] Button shows "Coming Soon" badge
- [x] Button is disabled (no click)
- [x] Tooltip shows post-launch message
- [x] No console errors
- [x] No network requests
- [x] Professional appearance

### B) Continue vs Open Workspace
- [x] Continue routes to next incomplete
- [x] Open Workspace routes to last visited
- [x] localStorage saved only by workspace
- [x] Different destinations when modules incomplete
- [x] Both work when all complete
- [x] No navigation errors

### C) Issued PDF Status
- [x] Preview shows DRAFT for drafts
- [x] Preview shows ISSUED for issued docs
- [x] Issue modal generates ISSUED PDFs
- [x] Locked PDFs show ISSUED
- [x] Status badge color correct
- [x] No database changes needed

### D) Info-Gap Consistency
- [x] A1 checks document-level fields
- [x] No contradictions in Key Details vs Info-Gap
- [x] Responsible Person displayed = no gap shown
- [x] Standards displayed = no gap shown
- [x] Other modules work correctly
- [x] True gaps still flagged

---

## Architecture Notes

### renderMode Pattern
```typescript
// Option 1: Preview (shows actual status)
const pdfOptions = {
  document,
  moduleInstances,
  actions,
  actionRatings,
  organisation,
  // No renderMode - uses document.issue_status
};

// Option 2: Force issued (for locked PDFs)
const pdfOptions = {
  document,
  moduleInstances,
  actions,
  actionRatings,
  organisation,
  renderMode: 'issued' as const,  // Override to show ISSUED
};
```

**Decision Logic in PDF:**
```typescript
let issueStatus = renderMode === 'issued'
  ? 'issued'                              // Force issued
  : ((document as any).issue_status || document.status);  // Use actual
```

### Info-Gap Detection Pattern
```typescript
// Module uses document-level fields
if (moduleKey === 'A1_DOC_CONTROL') {
  detection = detectInfoGaps(
    moduleKey,
    moduleData,
    outcome,
    {
      responsible_person: document.responsible_person,
      standards_selected: document.standards_selected
    }
  );
}

// Module uses module-level fields
else {
  detection = detectInfoGaps(
    moduleKey,
    moduleData,
    outcome
    // No document data needed
  );
}
```

### localStorage Pattern
```typescript
// DocumentWorkspace: Save when module loaded
useEffect(() => {
  const moduleParam = searchParams.get('m');
  if (moduleParam && modules.length > 0) {
    const moduleExists = modules.find((m) => m.id === moduleParam);
    if (moduleExists) {
      setSelectedModuleId(moduleParam);
      if (id) {
        localStorage.setItem(`ezirisk:lastModule:${id}`, moduleParam);
      }
    }
  }
}, [searchParams, modules, id]);

// DocumentOverview: Read (never write)
const getLastVisitedModule = (): string | null => {
  if (id) {
    return localStorage.getItem(`ezirisk:lastModule:${id}`);
  }
  return null;
};
```

---

## Summary

All four core issues resolved:

✅ **Defence Pack Disabled**
- Clean "Coming Soon" badge
- No errors or failed requests
- Feature preserved for future

✅ **Continue vs Open Workspace Fixed**
- Clear functional difference
- Continue = next incomplete
- Open Workspace = last visited

✅ **Issued PDF Status Fixed**
- Locked PDFs show "ISSUED" badge
- Preview PDFs show actual status
- Green badge for issued documents

✅ **Info-Gap Contradictions Removed**
- A1 checks document-level fields
- No contradictions in reports
- Accurate gap detection

**Build:** ✅ Passes (12.44s)
**TypeScript:** ✅ No errors
**Breaking Changes:** ❌ None
**Schema Changes:** ❌ None

Document Overview and PDF generation now stable and professional.

Ready for production.
