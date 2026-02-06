# RE-06 Fire Protection - Module Sidebar Integration Complete

## Objective
Add the standard module navigation sidebar (left-hand side) to the RE-06 Fire Protection dedicated page, matching the layout of other document module pages.

## Implementation

### 1. Created Shared ModuleSidebar Component
**File: `src/components/modules/ModuleSidebar.tsx`**

Extracted the module navigation sidebar into a reusable component with:
- Module list rendering with outcome indicators
- Mobile menu support with overlay
- Active module highlighting (supports both module ID and module_key)
- Responsive design (hidden on mobile by default, icon-only on tablet, full on desktop)
- Section grouping for combined assessments (FRA + FSD, Risk Engineering)
- Module navigation handler callback

**Key Props:**
```typescript
interface ModuleSidebarProps {
  modules: ModuleInstance[];
  selectedModuleId: string | null;           // For workspace modules
  selectedModuleKey?: string | null;         // For dedicated pages (like RE-06)
  onModuleSelect: (moduleId: string) => void;
  isMobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
}
```

### 2. Updated FireProtectionPage
**File: `src/pages/re/FireProtectionPage.tsx`**

Completely refactored to match DocumentWorkspace layout:

**Added:**
- Full module list loading from database
- ModuleSidebar component integration
- Standard document header with back button and document info
- EditLockBanner for issued documents
- SurveyBadgeRow for status display
- JurisdictionSelector (when applicable)
- DocumentStatusBadge
- Mobile menu toggle support
- Module navigation with proper routing

**Layout Structure:**
```
<div className="min-h-screen bg-neutral-50 flex flex-col">
  <EditLockBanner /> (if not editable)

  <Header>
    - Mobile menu button
    - Back button / breadcrumb
    - Document title & version
    - Status badges
    - Jurisdiction selector
  </Header>

  <div className="flex flex-1">
    <ModuleSidebar
      selectedModuleKey="RE_06_FIRE_PROTECTION"
      ...
    />

    <MainContent>
      <FireProtectionForm />
    </MainContent>
  </div>
</div>
```

**Key Features:**
- RE-06 is highlighted as active in the sidebar via `selectedModuleKey`
- Clicking other modules navigates to their appropriate page/route
- Preserves all existing FireProtectionForm functionality
- Matches workspace visual design exactly

### 3. Updated DocumentWorkspace
**File: `src/pages/documents/DocumentWorkspace.tsx`**

Refactored to use the shared ModuleSidebar component:

**Removed:**
- Local `ModuleNavItem` component (now in ModuleSidebar)
- Local `getOutcomeColor` helper (now in ModuleSidebar)
- Inline sidebar markup (replaced with ModuleSidebar component)

**Simplified:**
```typescript
<ModuleSidebar
  modules={modules}
  selectedModuleId={selectedModuleId}
  onModuleSelect={handleModuleSelect}
  isMobileMenuOpen={isMobileMenuOpen}
  onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
/>
```

## Benefits

1. **Code Reusability**: Single source of truth for module navigation sidebar
2. **Consistent UX**: RE-06 now has the same look and feel as workspace modules
3. **Easy Navigation**: Users can switch between modules from RE-06 page
4. **Maintainability**: Changes to sidebar behavior only need to be made in one place
5. **Scalability**: Easy to add more dedicated module pages in the future

## Behavior

### From RE-06 Fire Protection Page:
- User sees full module list in left sidebar
- RE-06 is highlighted as active
- Clicking RE-01, RE-02, etc. navigates to workspace with that module
- Clicking RE-03 navigates to workspace with that module
- Mobile menu works with hamburger toggle
- Back button returns to document overview

### From Workspace:
- Clicking RE-06 in sidebar navigates to `/documents/:id/re/fire-protection`
- RE-06 is NOT saved to localStorage (dedicated module)
- Other modules work normally in workspace

## Testing Checklist

✅ RE-06 page shows module sidebar
✅ RE-06 is highlighted as active in the sidebar
✅ Clicking other modules from RE-06 navigates correctly
✅ Mobile menu works on RE-06 page
✅ Back button navigates to document overview
✅ Edit lock banner displays for issued documents
✅ Document badges and status display correctly
✅ FireProtectionForm content preserved and functional
✅ Workspace still uses same sidebar component
✅ No visual regression in workspace
✅ Build successful with no TypeScript errors

## Files Modified

1. **Created**: `src/components/modules/ModuleSidebar.tsx` (new shared component)
2. **Modified**: `src/pages/re/FireProtectionPage.tsx` (added sidebar layout)
3. **Modified**: `src/pages/documents/DocumentWorkspace.tsx` (refactored to use ModuleSidebar)

## Build Status
✅ **Build successful** (2,020.84 kB, 16.45s)
