# Coursify LMS Application

Complete Learning Management System with micro-video management and Google Drive integration.

## Features

- **Authentication**: Email/password and Google OAuth
- **Course Creation**: Create courses with modules and lessons
- **Micro-Video Management**: Split videos into segments and update individual sections
- **Google Drive Integration**: Store videos in Google Drive (coming soon)
- **Progress Tracking**: Track learner progress and completion
- **Admin Dashboard**: View analytics and export reports

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

3. Set up Supabase:
   - Create a new Supabase project
   - Run the SQL schema from `database/schema.sql` in the Supabase SQL editor
   - Enable Google OAuth provider in Supabase Auth settings (for Google Drive integration)

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
coursify-app/
├── app/                    # Next.js app router pages
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard and course management
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── CourseEditor.tsx   # Course editing interface
│   ├── MicroVideoPlayer.tsx  # Video player with segment support
│   └── ...
├── lib/                   # Utility functions and types
│   ├── supabase-server.ts # Server-side Supabase client
│   ├── supabase-client.ts # Client-side Supabase client
│   └── types.ts           # TypeScript types
└── database/              # Database schema
    └── schema.sql         # SQL schema for Supabase
```

## TODO / Known Limitations

- Google Drive integration needs OAuth token handling
- Video stitching logic needs implementation
- File upload functionality needs implementation
- Comprehensive RLS policies need to be added
- Excel export needs proper implementation
- Learner enrollment flow needs completion

## Cost Optimization

This application is designed to run on free tiers:
- **Vercel**: Free tier for hosting
- **Supabase**: Free tier for database and auth
- **Cloudflare**: Free tier for CDN (optional)

For <1000 users, this should remain free or very low cost.
