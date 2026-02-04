# RE-02 Construction Area Trace Inspector

**Date:** 2026-02-04
**Status:** ✅ Implemented (DEV only)

---

## 🎯 Purpose

The trace inspector tracks roof area values for Building 0 through every stage of the data flow to identify exactly where values disappear or get corrupted.

**Problem:** Area values disappearing after save, refresh, or navigation.

**Solution:** Live tracing UI that shows values at 5 critical checkpoints + automated verification.

---

## 🔍 How It Works

### 5 Checkpoints Tracked

The trace inspector monitors the roof area value at these stages:

```
User Types → [1] Input Display → [2] React State → [3] Payload → [4] DB → [5] Hydrated
```

#### 1. **Input Displayed** (Blue)
- What the user sees in the `<input>` field
- Source: `value={bldg.roof.area_sqm}`
- Type: `string`
- Example: `"1250"` or `"1,250"`

#### 2. **React State** (Green)
- What's stored in `formData.buildings[0].roof.area_sqm`
- Source: React state
- Type: `string` (BuildingFormState)
- Example: `"1250"`

#### 3. **Payload Sent** (Amber)
- What's sent to Supabase in the update
- Source: `normalizeConstructionForSave()` output
- Type: `number | null`
- Example: `1250` (number)

#### 4. **DB Read-Back** (Teal)
- What's returned from database immediately after save
- Source: Supabase `.select()` after `.update()`
- Type: `number | null`
- Example: `1250`

#### 5. **Hydrated** (Purple)
- What's loaded from `moduleInstance.data` on component mount
- Source: Props from parent component
- Type: `number | null`
- Example: `1250`

---

## 📊 Visual Inspector

### Location
Appears at the top of RE-02 Construction page (DEV mode only)

### Display

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 DEV TRACE INSPECTOR: Building 0 Roof Area      v3 | RE02_... │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────│
│  │ Input    │  │ React    │  │ Payload  │  │ DB Read  │  │ Hyd│
│  │ Display  │  │ State    │  │ Sent     │  │ Back     │  │ rate│
│  ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤  ├────│
│  │  1250    │  │  1250    │  │  1250    │  │  1250    │  │ 125│
│  │          │  │          │  │          │  │          │  │    │
│  │ What     │  │ In       │  │ To       │  │ From     │  │ On │
│  │ user     │  │ formData │  │ Supabase │  │ Supabase │  │ loa│
│  │ sees     │  │          │  │          │  │          │  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └────│
│                                                                   │
│  ✓ Input ↔ State OK   ✓ State ↔ Payload OK   ✓ Payload ↔ DB OK │
│                                                                   │
│  Last update: 10:23:45 AM                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Status Indicators

**Green badges (✓):** Values match between stages
- `✓ Input ↔ State OK` - Input and state are synchronized
- `✓ State ↔ Payload OK` - Normalization working correctly
- `✓ Payload ↔ DB OK` - Database storing values correctly
- `✓ DB ↔ Hydrated OK` - Rehydration working correctly

**Red badges (✗):** Values don't match - **THIS IS THE BUG!**
- `✗ Input ≠ State` - Controlled input broken
- `✗ State ≠ Payload` - Normalization issue or stale state
- `✗ Payload ≠ DB` - Database write/read corruption
- `✗ DB ≠ Hydrated` - Schema mismatch or wrong path

---

## 🐛 Debugging Guide

### Step 1: Load the Page

**What to check:**
- Does "Hydrated" show the correct value?
- Does "React State" match "Hydrated"?

**If Hydrated is wrong:**
```
Problem: Database doesn't have the value OR reading from wrong path
Fix: Check database directly, verify data.construction.buildings[0].roof.area_sqm
```

**If State doesn't match Hydrated:**
```
Problem: buildingToFormState() conversion issue
Fix: Check number-to-string conversion logic
```

### Step 2: Type in the Input

**What to check:**
- Does "Input Display" update immediately?
- Does "React State" match "Input Display"?

**If Input doesn't update:**
```
Problem: Input not controlled or wrong value binding
Fix: Check input's value={...} and onChange={...}
```

**If State doesn't match Input:**
```
Problem: onChange not updating state correctly
Fix: Check updateBuilding() function
```

### Step 3: Click Save

**What to check:**
- Console logs show detailed trace
- "Payload Sent" appears with correct number value
- Does "Payload" match normalized "State"?

**If Payload is wrong:**
```
Problem A: Stale state closure
Fix: Ensure handleSave uses formDataRef.current

Problem B: normalizeConstructionForSave() broken
Fix: Check parseNumericInput() logic

Problem C: Wrong building being serialized
Fix: Check buildings array indexing
```

**Console output to check:**
```javascript
🏗️ RE-02 TRACE: Save Starting
  📊 Buildings count: 1
  🔍 First building (full): { roof: { area_sqm: 1250, ... }, ... }
  🎯 Payload roof area (building 0): 1250
  🆔 Fingerprint: RE02_1738675425123_a4f5c8
  🔢 Version: 1
```

### Step 4: Verify DB Write

**What to check:**
- "DB Read-Back" appears after save
- Does "DB" match "Payload"?

**If DB doesn't match Payload:**
```
Problem A: Supabase update failed silently
Fix: Check console for errors, enable RLS logging

Problem B: Field being stripped/sanitized
Fix: Check for triggers or sanitizers on module_instances table

Problem C: Wrong JSON path in update
Fix: Verify payload structure matches DB schema
Console shows: data.construction.buildings[0].roof.area_sqm

Problem D: Merge conflict with existing data
Fix: Check mergedPayload structure in console
```

**Console output to check:**
```javascript
✅ RE-02 TRACE: Read-Back Verification
  🔍 Full first building from DB: { roof: { area_sqm: 1250, ... }, ... }
  🎯 DB roof area (building 0): 1250
  🆔 DB Fingerprint: RE02_1738675425123_a4f5c8

  ✅ Area verified: Payload matches DB
```

**If you see:**
```javascript
❌ AREA MISMATCH!
  Payload sent: 1250
  DB returned: null
  This means DB write or read is corrupting the value!
```
**Then:**
1. Check database directly in Supabase dashboard
2. Look for triggers or policies on `module_instances` table
3. Verify JSON path: `data.construction.buildings[0].roof.area_sqm`
4. Check if other code is writing to the same record

### Step 5: Refresh Page

**What to check:**
- Does "Hydrated" still have the value?
- Does it match "DB" from before refresh?

**If Hydrated is wrong after refresh:**
```
Problem A: Data not persisted to DB
Fix: Check DB write (Step 4)

Problem B: Reading from wrong path on mount
Fix: Check moduleInstance.data parsing
Verify: d.construction?.buildings[0]?.roof?.area_sqm

Problem C: Migration logic corrupting value
Fix: Check safeBuildings mapping logic
```

---

## 🔬 Console Logging

### On Mount (Hydration)
```javascript
🔍 RE-02 TRACE: Initial Hydration
  Raw DB value: 1250
  Hydrated to state: "1250"
  Full building: { roof: { area_sqm: 1250, ... }, ... }
```

### On Save (Complete Flow)
```javascript
🏗️ RE-02 TRACE: Save Starting
  📊 Buildings count: 1
  📝 Site notes: (empty)
  💾 Payload keys: ['construction', '__debug', ...]
  🔍 First building (full): { ... }
  🎯 Payload roof area (building 0): 1250
  🆔 Fingerprint: RE02_1738675425123_a4f5c8
  🔢 Version: 1

✅ RE-02 TRACE: Read-Back Verification
  📥 Read back buildings count: 1
  📥 Read back site notes: (empty)
  🔍 Full first building from DB: { ... }
  🎯 DB roof area (building 0): 1250
  🆔 DB Fingerprint: RE02_1738675425123_a4f5c8
  🔢 DB Version: 1
  ✅ Area verified: Payload matches DB
```

### Error Detection
```javascript
❌ AREA MISMATCH!
  Payload sent: 1250
  DB returned: null
  This means DB write or read is corrupting the value!
```

---

## 🎯 Common Breaking Points & Fixes

### Break Point A: Input ≠ State

**Symptom:**
- Trace shows: `✗ Input ≠ State`
- Input displays `"1250"` but state shows `""`

**Diagnosis:**
```typescript
// Input not controlled correctly
<input
  value={bldg.roof.area_sqm || ''}  // ❌ Wrong: uses || which breaks empty strings
  onChange={...}
/>
```

**Fix:**
```typescript
// Input fully controlled
<input
  value={bldg.roof.area_sqm}  // ✓ Correct: always use exact state value
  onChange={(e) => updateBuilding(id, { roof: { ...roof, area_sqm: e.target.value } })}
/>
```

---

### Break Point B: State ≠ Payload

**Symptom:**
- Trace shows: `✗ State ≠ Payload`
- State shows `"1250"` but payload shows `null` or wrong value

**Diagnosis:**
```typescript
// handleSave capturing stale state
const handleSave = async () => {
  const normalizedData = normalizeConstructionForSave(formData);  // ❌ Stale closure
  // ...
}
```

**Fix:**
```typescript
// handleSave using ref for latest state
const handleSave = async () => {
  const currentFormData = formDataRef.current;  // ✓ Latest state
  const normalizedData = normalizeConstructionForSave(currentFormData);
  // ...
}
```

---

### Break Point C: Payload ≠ DB

**Symptom:**
- Trace shows: `✗ Payload ≠ DB`
- Payload shows `1250` but DB returns `null`
- Console shows: `❌ AREA MISMATCH!`

**Diagnosis 1: Wrong JSON path**
```typescript
// Writing to wrong path
const payload = {
  buildings: [{ roof: { area_sqm: 1250 } }],  // ❌ Wrong: no 'construction' wrapper
};
```

**Fix:**
```typescript
// Correct path structure
const payload = {
  ...existingData,
  construction: {
    buildings: [{ roof: { area_sqm: 1250 } }],
  },
};
```

**Diagnosis 2: Merge overwriting**
```typescript
// Spread order wrong
const payload = {
  construction: oldValue,  // ❌ Wrong: old value overwrites new
  ...existingData,
};
```

**Fix:**
```typescript
// Correct spread order
const payload = {
  ...existingData,  // ✓ Correct: new overwrites old
  construction: newValue,
};
```

**Diagnosis 3: Database trigger stripping fields**
- Check Supabase for triggers on `module_instances`
- Check for RLS policies that might sanitize data
- Verify in Supabase dashboard: Database > Tables > module_instances > data column

---

### Break Point D: DB ≠ Hydrated

**Symptom:**
- Trace shows: `✗ DB ≠ Hydrated`
- DB shows `1250` immediately after save
- After refresh, Hydrated shows `null`

**Diagnosis 1: Another writer overwriting**
```typescript
// Something else is writing to the same record
useEffect(() => {
  await supabase
    .from('module_instances')
    .update({ data: {} })  // ❌ Clobbering our data!
    .eq('id', moduleInstance.id);
}, [someChange]);
```

**Fix:**
- Find all supabase updates to `module_instances`
- Add logging to track writes:
```typescript
console.log('🔴 MODULE WRITE:', moduleInstance.id, payload);
```

**Diagnosis 2: Schema mismatch**
```typescript
// Writing to: data.construction.buildings
// Reading from: data.buildings  // ❌ Wrong path!
```

**Fix:**
- Verify read and write use same path
- Check both: save path and hydration path

**Diagnosis 3: Migration corrupting on load**
```typescript
// Migration code breaking values
if (b.roof?.material) {
  roof = {
    area_sqm: b.roof.area_sqm ?? null,  // ✓ OK
    breakdown: [{ material: b.roof.material, percent: 100 }],
  };
} else {
  roof = createEmptyBuilding().roof;  // ❌ Loses area_sqm!
}
```

**Fix:**
```typescript
// Preserve existing values
} else {
  roof = {
    area_sqm: b.roof?.area_sqm ?? null,  // ✓ Preserve area
    breakdown: b.roof?.breakdown ?? [],
    total_percent: b.roof?.total_percent ?? 0,
  };
}
```

---

## 🔧 Debug Metadata

The inspector adds debug metadata to each save (DEV only):

```typescript
{
  __debug: {
    re02_fingerprint: "RE02_1738675425123_a4f5c8",  // Unique save ID
    re02_save_version: 3,                            // Incrementing counter
    re02_save_timestamp: "2026-02-04T10:23:45.123Z" // When saved
  }
}
```

**Use for:**
1. **Tracking saves:** Each save gets unique fingerprint
2. **Version tracking:** Counter increments to detect multiple saves
3. **Time tracking:** Precise timestamps for debugging

**Example query in Supabase:**
```sql
SELECT
  id,
  data->'__debug'->>'re02_fingerprint' as fingerprint,
  data->'__debug'->>'re02_save_version' as version,
  data->'construction'->'buildings'->0->'roof'->>'area_sqm' as roof_area
FROM module_instances
WHERE id = 'your-module-id'
ORDER BY (data->'__debug'->>'re02_save_version')::int DESC;
```

---

## 📝 Usage Instructions

### For Developers Testing

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to RE-02 Construction:**
   - Create or open a Risk Engineering assessment
   - Go to RE-02 module

3. **You'll see the trace inspector** (purple/blue card at top)

4. **Test the flow:**
   - Type in roof area field: Watch "Input" and "State" update
   - Click Save: Watch "Payload" and "DB" populate
   - Check status badges for any red (✗) indicators
   - Open console to see detailed logs

5. **Identify the break:**
   - First red badge shows where the break happens
   - Console logs show exact values at each stage
   - Fix that specific hop using guide above

6. **Verify fix:**
   - All badges should be green (✓)
   - Save, refresh, navigate away and back
   - Values should persist everywhere

### For Production

The trace inspector is **automatically disabled** in production:
- Controlled by `import.meta.env.DEV`
- No performance impact
- No UI clutter
- Debug metadata not saved

To remove entirely:
- Search for `import.meta.env.DEV` in RE02ConstructionForm.tsx
- Remove gated code blocks
- Remove debug trace state and UI

---

## 🎓 Key Insights

### Why This Approach Works

1. **End-to-end visibility:** See every transformation step
2. **Real-time updates:** Live tracking as user types
3. **Automated verification:** Immediate comparison of adjacent hops
4. **Precise logging:** Exact values logged at each stage
5. **No guessing:** Red badges point to exact break point

### What We're Testing

**Data Flow Integrity:**
```
Type "1,250"
  ↓ [onChange]
Store "1,250" in state
  ↓ [normalizeConstructionForSave]
Parse to 1250 (number)
  ↓ [supabase.update]
Write to DB
  ↓ [supabase.select]
Read 1250 from DB
  ↓ [buildingToFormState]
Convert to "1250" (string)
  ↓ [useState init]
Display "1250" in UI
```

**Each arrow is a checkpoint** where corruption can happen.
The trace inspector validates each transition.

---

## 🚀 Expected Results

### Healthy System (All Green)

```
Input Display: "1250"
React State:   "1250"
Payload Sent:  1250
DB Read-Back:  1250
Hydrated:      1250

✓ Input ↔ State OK
✓ State ↔ Payload OK
✓ Payload ↔ DB OK
✓ DB ↔ Hydrated OK
```

### Broken System (Red Badge)

```
Input Display: "1250"
React State:   "1250"
Payload Sent:  1250
DB Read-Back:  null      ← PROBLEM HERE
Hydrated:      null

✓ Input ↔ State OK
✓ State ↔ Payload OK
✗ Payload ≠ DB          ← FIX THIS HOP
```

---

## 📊 Architecture

### Component Structure

```typescript
RE02ConstructionForm
├─ useState: debugTrace
│  ├─ inputDisplayedArea: string
│  ├─ stateArea: string
│  ├─ payloadArea: number | null
│  ├─ dbArea: number | null
│  ├─ hydratedArea: number | null
│  ├─ lastSaveFingerprint: string
│  └─ lastSaveVersion: number
│
├─ useEffect: Track hydration (on mount)
│  └─ Log initial DB → State conversion
│
├─ useEffect: Track state changes (on formData change)
│  └─ Update inputDisplayedArea & stateArea
│
├─ handleSave: Track save flow
│  ├─ Log state → payload conversion
│  ├─ Update payloadArea
│  ├─ Execute save
│  ├─ Read back from DB
│  ├─ Update dbArea
│  └─ Log verification results
│
└─ Trace Inspector UI (DEV only)
   ├─ 5 value displays
   ├─ 4 comparison badges
   └─ Version/fingerprint header
```

### Data Flow Tracking

```
┌─────────────────────────────────────────────────────────────┐
│ MOUNT: moduleInstance.data → safeBuildings → formData       │
│   Track: hydratedArea = raw DB value                        │
│          stateArea = converted string value                 │
└─────────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│ EDIT: User types → onChange → updateBuilding → setFormData  │
│   Track: inputDisplayedArea = what user sees                │
│          stateArea = what's in formData                     │
└─────────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│ SAVE: formData → normalize → payload → supabase.update      │
│   Track: payloadArea = normalized number value              │
│   Generate: fingerprint, version                            │
└─────────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│ VERIFY: supabase.select → check read-back                   │
│   Track: dbArea = value from database                       │
│   Compare: payloadArea === dbArea                           │
└─────────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│ REFRESH: Unmount → Mount → moduleInstance.data → formData   │
│   Compare: dbArea === hydratedArea                          │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Success Criteria

The trace inspector is working correctly when:

1. ✅ **UI displays** at top of RE-02 page (DEV mode)
2. ✅ **All 5 values** update in real-time
3. ✅ **Status badges** show comparisons between hops
4. ✅ **Console logs** show detailed data at each stage
5. ✅ **Read-back verification** runs automatically after save
6. ✅ **Fingerprint tracking** creates unique IDs per save
7. ✅ **Version counter** increments with each save
8. ✅ **Production build** excludes all debug code

---

## 🎯 Next Steps

### After Identifying Break Point

1. **Locate the exact code** causing the break
2. **Apply the fix** from the debugging guide
3. **Verify with trace inspector**:
   - All badges should be green
   - Console shows no errors
   - Values persist after save/refresh

4. **Test thoroughly**:
   - Type various values (with/without commas)
   - Save multiple times
   - Refresh page
   - Navigate away and back
   - Close and reopen browser

5. **Remove trace inspector** (optional):
   - Keep behind DEV flag for future debugging
   - Or remove entirely if confident in fix

---

## 📚 Related Documentation

- RE02_NUMERIC_FIELDS_STABILITY_FIX_COMPLETE.md - Initial stability fix
- modulePayloadSanitizer.ts - Sanitization logic (check if interfering)
- src/lib/supabase.ts - Database client configuration

---

**Status:** ✅ Trace inspector fully implemented and ready for testing
**Build:** ✅ Successful (no TypeScript errors)
**Next:** Use trace inspector to identify exact breaking point, then apply fix
