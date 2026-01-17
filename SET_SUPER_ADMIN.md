# Set Super Admin Role

Use these SQL commands to check and set your account as a super_admin.

## Step 1: Check current users and their roles

Run this query to see all users and their current roles:

```sql
SELECT
  id,
  email,
  role,
  created_at
FROM user_profiles
ORDER BY created_at ASC;
```

## Step 2: Set your account as super_admin

Replace `YOUR_EMAIL_HERE` with your actual email address:

```sql
UPDATE user_profiles
SET role = 'super_admin'
WHERE email = 'YOUR_EMAIL_HERE';
```

## Step 3: Verify the change

Run this to confirm your role was updated:

```sql
SELECT email, role
FROM user_profiles
WHERE email = 'YOUR_EMAIL_HERE';
```

## Alternative: Set the first user as super_admin

If you want to make the first created user a super_admin:

```sql
UPDATE user_profiles
SET role = 'super_admin'
WHERE id = (
  SELECT id FROM user_profiles
  ORDER BY created_at ASC
  LIMIT 1
);
```

## Verify super_admin access

After setting the role, sign out and sign back in. You should now see:
- Role displays correctly (not "Loading...")
- "Super Admin" button in the dashboard navigation
- Access to `/super-admin` route with Sector Weightings

## Troubleshooting

If role still shows "Loading..." after setting super_admin:

1. Check browser console for errors (F12 → Console)
2. Verify RLS policies allow self-read:
   ```sql
   SELECT policyname, cmd, qual, with_check
   FROM pg_policies
   WHERE tablename = 'user_profiles'
   AND policyname LIKE '%own%';
   ```
3. Ensure auth.uid() matches your user_profiles.id:
   ```sql
   SELECT auth.uid() as current_user_id,
          (SELECT id FROM user_profiles WHERE id = auth.uid()) as profile_exists;
   ```
