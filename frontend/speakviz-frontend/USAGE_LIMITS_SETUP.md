# Usage Limits Setup Guide

This guide explains how to set up and manage usage limits for SpeakViz users.

## Overview

The usage limit system allows you to:
- Limit users to 10 videos by default
- Bypass limits for privileged users through a boolean flag
- Track usage across the application
- Show usage information to users

## Database Setup

### 1. Run the Migration

Execute the following SQL in your Supabase dashboard SQL editor:

```sql
-- Add usage_limit_bypassed column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS usage_limit_bypassed BOOLEAN DEFAULT FALSE;

-- Add comment to document the column
COMMENT ON COLUMN profiles.usage_limit_bypassed IS 'When true, user bypasses the 10 video usage limit';

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_usage_limit_bypassed ON profiles(usage_limit_bypassed);
```

### 2. Verify the Setup

Check that the column was added successfully:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'usage_limit_bypassed';
```

## Managing User Limits

### Grant Unlimited Access

To give a user unlimited access (bypass the 10 video limit):

```sql
UPDATE profiles 
SET usage_limit_bypassed = TRUE 
WHERE id = 'user-uuid-here';
```

### Remove Unlimited Access

To remove unlimited access for a user:

```sql
UPDATE profiles 
SET usage_limit_bypassed = FALSE 
WHERE id = 'user-uuid-here';
```

### Check User Status

To check if a user has unlimited access:

```sql
SELECT id, usage_limit_bypassed 
FROM profiles 
WHERE id = 'user-uuid-here';
```

## Application Features

### Usage Display

Users can access their usage information through:
1. **Dedicated Usage Page**: Navigate to `/usage` to see detailed usage statistics
2. **Profile Dropdown**: Click the profile icon in the top-right corner to access usage information

### Limit Enforcement

- Users can delete recordings without affecting their usage count
- Users with bypass privileges have unlimited access
- The system tracks usage but doesn't prevent recording (limits are informational)

### Usage Tracking

The system automatically:
- Counts videos per user
- Checks bypass status before allowing recordings
- Updates usage display in real-time

## Configuration

### Changing the Limit

To change the video limit from 10 to another number:

1. Update the constant in `frontend/speakviz-frontend/src/app/components/recorder.js`:
   ```javascript
   const USAGE_LIMIT = 15; // Change from 10 to desired limit
   ```

2. Update the constant in `frontend/speakviz-frontend/src/app/components/playback.js`:
   ```javascript
   const [usageInfo, setUsageInfo] = useState({ current: 0, limit: 15, bypassed: false });
   ```

3. Update the SQL function if you created it:
   ```sql
   -- Update the function to use the new limit
   CREATE OR REPLACE FUNCTION can_user_record_more_videos(user_id UUID)
   RETURNS BOOLEAN AS $$
   DECLARE
       bypassed BOOLEAN;
       video_count INTEGER;
   BEGIN
       SELECT usage_limit_bypassed INTO bypassed
       FROM profiles
       WHERE id = user_id;
       
       IF bypassed THEN
           RETURN TRUE;
       END IF;
       
       SELECT COUNT(*) INTO video_count
       FROM videos
       WHERE user_id = user_id;
       
       RETURN video_count < 15; -- Updated limit
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

## Troubleshooting

### Common Issues

1. **Column not found**: Make sure you ran the migration SQL in the correct database
2. **Usage not updating**: Check that the user ID is correct in the profiles table
3. **Bypass not working**: Verify the `usage_limit_bypassed` column is set to `TRUE`

### Debug Queries

Check user's current status:
```sql
SELECT 
    p.id,
    p.usage_limit_bypassed,
    COUNT(v.id) as video_count
FROM profiles p
LEFT JOIN videos v ON p.id = v.user_id
WHERE p.id = 'user-uuid-here'
GROUP BY p.id, p.usage_limit_bypassed;
```

Check all users with bypass privileges:
```sql
SELECT id, usage_limit_bypassed 
FROM profiles 
WHERE usage_limit_bypassed = TRUE;
```

## Security Notes

- The bypass flag should only be set through the Supabase dashboard
- Regular users cannot modify their own bypass status
- The system gracefully handles missing profile records
- Usage counts are real-time and accurate 