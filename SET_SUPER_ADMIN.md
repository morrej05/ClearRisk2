# Super Admin Management

## Current Status

✅ **james.morrell1@gmail.com** has been promoted to super_admin

Your account now has full platform access with super_admin privileges.

## Access Super Admin Dashboard

After signing in, you should now see:
- ✅ Role: super_admin in the header
- ✅ "Super Admin" button in the dashboard navigation
- ✅ Access to `/super-admin` route

### Super Admin Features

The Super Admin dashboard includes:

1. **Sector Weightings** - Configure industry-specific risk weightings
2. **User Management** - View and manage user roles across the platform
3. **Recommendation Library** (Coming Soon) - Manage standardized recommendations
4. **Pricing & Plans** (Coming Soon) - Configure subscription settings

## User Role Management

As a super_admin, you can now manage user roles through the UI:

1. Navigate to `/super-admin`
2. Click "User Management" in the sidebar
3. View all users with their current roles
4. Change roles using the dropdown:
   - **Super Admin**: Full platform access (use carefully!)
   - **Org Admin**: Can manage users and all surveys
   - **Surveyor**: Can create and edit own surveys only

### Security Notes

- Super admin role should be granted sparingly
- Org admins have broad access within the organization
- Role changes are immediate and require user to refresh

## Manual Database Commands (If Needed)

### Check All Users and Roles

```sql
SELECT
  au.email,
  up.role,
  up.name,
  up.created_at
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
ORDER BY up.created_at ASC;
```

### Promote Another User to Super Admin

```sql
UPDATE user_profiles
SET role = 'super_admin'
WHERE id = (
  SELECT au.id FROM auth.users au
  WHERE au.email = 'user@example.com'
);
```

### Demote from Super Admin

```sql
UPDATE user_profiles
SET role = 'org_admin'
WHERE id = (
  SELECT au.id FROM auth.users au
  WHERE au.email = 'user@example.com'
);
```

## Troubleshooting

If you don't see super_admin features:

1. **Sign out and sign back in** - Role is cached during session
2. Check browser console (F12 → Console) for errors
3. Verify your role in the database:
   ```sql
   SELECT up.role, au.email
   FROM user_profiles up
   JOIN auth.users au ON au.id = up.id
   WHERE au.email = 'james.morrell1@gmail.com';
   ```
4. Check RLS policies are allowing self-read:
   ```sql
   SELECT policyname, cmd
   FROM pg_policies
   WHERE tablename = 'user_profiles'
   AND policyname LIKE '%own%';
   ```
