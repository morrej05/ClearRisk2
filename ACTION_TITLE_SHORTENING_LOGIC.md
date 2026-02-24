# Action Title Shortening Logic - Quick Reference

## How It Works

### Detection Logic
```
IF source = 'manual' OR 'user' OR 'author'
  → Keep full text unchanged
ELSE
  → Apply shortening heuristics
```

**Default:** Everything is treated as auto-generated unless explicitly marked manual.

### Shortening Heuristics (Applied in Order)

1. **Extract first clause**
   - Split on: newline, semicolon, or period
   - Take first part only

2. **Strip urgency prefix**
   - Remove: "Urgent:", "Immediate:" (case insensitive)

3. **Remove rationale tail**
   - Strip: "to ensure...", "in order to...", "so that..." and everything after

4. **Enforce max length**
   - Cap at 95 characters
   - Add '…' if truncated

### Examples

#### Auto Action #1
```
INPUT:  "Install fire alarm system with full coverage to ensure early detection."
OUTPUT: "Install fire alarm system with full coverage"
```

#### Auto Action #2
```
INPUT:  "Urgent: Replace emergency lighting; units are non-compliant"
OUTPUT: "Replace emergency lighting"
```

#### Auto Action #3
```
INPUT:  "Implement compartmentation improvements in order to prevent fire spread"
OUTPUT: "Implement compartmentation improvements"
```

#### Manual Action (Unchanged)
```
INPUT:  "Fix that dodgy fire door thing by the stairs ASAP!!!"
OUTPUT: "Fix that dodgy fire door thing by the stairs ASAP!!!"
```

## Where Applied

### PDF Sections
1. **Action Plan Snapshot** - Bullet list after executive summary
2. **Action Register (Section 13)** - Individual action cards
3. **FRA Action Cards** - Section-specific action detail cards
4. **Combined PDF** - All actions across report types

### Not Applied
- UI displays (database unchanged)
- Export formats (CSV, Excel)
- API responses
- Email notifications

## Testing

To verify behavior:
1. Create actions with different `source` values
2. Generate PDF
3. Check Action Plan Snapshot and Section 13

**Expected:**
- Auto actions → short, punchy titles
- Manual actions → preserved verbatim
