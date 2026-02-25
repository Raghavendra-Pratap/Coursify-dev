# Backend Setup Guide

This guide will help you set up the Supabase backend for Coursify LMS.

## What we use Supabase for

Supabase is used for **Auth** and **Database** only. Course videos and thumbnails are stored in Google Drive, YouTube, or other external storage—not in Supabase Storage. You do not need to create Storage buckets for course content.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. Node.js and npm installed
3. Git installed

## Step 1: Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in:
   - **Name**: Coursify LMS (or your preferred name)
   - **Database Password**: Choose a strong password (save it securely)
   - **Region**: Choose the closest region to your users
   - **Pricing Plan**: Free tier is fine for development (< 1000 users)
4. Click "Create new project"
5. Wait for the project to be created (takes 1-2 minutes)

## Step 2: Set Up Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `database/schema.sql`
4. Paste it into the SQL editor
5. Click "Run" (or press Cmd/Ctrl + Enter)
6. Wait for all tables to be created (you should see success messages)

## Step 3: Configure Environment Variables

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (the `anon` key, not the `service_role` key)

3. In your project root, create a `.env.local` file:
   ```bash
   cp env.template .env.local
   ```

4. Open `.env.local` and fill in your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

5. **Optional**: For server-side operations, also add:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
   ⚠️ **Warning**: Never commit the service role key or expose it to the client!

## Step 4: Configure Storage Buckets (Optional — skip for content)

**Content storage**: We do not use Supabase for course videos or thumbnails. Use Google Drive, YouTube, or other external storage. This step is optional (e.g. only if you later add small app assets); you can skip it for now.

1. In Supabase dashboard, go to **Storage**
2. Create a new bucket (only if you need Supabase for non-course assets):
   - **Name**: `course-videos`
   - **Public**: ✅ Yes (for video playback)
   - **File size limit**: 500 MB (or as needed)
   - **Allowed MIME types**: `video/*`

3. Create another bucket for thumbnails:
   - **Name**: `course-thumbnails`
   - **Public**: ✅ Yes
   - **File size limit**: 5 MB
   - **Allowed MIME types**: `image/*`

4. Set up Storage Policies (in SQL Editor):
   ```sql
   -- Allow authenticated users to upload videos
   CREATE POLICY "Users can upload videos" ON storage.objects
     FOR INSERT WITH CHECK (
       bucket_id = 'course-videos' 
       AND auth.role() = 'authenticated'
     );

   -- Allow public read access to videos
   CREATE POLICY "Public can view videos" ON storage.objects
     FOR SELECT USING (bucket_id = 'course-videos');

   -- Allow authenticated users to upload thumbnails
   CREATE POLICY "Users can upload thumbnails" ON storage.objects
     FOR INSERT WITH CHECK (
       bucket_id = 'course-thumbnails' 
       AND auth.role() = 'authenticated'
     );

   -- Allow public read access to thumbnails
   CREATE POLICY "Public can view thumbnails" ON storage.objects
     FOR SELECT USING (bucket_id = 'course-thumbnails');
   ```

## Step 5: Configure Authentication

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **Email** provider (enabled by default)
3. Configure email templates if needed
4. For Google Drive integration (Phase 1, Sprint 7-8):
   - Go to **Authentication** → **URL Configuration**
   - Add redirect URLs:
     - `http://localhost:3000/auth/callback` (for development)
     - `https://yourdomain.com/auth/callback` (for production)

## Step 6: Verify Setup

1. Install dependencies (if not already done):
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Check the browser console for any Supabase connection errors
4. Try creating a test user in Supabase dashboard → Authentication → Users

## Step 7: Generate TypeScript Types (Optional but Recommended)

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
   (Find your project ref in Settings → General)

4. Generate types:
   ```bash
   supabase gen types typescript --linked > lib/database.types.ts
   ```

## Troubleshooting

### "Supabase configuration missing" warning
- Make sure `.env.local` exists and has the correct values
- Restart your development server after creating/updating `.env.local`
- Check that variable names start with `NEXT_PUBLIC_` for client-side access

### RLS Policy Errors
- Make sure you've run the schema SQL file completely
- Check that RLS policies are created (in SQL Editor, run: `SELECT * FROM pg_policies WHERE tablename = 'courses';`)

### If you use Storage (optional)
- Verify storage buckets are created
- Check storage policies are set correctly
- Ensure the bucket is public if you need public access
- Note: Course content (videos, thumbnails) uses Google Drive / YouTube, not Supabase Storage

### Authentication Issues
- Verify email provider is enabled
- Check redirect URLs are configured correctly
- Make sure RLS policies allow the operations you're trying to perform

## Next Steps

After completing this setup:

1. **Phase 1, Sprint 3-4**: Implement authentication flows
2. **Phase 1, Sprint 5-6**: Implement file uploads using Google Drive or YouTube (not Supabase Storage) for course videos
3. **Phase 1, Sprint 7-8**: Implement Google Drive OAuth integration

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase TypeScript Guide](https://supabase.com/docs/reference/javascript/typescript-support)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Guide](https://supabase.com/docs/guides/storage)
