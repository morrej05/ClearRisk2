# Fire Protection Implementation Consolidation

## Problem

The codebase had **duplicate implementations** of Fire Protection scoring logic:
- `src/pages/re/FireProtectionPage.tsx` (887 lines) - Legacy standalone page
- `src/components/modules/forms/RE06FireProtectionForm.tsx` (1803 lines) - Module form
- `src/lib/re/fireProtectionModel.ts` - Shared model with OLD versions of functions

Both page implementations had **inline duplicate functions** that were out of sync with each other and the model.

## Solution

### 1. Consolidated Core Functions in Model

Updated `src/lib/re/fireProtectionModel.ts` with the **correct, fixed implementations**:

- `calculateSprinklerScore()` - Fixed to handle null inputs correctly, no forced `= 0` defaults
- `calculateFinalActiveScore()` - Updated signature to support detection score, proper null handling
- `generateAutoFlags()` - Updated to handle null coverage values safely
- `calculateWaterScore()` - Already existed, verified correct

### 2. Removed Duplicates from RE06FireProtectionForm

**Deleted 154 lines** (141-295) of duplicate function implementations:
- ❌ Removed inline `calculateWaterScore()`
- ❌ Removed inline `calculateSprinklerScore()`
- ❌ Removed inline `calculateFinalActiveScore()`
- ❌ Removed inline `generateAutoFlags()`

**Added imports** from model:
```typescript
import {
  calculateSprinklerScore,
  calculateFinalActiveScore,
  generateAutoFlags,
  calculateWaterScore,
} from '../../../lib/re/fireProtectionModel';
```

**Kept RE06-specific helpers** (different data structures):
- ✓ `parseAreaValue()` - Local helper for area parsing
- ✓ `calculateSiteRollup()` - RE06-specific rollup logic
- ✓ `createDefaultSiteWater()` - RE06-specific defaults

### 3. Updated FireProtectionPage Call Site

Updated the function call to match new signature:
```typescript
// OLD:
return calculateFinalActiveScore(rawSprinklerScore, siteWaterScore);

// NEW:
return calculateFinalActiveScore(rawSprinklerScore, siteWaterScore, siteWaterScore, null);
```

### 4. Added Verification Console Logs

Temporarily added logs to verify both routes use the same implementation:
```typescript
console.log('[fireProtectionModel] calculateSprinklerScore called');
console.log('[fireProtectionModel] calculateFinalActiveScore called');
```

## File Changes

### Modified Files

1. **src/lib/re/fireProtectionModel.ts** (±70 lines)
   - Updated `calculateSprinklerScore()` with null-safe handling
   - Updated `calculateFinalActiveScore()` with detection support
   - Updated `generateAutoFlags()` with null-safe coverage checks
   - Added verification console.logs

2. **src/components/modules/forms/RE06FireProtectionForm.tsx** (-154 lines)
   - Added imports from fireProtectionModel
   - Removed duplicate inline functions (lines 141-295)
   - Now imports: calculateSprinklerScore, calculateFinalActiveScore, generateAutoFlags, calculateWaterScore

3. **src/pages/re/FireProtectionPage.tsx** (+1 line)
   - Updated `calculateFinalActiveScore()` call to match new signature
   - Added parameters: (sprinklerScore, waterScore, suggestedWaterScore, detectionScore)

## Verification

### Build Status
✅ Build successful: `npm run build` passes with no errors

### Runtime Chain
Both entrypoints now use the **same shared implementation**:

**Route 1: Module Form** (Document Workspace)
```
App.tsx (ModuleRenderer)
  → RE06FireProtectionForm.tsx
    → imports from fireProtectionModel.ts ✓
```

**Route 2: Standalone Page** (Legacy)
```
App.tsx (Route /documents/:id/re/fire-protection)
  → FireProtectionPage.tsx
    → imports from fireProtectionModel.ts ✓
```

### Console Verification
When either route is accessed, you'll see:
```
[fireProtectionModel] calculateSprinklerScore called
[fireProtectionModel] calculateFinalActiveScore called
```

## Benefits

1. **Single Source of Truth** - One implementation, no drift
2. **Bug Fixes Applied Once** - Coverage field fixes now affect both routes
3. **Reduced Code Duplication** - Removed 154 lines of duplicate code
4. **Maintainability** - Future changes only need to be made in one place
5. **Consistency** - Both routes now behave identically

## Next Steps

After verification in production:
- Remove the temporary console.log statements from fireProtectionModel.ts
- Consider consolidating the UI implementations (FireProtectionPage vs RE06FireProtectionForm)
- Possibly deprecate the standalone FireProtectionPage route if module form is preferred

## Testing Checklist

- [ ] Open RE-06 Fire Protection module in document workspace
- [ ] Open standalone Fire Protection page via route
- [ ] Verify both show console logs: `[fireProtectionModel] calculateSprinklerScore called`
- [ ] Test coverage input fields (blank stays blank, not forced to 0)
- [ ] Test final score calculation with/without detection score
- [ ] Verify both routes produce identical scores for same inputs
