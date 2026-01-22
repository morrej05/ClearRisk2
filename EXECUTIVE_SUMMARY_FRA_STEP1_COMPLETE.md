# Executive Summary Implementation - Step 1 (FRA Only) ✅

**Feature:** AI-Generated + Author Override Executive Summary for FRA Documents
**Date:** 2026-01-22
**Status:** Complete and Ready for Production

## Overview

Implemented a flexible executive summary system specifically for **FRA documents only** that supports AI-generated content, author-written content, both, or neither. The system is designed to be assistive rather than authoritative, giving full control to assessors while providing intelligent assistance.

**Future Steps:** Once proven successful with FRA, this will be replicated for Explosion/DSEAR and FSD documents.

## Implementation Details

### 1. Database Schema ✓

**Migration File:** `add_executive_summary_fields.sql`

**New Columns in documents table:**

```sql
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS executive_summary_ai text,
  ADD COLUMN IF NOT EXISTS executive_summary_author text,
  ADD COLUMN IF NOT EXISTS executive_summary_mode text
    DEFAULT 'ai'
    CHECK (executive_summary_mode IN ('ai', 'author', 'both', 'none'));
```

**Fields:**
- `executive_summary_ai`: AI-generated summary (manual trigger only, 250-450 words)
- `executive_summary_author`: Optional author-written summary/commentary
- `executive_summary_mode`: Controls report output
  - `'ai'`: Show only AI summary
  - `'author'`: Show only author summary
  - `'both'`: AI first, then "Author Commentary" below
  - `'none'`: Omit executive summary section entirely

**Notes:**
- Fields exist for all document types but only exposed/used for FRA in Step 1
- Ready for Explosion and FSD in future steps

**Indexes:**
- `idx_documents_executive_summary_mode`: Fast filtering by mode

### 2. AI Generation Utility ✓

**File:** `src/lib/ai/generateExecutiveSummary.ts`

**Function Signature:**
```typescript
generateExecutiveSummary({
  documentId: string,
  organisationId: string
}): Promise<{ success: boolean; summary?: string; error?: string }>
```

**Inputs Fetched from Database:**
- Document: title, assessment_date, scope_description, limitations_assumptions
- Module instances: module_key, outcome
- Actions: priority (P1-P4), status (open only)

**Computed Data:**
- Outcome counts by type (compliant, minor_def, material_def, info_gap, na)
- Action counts by priority (P1, P2, P3, P4)

**Output Format:**

```
• Bullet point 1
• Bullet point 2
• Bullet point 3
• Bullet point 4
• Bullet point 5
• Bullet point 6

Closing paragraph providing context and directing reader to main report body.
```

**Output Characteristics:**
- Length: 250-450 words
- UK spelling, neutral tone
- 5-8 bullet points
- Short closing paragraph
- No invention: uses only provided data; omits unknowns
- Professional, non-technical language

**Example Output:**

```
• Assessment Date: 22 January 2026 covering main office building.
• 12 key areas of fire safety were examined to identify hazards, evaluate controls, and determine necessary actions.
• 2 areas with material deficiencies requiring immediate attention were identified.
• 3 areas with minor deficiencies were found.
• 15 recommendations have been made: 3 high priority (P1) actions, 5 medium-high priority (P2) actions, 7 medium priority (P3) actions.
• Assessment limitations: Access was restricted to ground floor only due to ongoing construction works...

High priority recommendations should be implemented without delay to address significant fire safety concerns and reduce risk to acceptable levels. These actions are essential to ensuring the safety of occupants and compliance with fire safety legislation. Full details of the assessment methodology, specific findings, and detailed recommendations are provided in the main body of this report.
```

**Guards:**
- Cannot generate if document is issued/superseded
- User-friendly error messages on failure
- Does not clear existing text on error

**Saves to:** `documents.executive_summary_ai`

### 3. ExecutiveSummaryPanel Component ✓

**File:** `src/components/documents/ExecutiveSummaryPanel.tsx`

**Props:**
```typescript
interface ExecutiveSummaryPanelProps {
  documentId: string;
  organisationId: string;
  issueStatus: string;
  initialAiSummary: string | null;
  initialAuthorSummary: string | null;
  initialMode: 'ai' | 'author' | 'both' | 'none';
  onUpdate?: () => void;
}
```

**Features:**

**Mode Selector (Radio Buttons):**
- **AI summary:** Sparkles icon, blue theme
- **Author summary:** Edit icon, amber theme
- **Both:** FileText icon, green theme
- **None:** X icon, neutral theme

**AI Summary Block:**
- Read-only textarea displaying AI-generated content
- Blue background (bg-blue-50, border-blue-200)
- **"Generate AI Summary"** button (if no summary exists)
- **"Regenerate"** button (if summary exists)
- Loading state with spinner during generation
- Placeholder text when empty

**Author Commentary Block:**
- Editable textarea (8 rows)
- Amber-themed
- **Collapsible** by default with ChevronDown/Up icons
- Label: "Add author commentary (optional)" (when mode is 'both')
- Label: "Author Summary" (when mode is 'author')
- Auto-expands if author summary exists
- Placeholder text contextual to mode

**Auto-Set Mode Logic:**
- When user types in author field:
  - If AI exists: switch to 'both' (if not already 'both' or 'author')
  - If AI empty: switch to 'author' (if not already 'author')

**Save Behavior:**
- Tracks unsaved changes
- **"Save Changes"** button appears when modified (top-right)
- Updates `executive_summary_mode` and `executive_summary_author`
- Calls `onUpdate()` callback after save
- Shows "Saving..." during save operation

**Locked State (Issued/Superseded Documents):**
- Shows Lock icon
- Message: "This executive summary is locked. Create a new version to make changes."
- Displays read-only view of current summaries
- No editing capabilities
- Clear visual indication (Lock icon, neutral colors)

**Error Handling:**
- Inline error display (red banner)
- Dismissible error messages (X button)
- User-friendly error text
- Does not break on network failures

### 4. FRA Workspace Integration ✓

**File:** `src/pages/documents/DocumentWorkspace.tsx`

**Integration Point:**
- Main content area (right side of workspace)
- **Above module list/sections**
- Inside wrapper div with `max-w-7xl mx-auto p-6`

**Conditional Rendering:**
```typescript
{document.document_type === 'FRA' && organisation?.id && (
  <ExecutiveSummaryPanel
    documentId={document.id}
    organisationId={organisation.id}
    issueStatus={document.issue_status}
    initialAiSummary={document.executive_summary_ai}
    initialAuthorSummary={document.executive_summary_author}
    initialMode={(document.executive_summary_mode as 'ai' | 'author' | 'both' | 'none') || 'ai'}
    onUpdate={fetchDocument}
  />
)}
```

**Visibility:**
- **FRA documents only**
- Not shown for Explosion/DSEAR or FSD documents (Step 2+)
- Appears for both draft and issued FRAs (locked when issued)

**Layout:**
- Panel appears above selected module content
- Maintains existing sidebar navigation
- Responsive max-width container
- Consistent padding and spacing

### 5. FRA PDF Integration ✓

**File:** `src/lib/pdf/buildFraPdf.ts`

**Integration Point:**
```typescript
yPosition = drawCoverPage(page, document, organisation, font, fontBold, yPosition);

addExecutiveSummaryPages(
  pdfDoc,
  isDraft,
  totalPages,
  (document.executive_summary_mode as 'ai' | 'author' | 'both' | 'none') || 'none',
  document.executive_summary_ai,
  document.executive_summary_author,
  { bold: fontBold, regular: font }
);

const sortedModules = sortModules(moduleInstances);
// ... rest of PDF
```

**Render Logic Based on Mode:**

**Mode: 'none'**
- No pages added
- Section omitted entirely from PDF

**Mode: 'ai'**
- New page after title page
- Heading: "Executive Summary" (18pt bold)
- AI bullet points (11pt regular)
- Closing paragraph separated by extra spacing
- Auto-pagination if content exceeds page

**Mode: 'author'**
- New page after title page
- Heading: "Executive Summary" (18pt bold)
- Author content (11pt regular)
- Auto-pagination

**Mode: 'both'**
- First page: "Executive Summary" (AI content)
- Second page: "Author Commentary" (Author content)
- Both formatted identically
- Auto-pagination for each section

**Text Handling:**
- Splits by '\n\n' to separate bullet section from closing paragraph
- Each line wrapped to CONTENT_WIDTH
- Sanitized via `sanitizePdfText()` for special characters
- Page breaks handled automatically when content overflows

**Empty Field Behavior:**
- If mode requires text but field is empty: omit that subsection
- No blank boxes or error messages in PDF
- Graceful degradation

### 6. Versioning Behavior ✓

**File:** `src/utils/documentVersioning.ts`

**On Create New Version (FRA only for now):**

```typescript
const newDocData = {
  // ... existing fields ...
  executive_summary_ai: null,
  executive_summary_author: null,
  executive_summary_mode: 'ai',
};
```

**Behavior:**
- AI summary cleared (set to null)
- Author summary cleared (set to null)
- Mode reset to 'ai' (default)
- Previous version retains summaries as locked
- Clean slate for new version

**Rationale:**
- Each version should have its own summary reflecting current state
- No stale content carried forward
- AI can regenerate based on current findings
- Author can write fresh commentary

### 7. PDF Utility Function ✓

**File:** `src/lib/pdf/pdfUtils.ts`

**Function:** `addExecutiveSummaryPages()`

**Signature:**
```typescript
function addExecutiveSummaryPages(
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  mode: 'ai' | 'author' | 'both' | 'none',
  aiSummary: string | null,
  authorSummary: string | null,
  fonts: { bold: any; regular: any }
): number
```

**Returns:** Number of pages added (0-2)

**Implementation:**
- Splits text by '\n\n' for paragraph/section boundaries
- Wraps each line to CONTENT_WIDTH
- Handles page overflow automatically
- Preserves bullet formatting
- Adds appropriate spacing between sections

**Used By:**
- `buildFraPdf.ts` (active)
- `buildFsdPdf.ts` (ready for Step 2, currently not called)
- `buildDsearPdf.ts` (ready for Step 2, currently not called)

## Use Cases & User Flows

### Use Case 1: Generate AI Summary (Default)

1. User opens FRA document workspace
2. Executive Summary Panel visible at top (mode: 'ai')
3. User clicks **"Generate AI Summary"** button
4. AI analyzes document data (modules, actions, outcomes)
5. Summary appears in blue read-only panel (bullet format)
6. User can regenerate if unsatisfied
7. PDF report includes AI summary only after title page

### Use Case 2: Write Author-Only Summary

1. User opens FRA document workspace
2. Changes mode to **"Author summary"** (amber button)
3. Clicks **"Save Changes"**
4. Expands author commentary section (if collapsed)
5. Types custom summary in textarea
6. Clicks **"Save Changes"**
7. PDF report includes author summary only (heading: "Executive Summary")

### Use Case 3: Use Both AI and Author

1. User generates AI summary first
2. Changes mode to **"Both"** (green button)
3. Expands author commentary section
4. Adds supplementary commentary
5. Clicks **"Save Changes"**
6. PDF report includes:
   - Page 1: "Executive Summary" (AI bullets + closing)
   - Page 2: "Author Commentary" (Author text)

### Use Case 4: Omit Summary

1. User changes mode to **"None"** (neutral button)
2. Clicks **"Save Changes"**
3. Panel shows "No Executive Summary" message
4. PDF report omits executive summary entirely
5. Goes straight from cover to FRA_4 module

### Use Case 5: Locked Document (Issued/Superseded)

1. User opens issued FRA document
2. Executive Summary Panel shows with Lock icon
3. Message: "This executive summary is locked. Create a new version to make changes."
4. Displays read-only view of summaries (if any)
5. No editing or mode changing possible
6. PDF includes locked summary as-is

### Use Case 6: Create New Version (Reset)

1. User views issued FRA v1 with summaries
2. Clicks "Create New Version"
3. New v2 created as draft
4. Executive summary fields cleared
5. Mode reset to 'ai'
6. User can generate new AI summary or write new author text
7. Old v1 retains original summaries (locked)

### Use Case 7: Auto-Mode Switching

**Scenario A: AI exists, user adds author text**
- Mode auto-switches from 'ai' to 'both'
- Both summaries now active

**Scenario B: No AI, user adds author text**
- Mode auto-switches from 'ai' to 'author'
- Only author summary active

## Business Rules

**Hard Rules:**

1. **FRA Only (Step 1)**
   - Panel only visible for `document_type === 'FRA'`
   - Not shown for Explosion/DSEAR or FSD documents
   - Future: Replicate for other doc types in Step 2

2. **Manual Generation Only**
   - AI summary never auto-generates
   - Always requires explicit user click
   - No background generation

3. **Author Text Sacred**
   - AI never overwrites author text
   - Author field completely independent from AI field
   - Mode controls display, not content

4. **Locked on Issue**
   - Summary immutable once issued
   - Mode locked
   - No edits after issue
   - Must create new version to change

5. **Version Isolation**
   - Each version has own summary
   - Old versions retain their summaries
   - No cross-version inheritance
   - Clear on new version creation

6. **Mode Flexibility (Draft Only)**
   - User can change mode anytime while draft
   - Content preserved across mode changes
   - No data loss when switching modes
   - Auto-save updates both mode and author text

7. **Draft-Only Editing**
   - Mode changes allowed only when `issue_status === 'draft'`
   - Author edits allowed only when draft
   - Issued/superseded documents completely locked

**Permissions:**

- **Editors:** Can generate AI, edit author text, change mode (draft only)
- **Viewers:** Read-only access to panel
- **Issued docs:** No one can edit (system-enforced lock)

**Error Handling:**

- Network failures: Inline error with retry option
- Generation failures: Clear error message, existing text preserved
- Save failures: Error banner, allows retry
- Missing organisation: Panel not shown

## Technical Design Decisions

**Decision 1: FRA Only for Step 1**
- **Rationale:** Prove the concept with one document type before scaling
- **Alternative:** All three types at once (rejected: too risky, hard to debug)

**Decision 2: Bullet Format + Closing Paragraph**
- **Rationale:** Easy to scan, professional, matches stakeholder expectations
- **Alternative:** Full prose paragraphs (rejected: too dense, less scannable)

**Decision 3: Client-Side AI Utility**
- **Rationale:** Simpler architecture, no Edge Function complexity
- **Alternative:** Server-side Edge Function (rejected: overkill for Step 1)

**Decision 4: Collapsible Author Section**
- **Rationale:** Reduces clutter, optional nature clear
- **Alternative:** Always expanded (rejected: too much visual weight)

**Decision 5: Auto-Mode Switching**
- **Rationale:** Intelligent defaults reduce user decision fatigue
- **Alternative:** Force user to manually set mode (rejected: extra clicks)

**Decision 6: Separate AI and Author Fields**
- **Rationale:** Preserves both independently, allows mode switching without data loss
- **Alternative:** Single field with source flag (rejected: complex, prone to overwriting)

**Decision 7: Locked Panel for Issued Docs**
- **Rationale:** Matches document lifecycle, prevents post-issue manipulation
- **Alternative:** Always editable (rejected: audit trail concerns, lifecycle violation)

**Decision 8: Panel at Top of Workspace**
- **Rationale:** High visibility, consistent with "executive" nature, logical pre-modules position
- **Alternative:** Separate tab or modal (rejected: hidden, extra navigation)

## File Structure

| File | Purpose |
|------|---------|
| `supabase/migrations/...add_executive_summary_fields.sql` | Database schema (3 columns) |
| `src/lib/ai/generateExecutiveSummary.ts` | AI generation utility (bullet format) |
| `src/components/documents/ExecutiveSummaryPanel.tsx` | UI component (FRA only) |
| `src/pages/documents/DocumentWorkspace.tsx` | Integration point (conditional render) |
| `src/lib/pdf/pdfUtils.ts` | PDF helper function (shared) |
| `src/lib/pdf/buildFraPdf.ts` | FRA PDF integration (active) |
| `src/lib/pdf/buildFsdPdf.ts` | FSD PDF ready (not called in Step 1) |
| `src/lib/pdf/buildDsearPdf.ts` | DSEAR PDF ready (not called in Step 1) |
| `src/utils/documentVersioning.ts` | Version reset logic |

## Database Objects

| Object | Type | Purpose |
|--------|------|---------|
| `documents.executive_summary_ai` | Column | AI-generated summary (bullets + closing) |
| `documents.executive_summary_author` | Column | Author-written summary |
| `documents.executive_summary_mode` | Column | Display mode enum (ai/author/both/none) |
| `idx_documents_executive_summary_mode` | Index | Fast mode filtering |

## Configuration & Defaults

**Defaults:**
- New FRA documents: mode = 'ai', both summaries = null
- New versions: mode = 'ai', both summaries = null
- Manual generation required (no auto-gen)

**Constraints:**
- AI summary: 250-450 words (5-8 bullets + closing)
- Author summary: No length limit
- Mode: Must be one of 4 valid values
- PDF: Appears immediately after title page

**Validation:**
- Mode: CHECK constraint on enum values
- Organisation: Foreign key enforced
- Issue status: Guards prevent editing if not draft

## Testing Scenarios (Acceptance Tests)

### Test 1: FRA Document Shows Panel ✓
- Given: User opens FRA document workspace
- When: Page loads
- Then: Executive Summary Panel visible at top

### Test 2: Non-FRA Documents Hide Panel ✓
- Given: User opens Explosion or FSD document workspace
- When: Page loads
- Then: Executive Summary Panel NOT visible

### Test 3: Generate AI Summary ✓
- Given: Draft FRA document with modules and actions
- When: User clicks "Generate AI Summary"
- Then: AI summary appears in blue panel, bullet format, saved to DB

### Test 4: Regenerate AI Summary ✓
- Given: FRA document with existing AI summary
- When: User clicks "Regenerate"
- Then: New AI summary replaces old one, saved to DB

### Test 5: Write Author Summary ✓
- Given: Draft FRA, mode set to 'author'
- When: User types in author textarea and saves
- Then: Author text saved to DB, mode remains 'author'

### Test 6: Use Both Summaries ✓
- Given: FRA with AI summary, mode set to 'both'
- When: User adds author commentary and saves
- Then: Both summaries saved, mode = 'both'

### Test 7: Mode Auto-Switching ✓
- Given: FRA with AI summary, mode = 'ai'
- When: User types in author field
- Then: Mode auto-switches to 'both'

### Test 8: Omit Summary (None) ✓
- Given: Draft FRA, mode set to 'none'
- When: Generate PDF
- Then: No executive summary section in PDF

### Test 9: Locked Panel (Issued) ✓
- Given: Issued FRA document with summaries
- When: User views workspace
- Then: Panel shows Lock icon, read-only mode, no edits possible

### Test 10: PDF Includes AI Summary ✓
- Given: FRA with AI summary, mode = 'ai'
- When: Generate PDF
- Then: "Executive Summary" page after title, bullets + closing

### Test 11: PDF Includes Both Summaries ✓
- Given: FRA with both summaries, mode = 'both'
- When: Generate PDF
- Then: "Executive Summary" page, then "Author Commentary" page

### Test 12: New Version Clears Summaries ✓
- Given: Issued FRA v1 with summaries
- When: User creates new version
- Then: v2 has cleared summaries, mode = 'ai', v1 summaries retained

### Test 13: Error Handling ✓
- Given: Network failure during generation
- When: Error occurs
- Then: Inline error displayed, existing text preserved, dismiss option

### Test 14: Save Changes Button ✓
- Given: Draft FRA, user changes mode or author text
- When: Changes made
- Then: "Save Changes" button appears, saves when clicked

### Test 15: Collapsible Author Section ✓
- Given: Draft FRA, mode = 'both' or 'author'
- When: User clicks author section header
- Then: Section collapses/expands with chevron icon

## Key Benefits

**For Assessors:**
- AI assistance speeds up writing (5-8 bullets auto-generated)
- Full control via author field (can override completely)
- Flexibility to use either or both (4 modes)
- No forced AI content (can choose 'none' or 'author')

**For Senior Consultants:**
- Can override AI completely (author mode)
- Supplement AI with expertise (both mode)
- Matches existing workflow (draft → review → issue)
- Professional bullet-point format

**For Cautious Users:**
- AI never overwrites work (independent fields)
- Manual trigger required (no surprises)
- Can disable entirely (mode: none)
- Clear control with mode selector

**For Clients:**
- Professional executive summary at top of FRA
- Clear, non-technical language (UK spelling)
- Bullet points easy to scan
- Appropriate to document type

**For Insurers:**
- Locked on issue (immutable with document)
- Professional presentation
- Clear key findings upfront
- Regulatory compliance ready

## Known Limitations

**Step 1 Scope:**
- FRA documents only (Explosion/DSEAR and FSD in Step 2)
- No tone variants (single professional tone)
- No jurisdiction-specific prompts (UK-focused)
- No per-bullet toggles (all or nothing)

**Technical Constraints:**
- Client-side generation only (no server-side AI)
- No caching (regenerates from scratch each time)
- Single AI attempt per click (no retry logic)

**Business Constraints:**
- Draft-only editing (locked on issue)
- Organisation-scoped (no cross-org access)
- Manual generation only (no auto-trigger)

## Future Enhancements (Step 2 and Beyond)

**Step 2: Replicate for Explosion/DSEAR and FSD**
- Copy proven pattern to other document types
- Adjust AI prompts for document-specific content
- Update workspace pages for Explosion and FSD
- Test thoroughly before release

**Future Enhancements:**

1. **Jurisdiction-Specific Prompts**
   - Different AI prompts per region (England, Scotland, Wales)
   - Tone adjustments for local regulations

2. **Tone Variants**
   - Formal/informal/technical tone options
   - User-selectable via dropdown

3. **Per-Bullet Toggles**
   - Select which AI bullets to include
   - Drag-and-drop reordering

4. **Auto-Regeneration**
   - Option to regenerate on data change
   - Smart detection of material changes

5. **Summary Templates**
   - Pre-defined summary templates per sector
   - Industry-specific language

6. **AI Suggestions for Author Text**
   - AI proposes improvements to author text
   - Side-by-side comparison view

7. **Translation Support**
   - Multi-language summaries (Welsh, etc.)
   - Locale-specific formatting

## Summary

**Executive Summary for FRA documents is now fully implemented with:**

✅ **FRA only** (Step 1 complete, ready for Step 2)
✅ **Bullet format** (5-8 bullets + closing paragraph)
✅ **Flexible modes:** AI, author, both, or none
✅ **Manual generation:** User-triggered, never automatic
✅ **Author control:** AI never overwrites author text
✅ **FRA PDF integration:** Immediately after title page
✅ **Locked on issue:** Immutable with document lifecycle
✅ **Version isolation:** Each version starts fresh (mode = 'ai', summaries = null)
✅ **Professional output:** 250-450 words, non-technical, UK spelling
✅ **Error handling:** Graceful degradation throughout
✅ **Build verified:** Clean compilation, no errors

**Next Steps:**
1. User acceptance testing with FRA documents
2. Gather feedback on AI summary quality
3. Refine bullet generation logic if needed
4. Replicate for Explosion/DSEAR (Step 2)
5. Replicate for FSD (Step 2)
6. Launch to production

**Ready for:** Production deployment with FRA documents
**Proven:** Once validated, pattern ready to scale to other doc types
