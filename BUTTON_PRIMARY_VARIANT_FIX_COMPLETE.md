# Button Primary Variant - Transparent Background Fix Complete

## Problem
Primary variant buttons (using `bg-brand-accent`) were rendering with transparent backgrounds at runtime, even though the CSS variables were correctly configured.

## Root Cause
The base button styles or other CSS rules were overriding the `bg-brand-accent` class without `!important`, causing the background to be transparent.

## Solution Applied

### 1. Updated Button Component (src/components/ui/DesignSystem.tsx)
**Line 32:** Modified primary variant to use `!important` utilities:

```typescript
// Before:
primary: 'bg-brand-accent text-white hover:bg-brand-accent-hover focus:ring-brand-accent',

// After:
primary: '!bg-brand-accent !text-white hover:!bg-brand-accent-hover focus:ring-brand-accent',
```

**Impact:**
- All primary variant buttons now force the brand accent background color
- Text color is forced to white for proper contrast
- Hover state also uses `!important` to ensure hover background wins
- Focus ring remains unchanged (no conflicts)

### 2. Removed Redundant Override (src/pages/documents/DocumentOverview.tsx)
**Line 963:** Removed unnecessary className override from "Continue Assessment" button:

```tsx
// Before:
<Button
  onClick={handleContinueAssessment}
  className="!bg-brand-accent !text-white hover:!bg-brand-accent-hover"
>

// After:
<Button
  onClick={handleContinueAssessment}
>
```

**Rationale:** Since the Button component now handles this centrally, page-level overrides are no longer needed.

## Verification

### Build Output
✅ Build successful with updated CSS

### Compiled CSS Classes
```css
.\!bg-brand-accent {
  --tw-bg-opacity: 1 !important;
  background-color: rgb(var(--brand-accent) / var(--tw-bg-opacity, 1)) !important;
}

.\!text-white {
  --tw-text-opacity: 1 !important;
  color: rgb(255 255 255 / var(--tw-text-opacity, 1)) !important;
}
```

### Expected Runtime Behavior
**Primary Buttons will now render with:**
- Background: `rgb(47, 62, 78)` - Solid slate-700 color
- Text: `rgb(255, 255, 255)` - White
- Hover: `rgb(30, 41, 59)` - Darker slate-800

**Affected Buttons:**
1. "Continue Assessment" (DocumentOverview)
2. "Issue Document" (IssueDocumentModal)
3. All other primary variant Button components throughout the app

## Other Variants Unchanged
- **Secondary**: Still uses `bg-white` (no !important needed)
- **Destructive**: Still uses `bg-risk-high-fg` (no !important needed)
- **Ghost**: Still uses transparent background with hover effects

## Testing Checklist
- [ ] Open DocumentOverview page with draft document
- [ ] Verify "Continue Assessment" button has solid slate background
- [ ] Verify button text is white
- [ ] Verify hover state changes to darker slate
- [ ] Test "Issue Document" button in modal
- [ ] Verify secondary/destructive/ghost buttons still work correctly

## Notes
- This fix is **local to the Button component** as requested
- No global Tailwind configuration changes
- No global CSS overrides added
- Only the primary variant uses `!important` utilities
- The fix applies to all primary buttons across the entire application
