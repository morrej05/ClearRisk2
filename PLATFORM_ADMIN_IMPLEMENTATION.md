# Platform Admin Implementation

## Overview

Platform Admin functionality has been fully implemented to restore "super admin" access capabilities without introducing a new role. The system uses an `is_platform_admin` boolean flag on users with the `admin` role to provide elevated platform-wide access.

## Role System

**Valid Roles:**
- `admin` - Full organization access
- `surveyor` - Can create/edit surveys within plan limits
- `viewer` - Read-only access

**Platform Admin:**
- Role: `admin`
- Flag: `is_platform_admin = true`
- Access: Organization admin + platform-wide settings

## Features Implemented

### 1. Bootstrap Safety

**Migration: `bootstrap_platform_admin`**

Created automatic bootstrap functionality to ensure at least one platform admin always exists:

**Function:** `ensure_platform_admin_exists()`
- Checks if any platform admins exist
- If none found, promotes the earliest-created admin user
- Idempotent - safe to run multiple times
- Returns boolean indicating if bootstrap was needed

**Trigger:** `ensure_platform_admin_trigger`
- Automatically runs after admin user role changes
- Prevents organization from being locked out
- Ensures we never have zero platform admins

**Initial Bootstrap:**
- Migration automatically runs bootstrap function on creation
- First admin user is promoted to platform admin if needed

### 2. Security & RLS

**Migration: `add_platform_admin_rls`**

**Policy:** "Platform admins can update platform admin status"
- Only platform admins can update `is_platform_admin` field
- All authenticated users can read their own `is_platform_admin` status
- Prevents non-platform admins from elevating themselves

**Security Features:**
- RLS prevents unauthorized updates to platform admin status
- AuthContext fetches `is_platform_admin` for all users
- Bootstrap trigger runs with SECURITY DEFINER (elevated privileges)

### 3. User Management UI

**File: `src/components/UserManagement.tsx`**

**Platform Admin Column:**
- Only visible to current platform admins
- Shows checkbox toggle for admin users
- Shows "—" for non-admin users (surveyor/viewer)
- Real-time updates on toggle

**Protection Logic:**
- Prevents removing platform admin from last remaining platform admin
- Shows alert: "At least one Platform Admin is required"
- Cannot lock organization out of platform settings

**Updated Features:**
- Updated `UserProfile` interface to include `is_platform_admin`
- Added `handleTogglePlatformAdmin()` function
- Fixed role dropdowns to use correct roles (admin/surveyor/viewer)
- Updated role badge colors

### 4. UI Indicators

**Dashboard** (`src/pages/Dashboard.tsx`)
- Shows "Platform Admin" badge next to role
- Badge only visible to platform admins
- Updated button text: "Platform Settings" (was "Platform Admin")

**Admin Dashboard** (`src/pages/AdminDashboard.tsx`)
- Shows "Platform Admin" status badge in header
- Badge only visible to platform admins
- Updated button text: "Platform Settings"
- Clear visual indicator of elevated access

**Visual Design:**
- Subtle gray badge with border
- Shield icon for consistency
- Positioned near user email and role

### 5. AuthContext Integration

**File: `src/contexts/AuthContext.tsx`**

Updated to fetch and manage `isPlatformAdmin`:
- Added `isPlatformAdmin: boolean` to context interface
- Fetches `is_platform_admin` from database on login
- Resets to `false` on logout/errors
- Available throughout app via `useAuth()`

## Access Control

### Regular Admin
**Access:**
- Admin dashboard (`/admin`)
- User management (view/edit roles)
- Branding settings
- Organization settings
- All survey operations

**Cannot Access:**
- Platform admin settings (`/super-admin`)
- Sector weightings management
- Recommendation library management
- Platform-wide settings
- Cannot see/edit Platform Admin toggles

### Platform Admin
**Access:**
- Everything regular admin can access, PLUS:
- Platform admin dashboard (`/super-admin`)
- Sector weightings management
- Recommendation library management
- Platform-wide settings
- Can grant/revoke platform admin status
- Debug features in survey forms

**Responsibilities:**
- Manage platform-wide settings
- Grant platform admin access to other admins
- Cannot remove last platform admin (protected)

## User Journey

### Granting Platform Admin Access

1. **Current platform admin logs in**
   - Sees "Platform Admin" badge in header
   - Has access to Admin Dashboard

2. **Navigate to Admin Dashboard**
   - Click "Admin" button in dashboard

3. **Go to User Management tab**
   - Click "Users" tab

4. **Find admin user to promote**
   - Locate user with "Admin" role
   - See "Platform Admin" column (only visible to platform admins)

5. **Toggle Platform Admin**
   - Check the checkbox next to the user
   - User immediately gets platform admin access
   - User will see platform admin features on next page load

### Bootstrap Scenario

**If no platform admins exist:**
1. Database automatically promotes earliest-created admin
2. That admin sees "Platform Admin" badge on login
3. Can now grant platform admin to others

**Trigger ensures:**
- Never zero platform admins
- Automatic recovery if last admin is removed
- Organization cannot be locked out

## Database Schema

**Table: `user_profiles`**

```sql
-- New field
is_platform_admin BOOLEAN DEFAULT false

-- Index for fast lookups
CREATE INDEX idx_user_profiles_is_platform_admin
ON user_profiles(is_platform_admin)
WHERE is_platform_admin = true;
```

**Functions:**
- `ensure_platform_admin_exists()` - Bootstrap safety
- `trigger_ensure_platform_admin()` - Automatic trigger

**Triggers:**
- `ensure_platform_admin_trigger` - Runs after UPDATE/DELETE

## Migration History

1. `add_platform_admin_field` - Added `is_platform_admin` boolean field
2. `bootstrap_platform_admin` - Added bootstrap function and trigger
3. `add_platform_admin_rls` - Added RLS policies for security

## Testing Checklist

- [x] Build completes without errors
- [x] Bootstrap function creates first platform admin
- [x] Platform admin toggle only visible to platform admins
- [x] Cannot remove last platform admin
- [x] RLS prevents non-platform admins from elevating themselves
- [x] Platform admin badge shows correctly
- [x] Platform settings button only shows for platform admins
- [x] AuthContext correctly fetches `is_platform_admin`

## Setting Platform Admin Manually

Via SQL:
```sql
-- Grant platform admin
UPDATE user_profiles
SET is_platform_admin = true
WHERE id = 'user-id-here';

-- Revoke platform admin (if not last one)
UPDATE user_profiles
SET is_platform_admin = false
WHERE id = 'user-id-here';

-- Check platform admin count
SELECT COUNT(*) FROM user_profiles
WHERE is_platform_admin = true;

-- List all platform admins
SELECT id, name, role, is_platform_admin, created_at
FROM user_profiles
WHERE is_platform_admin = true
ORDER BY created_at;
```

Via Supabase Dashboard:
1. Navigate to user_profiles table
2. Find the user
3. Edit the `is_platform_admin` field
4. Set to `true` or `false`
5. Save

## Benefits

1. **No Lockout Risk:** Bootstrap ensures at least one platform admin always exists
2. **Secure:** RLS prevents unauthorized elevation
3. **Self-Service:** Platform admins can grant access via UI
4. **Clear Indicators:** Users always know their access level
5. **Flexible:** Easy to grant/revoke without changing roles
6. **No New Role:** Uses existing admin role with flag
7. **Protected:** Cannot remove last platform admin

## Future Enhancements

Potential improvements for future versions:

1. **Audit Log:** Track platform admin grants/revocations
2. **Email Notifications:** Notify users when granted platform admin
3. **Multi-Level Admin:** Different platform admin permission levels
4. **Time-Limited Access:** Temporary platform admin access
5. **Approval Workflow:** Require approval to grant platform admin

## Troubleshooting

### No Platform Admins Visible

**Problem:** User doesn't see Platform Admin column
**Solution:** Only platform admins see this column. Grant yourself platform admin via SQL first.

### Cannot Update Platform Admin Status

**Problem:** Error when toggling platform admin
**Solution:**
1. Check RLS policies are applied
2. Verify current user has `is_platform_admin = true`
3. Check database connection

### Bootstrap Didn't Run

**Problem:** No platform admin after migration
**Solution:**
```sql
-- Manually run bootstrap
SELECT ensure_platform_admin_exists();

-- If still no platform admin, manually set
UPDATE user_profiles
SET is_platform_admin = true
WHERE role = 'admin'
ORDER BY created_at
LIMIT 1;
```

### Last Platform Admin Protection Not Working

**Problem:** Can remove last platform admin
**Solution:**
1. Check trigger is installed: `SELECT * FROM pg_trigger WHERE tgname = 'ensure_platform_admin_trigger';`
2. Manually re-run bootstrap migration

## Notes

- Platform admin status only applies to users with `role = 'admin'`
- Surveyors and viewers cannot be platform admins
- Changing admin to surveyor/viewer automatically revokes platform admin
- Bootstrap trigger handles this automatically
- UI toggle only shows for admin users

## Documentation

All changes documented in:
- `ADMIN_ACCESS_FIX.md` - Previous admin consolidation
- `PLATFORM_ADMIN_IMPLEMENTATION.md` - This document
- Migration files with detailed comments
- Inline code comments
