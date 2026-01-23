# Admin Link Fix - Unified User Object

## Problem
The Admin and Platform links were not appearing in the navigation because the `user` object from AuthContext only contained Supabase auth fields (id, email, etc.) but not the profile fields (role, is_platform_admin, can_edit, organisation_id) that the entitlement functions needed.

## Solution
Modified AuthContext to create an enriched `AppUser` object that merges both auth data and profile data into a single unified user object.

## Changes Made

### 1. AuthContext.tsx
- Added `AppUser` interface that extends `User` with profile fields
- Created `createAppUser()` helper function to merge auth + profile data
- Updated `fetchUserRole()` to accept the auth user and set enriched user object
- Modified initial session load and auth state change handlers to use enriched user
- All components now receive a single unified user object with all necessary fields

### 2. PrimaryNavigation.tsx
- Added DEV-only debug badge showing `role` and `is_platform_admin` values
- Existing conditional logic now works correctly with enriched user object

### 3. AdminRoute.tsx
- No changes needed - already uses `userRole` from context correctly

## Result
- Organization admins now see the "Admin" link
- Platform admins now see the "Platform" link
- Regular users see neither link
- All routing and authorization works correctly
- Dev badge confirms user object has correct profile fields

## Testing
1. Reload /dashboard
2. Dev badge shows: `role: admin · platform: true` (or false)
3. Admin users see Admin link
4. Platform admins see Platform link
5. Links navigate correctly to /admin and /platform
