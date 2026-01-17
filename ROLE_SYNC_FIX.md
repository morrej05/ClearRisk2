# Role Synchronization Fix

## Problem Summary

The database showed **james.morrell1@gmail.com** as `super_admin`, but the UI continued to show `surveyor` after sign out/sign in. The role was not being properly synchronized between the database and the application state.

## Root Causes Identified

1. **Silent Fallback to 'surveyor'**: The `AuthContext` had multiple fallback paths that defaulted to 'surveyor' on any error or timeout, masking the real issues
2. **Timeout Logic**: A 5-second timeout would force role to 'surveyor' even if the database query was still processing
3. **Error Suppression**: Errors were logged to console but not surfaced to the user
4. **No Debugging Tools**: No way to verify what the database actually returned vs what the UI state contained

## Changes Made

### 1. AuthContext Improvements (`src/contexts/AuthContext.tsx`)

**Removed:**
- Silent fallback to 'surveyor' on errors (lines 68-69, 79)
- Timeout mechanism that forced 'surveyor' role
- Logic that created new profiles (handled by DB trigger)

**Added:**
- `roleError` state to track and expose errors
- Comprehensive logging with `[AuthContext]` prefix for easy debugging
- Proper error messages shown to users
- Clear distinction between "no profile found" vs "database error"
- Better auth state change handling with role clearing on sign out

**Key Changes:**
```typescript
// Before: Silent fallback
setUserRole('surveyor');

// After: Expose error
setRoleError(errorMsg);
setUserRole(null);
```

### 2. Role Debug Widget (`src/components/RoleDebugWidget.tsx`)

Created a comprehensive debug interface that shows:

- **Auth User**: Current authenticated user ID and email
- **Context State**: Role value from React context
- **Database Query**: Live query result directly from `user_profiles` table
- **Status**: Visual comparison showing if roles match
- **Errors**: Both context errors and database query errors
- **Troubleshooting Tips**: Actionable steps to resolve issues

**Access:**
- Automatically shown to super_admins
- Shown when there's a role error
- Can be enabled with `?debug=true` query parameter

### 3. Dashboard Error Handling (`src/pages/Dashboard.tsx`)

**Added:**
- Error banner when `roleError` is present
- Automatic debug widget display for super_admins
- Role display shows "Error" instead of "Loading..." when there's an error
- Red highlighting of role text when error is present

**Display Logic:**
```typescript
Role: {userRole ? ROLE_LABELS[userRole] : roleError ? 'Error' : 'Loading...'}
```

### 4. User Role Management (`src/components/UserRoleManagement.tsx`)

Already created in previous task - allows super_admins to:
- View all users and their roles
- Change user roles via dropdown
- Requires confirmation for super_admin grants
- Real-time updates with success/error feedback

## Verification Steps

### Step 1: Sign Out and Sign In
```bash
1. Navigate to dashboard
2. Click "Log out"
3. Sign back in with james.morrell1@gmail.com
4. Check header - should show "Role: Super Admin"
```

### Step 2: Check Browser Console
Open Developer Tools (F12) → Console tab

Look for logs:
```
[AuthContext] Initializing auth state...
[AuthContext] Initial session: james.morrell1@gmail.com
[AuthContext] Fetching role for user: 0f5bdca3-d893-4204-8343-527be02a5e17 james.morrell1@gmail.com
[AuthContext] Profile fetch result: { profile: { role: 'super_admin' }, error: null }
[AuthContext] Successfully fetched role: super_admin
```

### Step 3: Verify Super Admin Access
```bash
1. Dashboard should show "Super Admin" button in header
2. Click "Super Admin" button
3. Should navigate to /super-admin successfully
4. Should see Sector Weightings and User Management options
```

### Step 4: Check Debug Widget
```bash
1. As super_admin, dashboard automatically shows debug widget
2. Alternatively, add ?debug=true to URL
3. Widget should show:
   - Context State: super_admin ✓ Loaded
   - Database Query: super_admin ✓ Found
   - Status: "Roles Match" (green)
```

### Step 5: Database Verification
```sql
SELECT
  au.email,
  up.role,
  up.name
FROM auth.users au
JOIN user_profiles up ON au.id = up.id
WHERE au.email = 'james.morrell1@gmail.com';
```

Expected result:
```
email                    | role        | name
------------------------|-------------|----------------------
james.morrell1@gmail.com | super_admin | james.morrell1@gmail.com
```

## RLS Policies Verified

The following policies allow users to read their own role:

1. **"Users can read own profile"**
   - Type: SELECT
   - Condition: `auth.uid() = id`
   - Allows any user to read their own profile

2. **"Super admins can read all profiles"**
   - Type: SELECT
   - Condition: User has super_admin role
   - Allows super_admins to read all profiles

These policies were confirmed to be correctly configured.

## Troubleshooting

### If Role Still Shows "Error" or Wrong Value

1. **Check Browser Console** (F12 → Console)
   - Look for `[AuthContext]` prefixed logs
   - Check for error messages with details

2. **Use Debug Widget**
   - Add `?debug=true` to dashboard URL
   - Compare "Context State" vs "Database Query"
   - If DB shows correct role but context doesn't, refresh page
   - If DB shows wrong role, update database directly

3. **Clear Browser State**
   ```bash
   # Clear browser cache and cookies for the site
   # Sign out and sign back in
   ```

4. **Verify Database**
   ```sql
   -- Check current role
   SELECT up.role, au.email
   FROM user_profiles up
   JOIN auth.users au ON au.id = up.id
   WHERE au.email = 'james.morrell1@gmail.com';

   -- Update if needed
   UPDATE user_profiles
   SET role = 'super_admin'
   WHERE id = (
     SELECT au.id FROM auth.users au
     WHERE au.email = 'james.morrell1@gmail.com'
   );
   ```

5. **Check RLS Policies**
   ```sql
   SELECT policyname, cmd, qual
   FROM pg_policies
   WHERE tablename = 'user_profiles'
   AND cmd = 'SELECT'
   AND policyname LIKE '%own%';
   ```

## Expected Behavior After Fix

✅ **Database**: james.morrell1@gmail.com has role `super_admin`
✅ **Header**: Shows "Role: Super Admin"
✅ **Navigation**: "Super Admin" button visible and functional
✅ **Access**: Can access `/super-admin` route
✅ **Features**: Can edit sector weightings and manage user roles
✅ **Debug**: Widget shows matching roles
✅ **Console**: Clean logs with successful role fetch
✅ **Errors**: Visible error banner if role fails to load

## Technical Details

### Auth Flow
1. User signs in → `supabase.auth.signInWithPassword()`
2. Auth state changes → `onAuthStateChange` fires
3. Fetch role → Query `user_profiles` table
4. Update state → `setUserRole(role)`, `setRoleError(null)`
5. UI updates → Header, navigation, permissions

### Error Flow
1. Role fetch fails → Database error or RLS issue
2. Error captured → `setRoleError(errorMsg)`, `setUserRole(null)`
3. UI shows error → Banner + "Role: Error" in header
4. Debug widget → Shows detailed error information
5. User notified → Clear actionable message

### No More Silent Failures
- All errors are visible to the user
- Console logs provide detailed debugging info
- Debug widget allows real-time verification
- No automatic fallback to incorrect roles
