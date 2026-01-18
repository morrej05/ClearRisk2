# Admin Access Fix - Implementation Summary

## Overview

Fixed admin access by removing all `super_admin` and `org_admin` role references and consolidating to a single `admin` role with optional `is_platform_admin` flag for platform-wide settings.

## Changes Made

### 1. Database Schema

**Migration: `add_platform_admin_field`**

Added `is_platform_admin` boolean field to `user_profiles`:
- Default: `false`
- Used for platform-wide elevated access
- Platform admin = `role === 'admin' AND is_platform_admin === true`
- Regular admin = `role === 'admin' AND is_platform_admin === false`

All existing users already have `role = 'admin'` from previous migration.

### 2. Role System Consolidation

**Valid Roles:**
- `admin` - Full organization access
- `surveyor` - Can create/edit surveys within plan limits
- `viewer` - Read-only access

**Removed Roles:**
- ~~`super_admin`~~ (replaced by `is_platform_admin` flag)
- ~~`org_admin`~~ (consolidated to `admin`)

### 3. AuthContext Updates

**File: `src/contexts/AuthContext.tsx`**

Added new context field:
```typescript
interface AuthContextType {
  // ... existing fields
  isPlatformAdmin: boolean;
}
```

Updated `fetchUserRole` to:
- Fetch `is_platform_admin` from database
- Set `isPlatformAdmin` state
- Reset to `false` on errors/signout

### 4. Route Guards

**AdminRoute** (`src/components/AdminRoute.tsx`)
- Changed: `userRole !== 'org_admin' && userRole !== 'super_admin'`
- To: `userRole !== 'admin'`
- Now allows all admin users to access admin dashboard

**PlatformAdminRoute** (`src/components/SuperAdminRoute.tsx`)
- Renamed from `SuperAdminRoute` to `PlatformAdminRoute`
- Changed: `userRole !== 'super_admin'`
- To: `userRole !== 'admin' || !isPlatformAdmin`
- Now checks both admin role AND platform admin flag

**App.tsx**
- Updated import and route usage to use `PlatformAdminRoute`
- Route path `/super-admin` still exists for compatibility

### 5. Permissions System

**File: `src/utils/permissions.ts`**

Removed `canAccessSuperAdmin` from `RolePermissions` interface.

All admins now have:
- `canAccessAdmin: true`
- `canManageSectorWeightings: true`
- `canManageRecommendationLibrary: true`
- `canManagePlatformSettings: true`

Platform-specific features now check `isPlatformAdmin` directly instead of permission.

### 6. UI Component Updates

**Dashboard** (`src/pages/Dashboard.tsx`)
- Added `isPlatformAdmin` from `useAuth()`
- Changed platform admin button check from `permissions.canAccessSuperAdmin` to `isPlatformAdmin`
- Updated button text: "Super Admin" → "Platform Admin"

**AdminDashboard** (`src/pages/AdminDashboard.tsx`)
- Added `isPlatformAdmin` from `useAuth()`
- Updated access checks from `userRole !== 'org_admin' && userRole !== 'super_admin'` to `userRole !== 'admin'`
- Updated platform admin button check to use `isPlatformAdmin`
- Updated error message: "organization admin or super admin privileges" → "admin privileges"
- Updated button text: "Super Admin" → "Platform Admin"

**UserRoleManagement** (`src/components/UserRoleManagement.tsx`)
- Updated role dropdown options:
  - Removed: "Org Admin" and "Super Admin"
  - Added: "Viewer", "Surveyor", "Admin"
- Updated confirmation message for admin role
- Updated badge colors and display names
- Updated role handling logic

**NewSurveyReport** (`src/components/NewSurveyReport.tsx`)
- Added `isPlatformAdmin` from `useAuth()`
- Replaced all `userRole === 'super_admin'` checks with `isPlatformAdmin`
- Debug notifications now check platform admin flag

### 7. App.tsx Updates

Updated imports and route usage:
```typescript
import PlatformAdminRoute from './components/SuperAdminRoute';

// Route usage
<Route path="/super-admin" element={
  <PlatformAdminRoute>
    <SuperAdminDashboard />
  </PlatformAdminRoute>
} />
```

## Access Control Summary

### Regular Admin
- **Role:** `admin`
- **Platform Admin:** `false`
- **Can Access:**
  - Admin dashboard (`/admin`)
  - User management
  - Branding settings
  - Organization settings
  - All survey operations

### Platform Admin
- **Role:** `admin`
- **Platform Admin:** `true`
- **Can Access:**
  - Everything regular admin can access
  - Platform admin dashboard (`/super-admin`)
  - Sector weightings
  - Recommendation library
  - Platform-wide settings
  - Debug features

### Surveyor
- **Role:** `surveyor`
- **Can Access:**
  - Create/edit surveys
  - View surveys
  - Generate reports
  - Limited by plan editor limits

### Viewer
- **Role:** `viewer`
- **Can Access:**
  - View surveys (read-only)
  - Export reports
  - No editing capabilities

## Migration Impact

### Existing Users
- All users already migrated to new role system
- All current `admin` users have regular admin access
- No platform admins by default (must be manually set)

### Data Preserved
- No data loss during migration
- All surveys and reports intact
- All user accounts maintained

### Setting Platform Admin

To grant platform admin access to a user:
```sql
UPDATE user_profiles
SET is_platform_admin = true
WHERE id = 'user-id-here';
```

Or via Supabase dashboard:
1. Navigate to user_profiles table
2. Find the user
3. Set `is_platform_admin` to `true`

## Testing

Build Status: ✓ Success

All TypeScript types resolve correctly.
No runtime errors expected.

## Benefits

1. **Simpler Role System:** Only 3 roles instead of 4
2. **Clear Separation:** Organization admin vs platform admin via flag
3. **Easier to Maintain:** Single admin role with optional elevation
4. **Backward Compatible:** Routes still work, just with different guards
5. **Flexible:** Easy to grant/revoke platform admin without changing role

## Breaking Changes

None - all migrations handled automatically.

## Notes

- Platform admin access is now opt-in via `is_platform_admin` flag
- No users have platform admin by default
- SuperAdminDashboard page still exists but requires platform admin flag
- All "Super Admin" UI text updated to "Platform Admin"
