# Color System Documentation

## Overview
The application uses a unified, token-based color system with a single source of truth. All colors flow from `src/theme/tokens.ts` and are consistently applied across web UI and PDF outputs.

## Design Philosophy: Choice B

**Neutral + Subtle Slate Accent with Muted Semantic Risk Colors**

- UI neutrals for all general interface elements
- Subtle brand accent for primary actions
- Muted risk colors ONLY for semantic badges, markers, and risk matrices
- NO strong saturated colors in large blocks
- PDF section headers are NEUTRAL to avoid client logo clashes

## Color Families

### UI Neutrals
Use for text, backgrounds, borders, and general UI elements.

```tsx
text-ui-ink       // Headings, primary text
text-ui-text      // Body text
text-ui-muted     // Secondary text, labels

bg-ui-surface     // Page background
bg-ui-card        // Card background
bg-ui-border      // Borders
bg-ui-divider     // Subtle dividers
```

### Brand Accent
Use for primary actions, links, and subtle emphasis.

```tsx
text-brand-accent           // Links, accent text
bg-brand-accent             // Primary buttons
bg-brand-accent-hover       // Button hover states
bg-brand-accent-soft        // Light accent backgrounds
ring-brand-accent           // Focus rings
```

### Risk Colors (Semantic Only!)
Use ONLY for semantic status indicators: badges, markers, risk matrices.
DO NOT use for large blocks or backgrounds.

```tsx
// High Risk (Critical, Material, Error)
text-risk-high-fg
bg-risk-high-bg
border-risk-high-border

// Medium Risk (Moderate, Minor, Warning)
text-risk-medium-fg
bg-risk-medium-bg
border-risk-medium-border

// Low Risk (Low, Compliant, Success)
text-risk-low-fg
bg-risk-low-bg
border-risk-low-border

// Info (Neutral, Unknown, Info)
text-risk-info-fg
bg-risk-info-bg
border-risk-info-border
```

## Semantic Helper Functions

Import from `src/theme/semanticClasses.ts` for consistent, reusable patterns.

### Risk Badges
```tsx
import { getRiskBadgeClasses } from '@/theme/semanticClasses';

<span className={`px-2 py-1 rounded ${getRiskBadgeClasses('high')}`}>
  Critical
</span>
```

### Priority Badges
```tsx
import { getPriorityBadgeClasses } from '@/theme/semanticClasses';

<span className={`px-2 py-1 rounded ${getPriorityBadgeClasses('Critical')}`}>
  P1
</span>
```

### Alert Banners
```tsx
import { getAlertClasses } from '@/theme/semanticClasses';

<div className={`p-4 ${getAlertClasses('error')}`}>
  Error message
</div>
```

### Buttons
```tsx
import {
  getPrimaryButtonClasses,
  getSecondaryButtonClasses,
  getDestructiveButtonClasses
} from '@/theme/semanticClasses';

<button className={`px-4 py-2 rounded ${getPrimaryButtonClasses()}`}>
  Submit
</button>

<button className={`px-4 py-2 rounded ${getSecondaryButtonClasses()}`}>
  Cancel
</button>

<button className={`px-4 py-2 rounded ${getDestructiveButtonClasses()}`}>
  Delete
</button>
```

### Typography
```tsx
import {
  getHeadingClasses,
  getBodyTextClasses,
  getMutedTextClasses
} from '@/theme/semanticClasses';

<h2 className={getHeadingClasses('h2')}>Section Title</h2>
<p className={getBodyTextClasses()}>Body text content</p>
<span className={getMutedTextClasses()}>Secondary info</span>
```

## Usage Rules

### ✅ DO:
- Use token-based classes (`text-ui-*`, `bg-brand-*`, `text-risk-*-fg`)
- Use semantic helper functions for common patterns
- Use risk colors for badges, markers, and status indicators only
- Keep PDF section headers neutral (white background, dark text)
- Use alpha transparency when needed (`bg-ui-surface/50`)

### ❌ DON'T:
- Use raw Tailwind color classes (`text-blue-600`, `bg-red-50`, `text-amber-700`)
- Use risk colors for large blocks or full-width backgrounds
- Add colored bars to PDF section headers
- Mix semantic meanings (don't use `risk-high` for non-risk elements)
- Create new color utilities outside the token system

## PDF Usage

In PDF generation code, import tokens and use `PDF_THEME`:

```typescript
import { PDF_THEME } from '@/lib/pdf/pdfStyles';

// Text colors
page.drawText(title, {
  color: PDF_THEME.colours.ink,    // Dark text
});

page.drawText(subtitle, {
  color: PDF_THEME.colours.muted,  // Lighter text
});

// Backgrounds
page.drawRectangle({
  color: PDF_THEME.colours.card,   // White
});

// Risk badges
page.drawRectangle({
  color: PDF_THEME.colours.risk.high.bg,
  borderColor: PDF_THEME.colours.risk.high.border,
});

// Brand elements (use sparingly)
page.drawRectangle({
  color: PDF_THEME.colours.brand.accent,
});
```

### PDF Section Headers (Neutral!)
Section headers must remain neutral to avoid client logo clashes:

```typescript
// ✅ CORRECT - Neutral header
drawSectionHeaderBar({
  page,
  x, y, w,
  sectionNo: '1',
  title: 'Introduction',
  product: 'fra',  // Ignored, all map to brand.accent
  fonts,
});
// Renders: White background, dark text, subtle divider

// ❌ WRONG - Don't add colored bars
page.drawRectangle({
  color: rgb(0.8, 0.2, 0.2),  // NO RED BARS!
});
```

## Migration Guide

### Converting Existing Code

**Before:**
```tsx
<button className="bg-blue-600 hover:bg-blue-700 text-white">
  Submit
</button>

<span className="bg-red-100 text-red-700 border-red-200">
  Error
</span>

<h2 className="text-gray-900">Title</h2>
<p className="text-gray-600">Body</p>
```

**After:**
```tsx
<button className="bg-brand-accent hover:bg-brand-accent-hover text-white">
  Submit
</button>

<span className="bg-risk-high-bg text-risk-high-fg border border-risk-high-border">
  Error
</span>

<h2 className="text-ui-ink">Title</h2>
<p className="text-ui-text">Body</p>
```

### Quick Color Mapping

| Old | New | Use Case |
|-----|-----|----------|
| `text-blue-600/700/800` | `text-brand-accent` | Links, primary actions |
| `bg-blue-600` | `bg-brand-accent` | Primary buttons |
| `bg-blue-50` | `bg-brand-accent-soft` | Light backgrounds |
| `text-red-700` | `text-risk-high-fg` | Error text |
| `bg-red-100` | `bg-risk-high-bg` | Error badges |
| `text-amber-700` | `text-risk-medium-fg` | Warning text |
| `bg-amber-100` | `bg-risk-medium-bg` | Warning badges |
| `text-green-700` | `text-risk-low-fg` | Success text |
| `bg-green-100` | `bg-risk-low-bg` | Success badges |
| `text-gray-900` | `text-ui-ink` | Headings |
| `text-gray-700` | `text-ui-text` | Body text |
| `text-gray-500` | `text-ui-muted` | Secondary text |
| `bg-gray-50` | `bg-ui-surface` | Page background |
| `bg-white` | `bg-ui-card` | Cards |

## Examples

### Risk Badge Component
```tsx
function RiskBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const classes = {
    high: 'bg-risk-high-bg text-risk-high-fg border border-risk-high-border',
    medium: 'bg-risk-medium-bg text-risk-medium-fg border border-risk-medium-border',
    low: 'bg-risk-low-bg text-risk-low-fg border border-risk-low-border',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${classes[level]}`}>
      {level.toUpperCase()}
    </span>
  );
}
```

### Action Card
```tsx
function ActionCard({ action }) {
  return (
    <div className="bg-ui-card border border-ui-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-ui-ink font-semibold">{action.title}</h3>
        <span className={getRiskBadgeClasses(action.priority)}>
          {action.priority}
        </span>
      </div>
      <p className="text-ui-text mt-2">{action.description}</p>
      <span className="text-ui-muted text-sm mt-1">
        Due: {action.dueDate}
      </span>
    </div>
  );
}
```

### Primary Button
```tsx
function SubmitButton() {
  return (
    <button className="bg-brand-accent hover:bg-brand-accent-hover text-white px-4 py-2 rounded-lg font-medium transition-colors focus:ring-2 focus:ring-brand-accent focus:ring-offset-2">
      Submit Report
    </button>
  );
}
```

## Token Reference

Full token definitions in `src/theme/tokens.ts`:

```typescript
export const TOKENS = {
  ui: {
    ink: '#111827',
    text: '#374151',
    muted: '#6B7280',
    surface: '#F9FAFB',
    card: '#FFFFFF',
    border: '#E5E7EB',
    divider: '#F1F5F9',
  },
  brand: {
    accent: '#2F3E4E',
    accentHover: '#1E293B',
    accentSoft: '#EEF2F7',
  },
  risk: {
    high: { fg: '#9B1C1C', bg: '#FDECEC', border: '#F5C2C2' },
    medium: { fg: '#B45309', bg: '#FFF4E5', border: '#FAD7B5' },
    low: { fg: '#166534', bg: '#EAF7EE', border: '#B7E4C7' },
    info: { fg: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
  },
};
```

## Support

For questions or issues with the color system:
1. Check this documentation first
2. Review `src/theme/tokens.ts` for available tokens
3. Check `src/theme/semanticClasses.ts` for helper functions
4. Review existing components for patterns

## Migration Policy

We are actively migrating legacy files to use semantic tokens. While migration is in progress:

### DO NOT introduce new raw color utilities

Use token-based classes and semantic helpers from `src/theme/semanticClasses.ts` for all new code.

### Regression Prevention

A color regression check prevents new raw non-neutral Tailwind utilities:

```bash
npm run check:colors
```

This script:
- Scans for raw color utilities (e.g., `text-blue-600`, `bg-red-100`)
- Compares count against baseline in `docs/non-neutral-colours.summary.txt`
- Fails CI if new raw colors are introduced

If you improve the codebase by removing raw colors:
1. Update baseline: `python3 scripts/non_neutral_colours_report.py`
2. Commit updated `docs/non-neutral-colours.*` files

### Migration Progress

Current scan results available in:
- `docs/non-neutral-colours.by-file.csv` - Raw color count by file
- `docs/non-neutral-colours.by-class.csv` - Raw color count by class
- `docs/non-neutral-colours.summary.txt` - Overall statistics

Priority files for migration listed in summary report.

## Maintenance

When updating colors:
1. Modify ONLY `src/theme/tokens.ts`
2. Changes propagate automatically to CSS, Tailwind, and PDFs
3. No need to touch individual components
4. Run `npm run build` to verify
