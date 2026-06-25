# Coursify LMS

Learning Management System with micro-video management capabilities.

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp env.template .env.local
```
Then edit `.env.local` and add your Supabase credentials.

3. Set up Supabase backend:
   - Follow the detailed guide in `BACKEND_SETUP.md`
   - Create a Supabase project at https://supabase.com
   - Run the SQL schema from `database/schema.sql` in Supabase SQL Editor
   - Configure storage buckets and authentication
   - Add your credentials to `.env.local`

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `/app` - Next.js app router pages and layouts
- `/components` - React components
- `/lib` - Utility functions and Supabase client
- `/database` - Database schema SQL files
- `/sample ui` - Original UI mockup (reference)

## Development Phases

See `project_plan.md` for detailed roadmap:

- **Phase 0**: Validation (Days 1-14) - Currently skipped
- **Phase 1**: MVP Development (Weeks 3-14)
  - Sprint 1-2: Foundation & Infrastructure ✅ (Backend setup complete)
  - Sprint 3-4: Core Course Creation & Authentication
  - Sprint 5-6: Micro-Video Management
  - Sprint 7-8: Google Drive Integration
  - Sprint 9-10: Progress Tracking & Admin Dashboard
  - Sprint 11-12: Polish & Beta Testing

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL) — auth and data only; videos external (YouTube, Drive, URLs)
- **Hosting**: Vercel (free tier for MVP)
- **Icons**: Lucide React

## Performance

Shell navigation (Dashboard, My Courses, Learners, Q&A, Notes, etc.) uses keep-alive views, client-side cache, and login prefetch for instant tab switching. See [docs/OPTIMIZATION_REFACTOR.md](docs/OPTIMIZATION_REFACTOR.md).

## Cost Optimization

- Using free tiers where possible:
  - Vercel: Free tier (suitable for <1000 users)
  - Supabase: Free tier (500MB database, 1GB storage)
  - Cloudflare: Free CDN tier

## TODO

See individual files for TODO comments marking features to implement in each sprint.
