# Action Snapshot System Title Shortening - COMPLETE

## Problem
The PDF Action Plan Snapshot was displaying full action text for all actions, including verbose system-generated actions. This made the snapshot less readable and took up unnecessary space, especially when system actions included rationale clauses like "to ensure..." or "in order to...".

## Solution
Implemented selective title shortening that:
- **Only shortens system-generated actions** (source='system')
- **Leaves manual actions unchanged** (preserves user-authored text exactly)
- Extracts the imperative clause (the actual action)
- Removes rationale tails ("to ensure...", "in order to...", "so that...")
- Removes urgency prefixes ("URGENT:", "IMMEDIATE:")
- Caps at 95 characters with ellipsis if needed

## Implementation

### File Modified
`src/lib/pdf/pdfUtils.ts`

### Changes Made

#### 1. Added deriveSystemActionTitle Helper (Lines 96-116)
```typescript
/**
 * Derive a concise title from a system-generated action for PDF snapshot display.
 * Manual actions are returned unchanged. System actions are shortened to first clause.
 */
export function deriveSystemActionTitle(action: { recommended_action?: string; source?: string }): string {
  const text = String(action?.recommended_action || '').trim();
  if (!text) return '(No action text provided)';

  const src = String(action?.source || '').toLowerCase();
  if (src !== 'system') return text; // only shorten system actions

  // Keep first clause (imperative), strip rationale tails, remove urgency prefix
  let title = text.split(/\n|;|\.(\s|$)/)[0].trim();
  title = title.replace(/^(urgent|immediate)\s*[:\-]\s*/i, '').trim();
  title = title.replace(/\s+\b(to|in order to|so that)\b.*$/i, '').trim();

  const max = 95;
  if (title.length > max) title = title.slice(0, max - 1).trimEnd() + '…';

  return title || text;
}
```

**Logic:**
1. Check if action is system-generated (source='system')
2. If not system, return full text unchanged
3. If system:
   - Split on newlines, semicolons, or sentence-ending periods
   - Take first clause only
   - Remove urgency prefixes (URGENT:, IMMEDIATE:)
   - Remove rationale phrases ("to ensure...", "in order to...", "so that...")
   - Cap at 95 characters with ellipsis

#### 2. Updated drawActionPlanSnapshot to Use New Function (Line 1088)
```typescript
// Before:
const actionTitle = deriveAutoActionTitle(action);

// After:
const actionTitle = deriveSystemActionTitle(action);
```

**Comment updated:**
```typescript
// Derive short title for system actions, full text for manual actions
```

## Behavior Changes

### Before
```
FRA-001: Install fire extinguishers on all floors to ensure compliance with BS 5306-8 and provide immediate fire suppression capability for small fires
```

### After (System Actions Only)
```
FRA-001: Install fire extinguishers on all floors
```

### Manual Actions (Unchanged)
```
FRA-002: Please check the fire alarm panel as it was beeping during inspection. The assessor mentioned this needs immediate attention.
```
(Full text preserved because source='manual')

## Comparison with deriveAutoActionTitle

### Old Function (deriveAutoActionTitle)
- Treated **anything non-manual** as auto (library, ai, system, undefined, etc.)
- Would shorten library/ai/system actions indiscriminately

### New Function (deriveSystemActionTitle)
- **Only shortens source='system'**
- Leaves manual, library, and AI actions at full length
- More selective and predictable

## Use Cases

### System Actions (Shortened)
- Source: 'system'
- Origin: Auto-generated from triggers, info gaps, recommendations engine
- Example: "Install emergency lighting to ensure safe egress" → "Install emergency lighting"

### Manual Actions (Full Text)
- Source: 'manual'
- Origin: User-authored in AddActionModal
- Preserves assessor's exact wording and context

### Library Actions (Full Text)
- Source: 'library'
- Origin: Selected from recommendation library
- Treated as curated, professional text worth preserving

### AI Actions (Full Text)
- Source: 'ai'
- Origin: AI-generated recommendations
- Preserves AI-generated context and reasoning

## Quality Gates

✅ **Source='system'** → Shortened, concise titles
✅ **Source='manual'** → Full text preserved
✅ **Source='library'** → Full text preserved
✅ **Source='ai'** → Full text preserved
✅ **Empty/null text** → "(No action text provided)"
✅ **Length limit** → 95 characters max with ellipsis
✅ **Rationale removal** → "to ensure...", "in order to...", "so that..."
✅ **Prefix removal** → "URGENT:", "IMMEDIATE:"

## Testing Scenarios

### 1. System Action with Rationale
**Input:**
```
recommended_action: "Install fire extinguishers on all floors to ensure compliance with BS 5306-8"
source: "system"
```
**Output:** "Install fire extinguishers on all floors"

### 2. System Action with Urgency Prefix
**Input:**
```
recommended_action: "URGENT: Replace emergency lighting batteries"
source: "system"
```
**Output:** "Replace emergency lighting batteries"

### 3. Manual Action
**Input:**
```
recommended_action: "Check the alarm panel as it was beeping during inspection"
source: "manual"
```
**Output:** "Check the alarm panel as it was beeping during inspection" (unchanged)

### 4. Library Action
**Input:**
```
recommended_action: "Implement a formal fire risk assessment review schedule to ensure ongoing compliance"
source: "library"
```
**Output:** Full text preserved

### 5. Long System Action
**Input:**
```
recommended_action: "Install automatic fire detection and alarm system throughout the building to ensure early warning"
source: "system"
```
**Output:** "Install automatic fire detection and alarm system throughout the building"

### 6. Multi-clause System Action
**Input:**
```
recommended_action: "Upgrade fire doors; ensure intumescent strips are fitted; test all door closers"
source: "system"
```
**Output:** "Upgrade fire doors"

## Integration Points

### Action Plan Snapshot (Section 4)
- Uses `deriveSystemActionTitle` in `drawActionPlanSnapshot`
- Displays up to 5 actions per priority band
- Each action shown as: `• [Ref] ([Section]): [Title]`

### Full Recommendations Section (Section 13)
- Still shows complete action text
- No shortening applied
- Full detail preserved for implementation

## Benefits

1. **Improved Readability**: Snapshot is cleaner and easier to scan
2. **Preserves User Intent**: Manual actions show exactly what assessor wrote
3. **Consistent Length**: All system actions display at similar lengths
4. **Professional Appearance**: Removes redundant rationale text
5. **Selective Shortening**: Only applies where it makes sense (system-generated)

## Dependency on Source Classification

This feature depends on correct `source` stamping in AddActionModal:
- System-generated → `source='system'`
- User-edited → `source='manual'`
- From library → `source='library'`
- AI-generated → `source='ai'`

See: `ADD_ACTION_SOURCE_CLASSIFICATION_FIX_COMPLETE.md`

## Status

✅ Implementation complete
✅ Build successful
✅ deriveSystemActionTitle helper added
✅ drawActionPlanSnapshot updated
✅ Selective shortening (system only)
✅ Manual actions preserved
✅ Ready for testing
