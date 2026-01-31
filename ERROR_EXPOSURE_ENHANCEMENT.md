# Error Exposure Enhancement

## Problem

RE (Risk Engineering / Property Survey) creation was failing silently. Errors were being caught but:
- Only generic messages shown to users: "Failed to create assessment. Please try again."
- Error details not visible in console
- No payload logging to debug issues
- Difficult to diagnose root cause (constraint violations, RLS issues, missing fields, etc.)

## Solution

Enhanced error handling and logging across the document creation flow to expose **actual** error details.

## Changes Implemented

### 1. Enhanced NewAssessmentPage Error Handling

**File:** `src/pages/ezirisk/NewAssessmentPage.tsx`

#### Added Payload Logging (lines 108-159)

For each assessment type (FRA, FSD, DSEAR, Property), now logs the payload before creation:

```typescript
// Example for Property Survey (RE)
const payload = {
  userId: user.id,
  companyName: 'New Client',
};
console.log('[NewAssessment] Creating Property Survey (RE) with payload:', payload);
const documentId = await createPropertySurvey(payload.userId, payload.companyName);
```

**Logs payloads for:**
- FRA: `{ organisationId, documentType: 'FRA', title }`
- FSD: `{ organisationId, documentType: 'FSD', title }`
- DSEAR: `{ organisationId, documentType: 'DSEAR', title }`
- **Property (RE)**: `{ userId, companyName }`

#### Enhanced Error Display (lines 160-176)

```typescript
} catch (error) {
  console.error('[NewAssessment] ERROR creating assessment:', error);
  console.error('[NewAssessment] Error details:', {
    name: error instanceof Error ? error.name : 'Unknown',
    message: error instanceof Error ? error.message : String(error),
    cause: error instanceof Error ? error.cause : undefined,
    stack: error instanceof Error ? error.stack : undefined,
    full: error,
  });

  // Show actual error to user
  const errorMessage = error instanceof Error ? error.message : String(error);
  const displayMessage = `Failed to create assessment: ${errorMessage}`;

  alert(displayMessage);  // Now shows REAL error message
  setCreatingType(null);
}
```

**Benefits:**
- Console shows full error object with all properties
- User sees actual error message (not generic text)
- Stack trace captured for debugging
- Error name and cause logged

### 2. Enhanced Document Creation Error Logging

**File:** `src/utils/documentCreation.ts`

#### createDocument() Function

**Payload Logging (line 72):**
```typescript
console.log('[documentCreation.createDocument] Insert payload:', documentData);
```

**Enhanced Error Details (lines 80-87):**
```typescript
if (docError) {
  console.error('[documentCreation.createDocument] Insert failed:', docError);
  console.error('[documentCreation.createDocument] Error details:', {
    code: docError.code,           // Supabase error code
    message: docError.message,     // Error message
    details: docError.details,     // Additional details
    hint: docError.hint,           // Postgres hint
    full: docError,                // Full error object
  });
  throw docError;
}
```

#### createPropertySurvey() Function

**Payload Logging (lines 132-149):**
```typescript
const insertPayload = {
  user_id: userId,
  framework_type: 'fire_property',
  survey_type: 'Full',
  report_status: 'Draft',
  property_name: 'Untitled Survey',
  property_address: '',
  company_name: companyName,
  survey_date: surveyDate,
  issued: false,
  form_data: { companyName, surveyDate, reportStatus: 'Draft' },
};

console.log('[documentCreation.createPropertySurvey] Insert payload:', insertPayload);
```

**Enhanced Error Details (lines 157-162):**
```typescript
if (error) {
  console.error('[documentCreation.createPropertySurvey] Insert failed:', error);
  console.error('[documentCreation.createPropertySurvey] Error details:', {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    full: error,
  });
  throw error;
}
```

## Console Output Examples

### Success Case (Property Survey / RE)
```
[NewAssessment] Creating Property Survey (RE) with payload: { userId: "...", companyName: "New Client" }
[documentCreation.createPropertySurvey] Insert payload: { user_id: "...", framework_type: "fire_property", ... }
[documentCreation.createPropertySurvey] Created survey: abc-123-def
[NewAssessment] Created property survey: abc-123-def
```

### Error Case - RLS Violation
```
[NewAssessment] Creating Property Survey (RE) with payload: { userId: "...", companyName: "New Client" }
[documentCreation.createPropertySurvey] Insert payload: { user_id: "...", framework_type: "fire_property", ... }
[documentCreation.createPropertySurvey] Insert failed: { code: "42501", message: "new row violates row-level security policy", ... }
[documentCreation.createPropertySurvey] Error details: {
  code: "42501",
  message: "new row violates row-level security policy for table \"survey_reports\"",
  details: "...",
  hint: "...",
  full: {...}
}
[NewAssessment] ERROR creating assessment: PostgresError: new row violates row-level security policy
[NewAssessment] Error details: { name: "PostgresError", message: "new row violates...", stack: "..." }

User sees alert: "Failed to create assessment: new row violates row-level security policy for table "survey_reports""
```

### Error Case - Missing Field / Constraint Violation
```
[NewAssessment] Creating FRA with payload: { organisationId: "...", documentType: "FRA", title: "..." }
[documentCreation.createDocument] Insert payload: { organisation_id: "...", document_type: "FRA", ... }
[documentCreation.createDocument] Insert failed: { code: "23502", message: "null value in column violates not-null constraint", ... }
[documentCreation.createDocument] Error details: {
  code: "23502",
  message: "null value in column \"required_field\" violates not-null constraint",
  details: "Failing row contains (...).",
  hint: null,
  full: {...}
}
[NewAssessment] ERROR creating assessment: PostgresError: null value in column "required_field" violates not-null constraint
[NewAssessment] Error details: { name: "PostgresError", message: "null value...", stack: "..." }

User sees alert: "Failed to create assessment: null value in column "required_field" violates not-null constraint"
```

### Error Case - Invalid Enum Value
```
[documentCreation.createDocument] Insert payload: { organisation_id: "...", document_type: "RE", ... }
[documentCreation.createDocument] Insert failed: { code: "22P02", message: "invalid input value for enum", ... }
[documentCreation.createDocument] Error details: {
  code: "22P02",
  message: "invalid input value for enum document_type: \"RE\"",
  details: null,
  hint: null,
  full: {...}
}

User sees alert: "Failed to create assessment: invalid input value for enum document_type: \"RE\""
```

## Error Information Exposed

### Supabase Error Properties Logged
- ✅ **code**: PostgreSQL error code (23502, 42501, 22P02, etc.)
- ✅ **message**: Human-readable error message
- ✅ **details**: Additional error context (e.g., failing row)
- ✅ **hint**: PostgreSQL hint for fixing the error
- ✅ **full**: Complete error object with all properties

### Application Error Properties Logged
- ✅ **name**: Error constructor name
- ✅ **message**: Error message
- ✅ **cause**: Error cause (if chained)
- ✅ **stack**: Stack trace
- ✅ **full**: Complete error object

### Payload Information Logged
- ✅ Function input parameters (userId, organisationId, etc.)
- ✅ Database insert payload (all fields being inserted)
- ✅ Document type being created
- ✅ Timing of operations

## Diagnostic Benefits

### For RLS Issues
Console will show:
- Exact payload being inserted
- User ID being used
- Organisation ID being used
- Supabase error code 42501
- Exact table and policy name failing

### For Constraint Violations
Console will show:
- Exact field that's null/invalid
- Expected vs actual value
- Failing row contents
- Constraint name

### For Enum Issues
Console will show:
- Invalid enum value attempted
- Enum type name
- Valid enum values (in hint if available)

### For Missing Fields
Console will show:
- Exact field(s) missing
- NOT NULL constraint name
- Table name

## Files Modified

1. **src/pages/ezirisk/NewAssessmentPage.tsx**
   - Added payload logging for all document types (lines 108-159)
   - Enhanced error logging with full details (lines 160-176)
   - User now sees actual error messages in alerts

2. **src/utils/documentCreation.ts**
   - Added payload logging for createDocument() (line 72)
   - Added detailed Supabase error logging (lines 80-87)
   - Added payload logging for createPropertySurvey() (lines 132-149)
   - Added detailed Supabase error logging (lines 157-162)

## Build Status

```
✅ TypeScript compilation successful
✅ No errors or warnings
✅ Production build verified
```

## Acceptance Criteria Met

✅ **When RE creation fails, UI shows the real reason**
   - Alert displays actual Supabase error message
   - Not generic "Failed to create assessment" text

✅ **Console shows full error from Supabase**
   - Error code logged
   - Error message logged
   - Error details logged
   - Error hint logged
   - Full error object logged

✅ **Payload logging for debugging**
   - Function inputs logged before call
   - Database insert payload logged
   - Success confirmed with IDs

✅ **Comprehensive error details**
   - Name, message, cause, stack logged
   - User sees meaningful error text
   - Developers can diagnose from console

## Testing Scenarios

### Test 1: RLS Policy Failure
**Trigger:** Create document with insufficient permissions
**Expected Console:**
- Payload logged
- Supabase error code 42501
- RLS policy name
- Table name
**Expected UI:**
- Alert with RLS error message

### Test 2: Missing Required Field
**Trigger:** Create document with NULL in NOT NULL column
**Expected Console:**
- Payload logged (shows NULL field)
- Supabase error code 23502
- Column name
- Constraint name
**Expected UI:**
- Alert with constraint violation message

### Test 3: Invalid Enum
**Trigger:** Use document_type = 'RE' (if not valid enum)
**Expected Console:**
- Payload logged (shows 'RE')
- Supabase error code 22P02
- Enum type name
- Invalid value
**Expected UI:**
- Alert with enum error message

### Test 4: Success
**Trigger:** Create valid document
**Expected Console:**
- Payload logged
- Success confirmation with ID
**Expected UI:**
- Navigation to workspace/report

## Next Steps for Debugging RE Creation

With these enhancements, when RE creation fails you'll see:

1. **Exact payload being sent** to Supabase
2. **Exact Supabase error** with code and details
3. **User-visible error** in alert dialog
4. **Full error object** in console for inspection

This makes it trivial to identify:
- RLS policy issues
- Missing foreign keys
- Constraint violations
- Enum mismatches
- Field validation errors
- Permission problems
