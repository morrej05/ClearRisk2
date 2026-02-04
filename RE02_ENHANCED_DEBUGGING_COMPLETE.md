# RE-02 Enhanced Debugging - Complete

**Date:** 2026-02-04
**Status:** ✅ Enhanced Logging Added

---

## 🎯 What Was Done

Added comprehensive dev-only logging to track exactly where roof area values are being lost during the save process.

---

## 🔍 Key Investigation Points

### 1. Confirmed UI State Keys

The input bindings use:
```typescript
<input
  type="text"
  value={bldg.roof.area_sqm}  // ✓ Correct key
  onChange={(e) =>
    updateBuilding(bldg.id, {
      roof: { ...bldg.roof, area_sqm: e.target.value },  // ✓ Correct key
    })
  }
/>
```

**State key:** `roof.area_sqm` (string)

### 2. Confirmed Payload Builder Keys

The normalization function already uses the correct keys:
```typescript
function normalizeConstructionForSave(formState: { buildings: BuildingFormState[]; site_notes: string }) {
  return {
    buildings: formState.buildings.map((b) => ({
      roof: {
        area_sqm: parseNumericInput(b.roof.area_sqm),  // ✓ Reads correct key
        breakdown: b.roof.breakdown,
        total_percent: b.roof.total_percent,
      },
      // ...
    })),
  };
}
```

**Payload key:** `roof.area_sqm` (number after parsing)

### 3. Confirmed No Filtering

The save function does NOT filter out buildings:
```typescript
const buildingsWithoutCalculated = normalizedData.buildings.map(({ calculated, ...building }) => ({
  ...building,
}));
```

Only removes `calculated` field, never filters array.

---

## 📊 Enhanced Logging Added

### A. Normalization Logging

Added at the START of `normalizeConstructionForSave()`:

```javascript
🔄 RE-02 TRACE: Normalization Starting
  Input buildings count: 1
  First building roof.area_sqm (raw string): "5000"
  Type of roof.area_sqm: "string"
  After parseNumericInput: 5000
  Type after parse: "number"
```

**This shows:**
- What value we're reading from state
- Its type (should be string)
- What parseNumericInput returns
- Its type (should be number or object for null)

### B. Save Detail Logging

Enhanced the save logging to show THREE stages:

```javascript
🏗️ RE-02 TRACE: Save Starting
  📊 State buildings count: 1
  📊 Normalized buildings count: 1
  📊 Payload buildings count: 1

  🔍 DETAILED FIRST BUILDING TRACE:
    State (raw): {
      id: "abc-123",
      name: "Building A",
      roof_area_sqm: "5000",       // ← String from UI
      roof_area_type: "string"
    }
    Normalized: {
      id: "abc-123",
      name: "Building A",
      roof_area_sqm: 5000,          // ← Number after parse
      roof_area_type: "number"
    }
    Payload (after removing calculated): {
      id: "abc-123",
      name: "Building A",
      roof_area_sqm: 5000,          // ← Should still be number
      roof_area_type: "number"
    }

  🔍 First building (full): {...}
  🎯 Payload roof area (building 0): 5000
```

**This shows:**
1. **State (raw)** - What we read from React state
2. **Normalized** - After normalizeConstructionForSave
3. **Payload** - After removing calculated fields

**If payload shows null, we'll know exactly which step broke it!**

### C. Read-Back Verification

Enhanced to show type information:

```javascript
✅ RE-02 TRACE: Read-Back Verification
  📥 DB buildings count: 1
  🔍 All buildings from DB: [...]
  🔍 Full first building from DB: {...}
  🎯 DB roof area (building 0): 5000
  🎯 DB roof area type: "number"
  🆔 DB Fingerprint: ...
  🔢 DB Version: 1
```

**This confirms:**
- How many buildings made it to DB
- What the DB actually stored
- The type of the stored value

---

## 🧪 How to Use This Logging

### Step 1: Open RE-02 Module
Navigate to any RE document's RE-02 Construction section.

### Step 2: Add a Building with Roof Area
1. Click "Add Building"
2. Enter building name: "Test Building"
3. Enter roof area: "5000"
4. Click Save

### Step 3: Check Console Logs

You'll see this sequence:

```javascript
// 1. BEFORE SAVE - State tracking
🔄 RE-02 TRACE: Normalization Starting
  Input buildings count: 1
  First building roof.area_sqm (raw string): "5000"  // ← Should be string
  Type of roof.area_sqm: "string"
  After parseNumericInput: 5000                       // ← Should be number
  Type after parse: "number"

// 2. DURING SAVE - Detail tracking
🏗️ RE-02 TRACE: Save Starting
  📊 State buildings count: 1
  📊 Normalized buildings count: 1                    // ← Should match state
  📊 Payload buildings count: 1                       // ← Should match normalized

  🔍 DETAILED FIRST BUILDING TRACE:
    State (raw): { roof_area_sqm: "5000", roof_area_type: "string" }
    Normalized: { roof_area_sqm: 5000, roof_area_type: "number" }
    Payload: { roof_area_sqm: 5000, roof_area_type: "number" }  // ← Should be number!

// 3. AFTER SAVE - Verification
✅ RE-02 TRACE: Read-Back Verification
  📥 DB buildings count: 1                            // ← Should match payload
  🎯 DB roof area (building 0): 5000                  // ← Should match payload
  🎯 DB roof area type: "number"
```

### Step 4: Identify Where It Breaks

**If you see:**

```javascript
State (raw): { roof_area_sqm: "5000", ... }           // ✓ Good
Normalized: { roof_area_sqm: null, ... }              // ❌ BREAKS HERE!
Payload: { roof_area_sqm: null, ... }
```

**Then:** `parseNumericInput()` is failing to parse "5000"

**If you see:**

```javascript
State (raw): { roof_area_sqm: "5000", ... }           // ✓ Good
Normalized: { roof_area_sqm: 5000, ... }              // ✓ Good
Payload: { roof_area_sqm: null, ... }                 // ❌ BREAKS HERE!
```

**Then:** The `map` that removes `calculated` is also removing `area_sqm`

**If you see:**

```javascript
State (raw): { roof_area_sqm: "5000", ... }           // ✓ Good
Normalized: { roof_area_sqm: 5000, ... }              // ✓ Good
Payload: { roof_area_sqm: 5000, ... }                 // ✓ Good
DB roof area: null                                     // ❌ BREAKS HERE!
```

**Then:** Supabase write or read is corrupting the value

---

## 🔬 What the Logs Will Reveal

### Scenario A: parseNumericInput Broken

**Symptoms:**
- State shows string "5000"
- Normalized shows null
- Payload shows null

**Diagnosis:** `parseNumericInput()` is not handling the input correctly.

**Possible causes:**
- Input has unexpected whitespace
- Input has invalid characters
- parseNumericInput logic is broken

### Scenario B: Map Operation Broken

**Symptoms:**
- State shows string "5000"
- Normalized shows number 5000
- Payload shows null

**Diagnosis:** The `map` operation that removes `calculated` is also removing `area_sqm`.

**Possible causes:**
- Destructuring is wrong
- Building object doesn't have the expected structure
- Type mismatch

### Scenario C: Database Issue

**Symptoms:**
- State shows string "5000"
- Normalized shows number 5000
- Payload shows number 5000
- DB shows null

**Diagnosis:** Supabase is not storing or returning the value correctly.

**Possible causes:**
- Database column type issue
- RLS policy stripping fields
- JSONB serialization issue

### Scenario D: All Working!

**Symptoms:**
- State: "5000" (string)
- Normalized: 5000 (number)
- Payload: 5000 (number)
- DB: 5000 (number)

**Then:** The previous fix (migration logic) solved the issue!

---

## 📝 Files Modified

### src/components/modules/forms/RE02ConstructionForm.tsx

**Changes:**

1. **Lines 158-169:** Added normalization logging
   - Logs input value, type, parsed value, and parsed type
   - Helps identify parseNumericInput issues

2. **Lines 855-898:** Enhanced save logging
   - Logs all three stages: state, normalized, payload
   - Shows building counts at each stage
   - Shows detailed field-by-field comparison

3. **Lines 924-937:** Enhanced read-back logging
   - Shows all buildings from DB
   - Shows type of roof area from DB
   - Helps identify DB storage issues

---

## ✅ Build Status

```
✓ built in 15.80s
✅ No TypeScript errors
✅ Enhanced logging active in DEV mode
✅ Ready for diagnostic testing
```

---

## 🎯 Next Steps

1. **Navigate to RE-02 in the app**
2. **Add a building with roof area = 5000**
3. **Click Save**
4. **Check browser console for the detailed logs**
5. **Identify which stage shows null**
6. **Report back with the console output**

The logs will show EXACTLY where the value is being lost:
- ❌ If Normalized = null → parseNumericInput is broken
- ❌ If Payload = null → map operation is broken
- ❌ If DB = null → Supabase is broken
- ✅ If all show number → It's fixed!

---

## 🎓 Why This Approach

Instead of guessing where the bug is, we're:

1. **Instrumenting the entire pipeline** - Track value at every step
2. **Showing types, not just values** - Null vs "null" vs 0 vs null
3. **Comparing stages side-by-side** - See exactly where it breaks
4. **Tracking counts too** - Buildings can disappear at any stage

**This is forensic debugging** - we'll know EXACTLY where the bug is within ONE test cycle.

---

**Status:** ✅ Enhanced logging deployed
**Build:** ✅ Successful
**Mode:** DEV-only (no production impact)
**Testing:** Ready - just add a building and check console

The diagnostic logging is live. Next save will show exactly where roof area becomes null!
