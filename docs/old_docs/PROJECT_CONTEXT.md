# Coursify LMS - Project Context

**Last Updated**: Current Session  
**Status**: Phase 1, Sprint 1-2 Complete (Backend Setup Done, UI 95% Complete)

**Release codebase**: Develop and release from **`coursify-app/`** (Next.js App Router, auth, MicroVideoPlayer, GoogleDrivePicker). Root-level `app/` and `components/` are a parallel UI/prototype; see `docs/HANDOFF_SUMMARY.md` for consolidation and next steps.

---

## 🎯 Project Overview

**Coursify LMS** is a Learning Management System with a **core differentiation in micro-video management** - the ability to update specific video segments without re-recording entire videos.

### Core Strategy
- **Micro-video management**: Edit/update video sections without full re-recording
- **External storage integration**: Google Drive to reduce costs and migration friction
- **Target users**: Corporate L&D teams and SMEs in fast-moving companies
- **Cost optimization**: Free tiers for <1000 users

---

## ✅ Completed Work

### 1. Frontend UI (95% Complete)
All major pages implemented with full functionality:

#### **Dashboard** (`components/pages/Dashboard.tsx`)
- Stats cards with trends
- Charts (engagement, completion)
- Notifications panel
- Recent activity feed
- Quick actions

#### **My Courses** (`components/pages/MyCourses.tsx`)
- Grid/list view toggle
- Filtering (status, category)
- Sorting options
- Search functionality
- Bulk actions
- Share/Delete modals

#### **Create Course** (`components/pages/CreateCourse.tsx`)
- **Micro-video editor** with:
  - Drag-and-drop for modules, lessons, content items
  - Multiple upload options:
    - Direct file upload
    - Google Drive integration (UI ready)
    - YouTube video embedding with timestamps
  - Quiz/form insertion between video segments
  - Video streaming UI with timestamp controls
  - Version history sidebar
- Course structure management
- Module/lesson/content hierarchy

#### **Learners** (`components/pages/Learners.tsx`)
- Status filtering (All, Active, Inactive, Pending)
- Search and sorting
- Invite modal (email/CSV)
- Detailed learner profile modal
- Progress tracking UI

#### **Analytics** (`components/pages/Analytics.tsx`)
- Multiple metric views:
  - Overview
  - Engagement
  - Completion
  - Performance
- Charts and visualizations
- Department breakdowns
- Course performance tables
- Top performers
- At-risk learners

#### **Reports** (`components/pages/Reports.tsx`)
- Report templates with categories
- Recently generated reports
- Create custom reports modal
- Schedule reports modal
- Report generation and management
- Stats dashboard

#### **Profile** (in `CoursifyLMS.tsx`)
- Profile modal in sidebar
- Quick stats display
- Profile actions (View Full Profile, Settings, Sign Out)

### 2. Backend Setup (Complete)

#### **Database Schema** (`database/schema.sql`)
Complete PostgreSQL schema with:
- **Core tables**: courses, modules, lessons, content_items
- **Video management**: video_segments (for micro-video feature)
- **Assessments**: quizzes, quiz_questions, forms, form_fields
- **User management**: user_profiles, enrollments, progress, quiz_attempts
- **Integrations**: google_drive_connections
- **Analytics**: course_analytics
- **Versioning**: course_versions
- **Security**: Row Level Security (RLS) policies on all tables
- **Automation**: Triggers for updated_at timestamps, auto-create user profiles

#### **Supabase Client** (`lib/supabase.ts`)
- Client-side Supabase client for React components
- Server-side client for API routes
- Helper functions: `getCurrentUser()`, `getUserProfile()`
- TypeScript support with database types

#### **TypeScript Types** (`lib/database.types.ts`)
- Complete type definitions for all database tables
- Type-safe database operations
- Ready for auto-generation from Supabase

#### **Setup Documentation** (`BACKEND_SETUP.md`)
- Step-by-step Supabase setup guide
- Database configuration instructions
- Storage bucket setup
- Authentication configuration
- Troubleshooting guide

### 3. Project Structure
```
Coursify/
├── app/                    # Next.js app router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main page (renders CoursifyLMS)
│   └── globals.css         # Global styles
├── components/
│   ├── CoursifyLMS.tsx    # Main app component (orchestrator)
│   └── pages/              # Page components
│       ├── Dashboard.tsx
│       ├── CreateCourse.tsx
│       ├── MyCourses.tsx
│       ├── Learners.tsx
│       ├── Analytics.tsx
│       └── Reports.tsx
├── lib/
│   ├── supabase.ts        # Supabase client
│   └── database.types.ts  # TypeScript types
├── database/
│   └── schema.sql         # Database schema
├── sample ui/             # Reference UI mockups
└── [config files]
```

---

## 🛠 Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend**: Supabase (PostgreSQL)
- **Hosting**: Vercel (free tier)
- **Storage**: Supabase Storage + Google Drive (planned)

---

## 📋 Next Steps (Phase 1, Sprint 3-4)

### Immediate Priorities

#### 1. **Authentication** (High Priority)
- [ ] Set up Supabase Auth
- [ ] Create login/signup pages
- [ ] Implement protected routes
- [ ] User session management
- [ ] Replace mock user data with real auth

#### 2. **Backend Integration** (High Priority)
- [ ] Connect Create Course page to database
- [ ] Implement course CRUD operations
- [ ] File upload to Supabase Storage
- [ ] Replace all mock data with real database queries

#### 3. **Google Drive Integration** (Sprint 7-8)
- [ ] OAuth setup
- [ ] File selection from Drive
- [ ] Video streaming from Drive

#### 4. **Micro-Video Feature** (Sprint 5-6)
- [ ] Video segmentation logic
- [ ] Video stitching/merging
- [ ] Timestamp-based streaming
- [ ] Video player with segment controls

---

## 📁 Key Files Reference

### Configuration Files
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `next.config.js` - Next.js configuration
- `env.template` - Environment variables template

### Documentation
- `project_plan.md` - Complete development roadmap
- `BACKEND_SETUP.md` - Supabase setup guide
- `README.md` - Project overview and setup
- `CHANGES.md` - Change log
- `PAGES_IMPLEMENTATION.md` - UI implementation details

### Core Components
- `components/CoursifyLMS.tsx` - Main app orchestrator
- `components/pages/*.tsx` - All page components
- `lib/supabase.ts` - Database client
- `database/schema.sql` - Database structure

---

## 🎯 Current State Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **UI** | ✅ 95% Complete | All major pages implemented with mock data |
| **Backend Schema** | ✅ Complete | Ready for integration |
| **Authentication** | ❌ Not Started | TODO: Sprint 3-4 |
| **File Uploads** | ⚠️ UI Ready | Backend integration needed |
| **Google Drive** | ❌ Not Started | Planned for Sprint 7-8 |
| **Micro-Video** | ⚠️ UI Ready | Core logic needed (Sprint 5-6) |

---

## 🚀 Development Commands

```bash
# Development
npm run dev          # Start dev server (http://localhost:3000)

# Production
npm run build        # Build for production
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
```

---

## ⚠️ Important Notes

1. **Mock Data**: All pages currently use mock data - needs to be replaced with Supabase queries
2. **Authentication**: User data is hardcoded - needs Supabase Auth implementation
3. **File Uploads**: UI exists but needs connection to Supabase Storage
4. **Google Drive**: Placeholder UI exists - needs OAuth implementation (Sprint 7-8)
5. **Micro-Video**: UI is ready but core video processing logic needed (Sprint 5-6)

---

## 🔗 Environment Setup

1. **Copy environment template**:
   ```bash
   cp env.template .env.local
   ```

2. **Add Supabase credentials** to `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

3. **Set up Supabase** (see `BACKEND_SETUP.md`):
   - Create Supabase project
   - Run `database/schema.sql` in SQL Editor
   - Configure storage buckets
   - Set up authentication

---

## 📊 Data Structure

### Course Hierarchy
```
Course
  └── Module
      └── Lesson
          └── Content Item (video, quiz, form)
              └── Video Segments (for micro-video)
              └── Quiz Questions
              └── Form Fields
```

### Key Relationships
- **Courses** → Created by Users
- **Modules** → Belong to Courses (ordered)
- **Lessons** → Belong to Modules (ordered)
- **Content Items** → Belong to Lessons (ordered)
- **Video Segments** → Belong to Content Items (for micro-video stitching)
- **Enrollments** → Users enrolled in Courses
- **Progress** → Track lesson completion per enrollment

---

## 🎨 UI Features Implemented

### Drag & Drop
- ✅ Reorder modules
- ✅ Reorder lessons within modules
- ✅ Reorder content items within lessons

### Upload Options
- ✅ Direct file upload (UI ready)
- ✅ Google Drive integration (UI ready, backend pending)
- ✅ YouTube embedding with timestamps (UI ready)

### Assessments
- ✅ Quiz creation with multiple question types
- ✅ Form creation with various field types
- ✅ Insert quizzes/forms between video segments

### Analytics
- ✅ Multiple metric views
- ✅ Interactive charts
- ✅ Department breakdowns
- ✅ Performance tracking

### Reports
- ✅ Report templates
- ✅ Custom report creation
- ✅ Report scheduling
- ✅ Export options (PDF, Excel, CSV)

---

## 🔐 Security

- **Row Level Security (RLS)** enabled on all tables
- **Policies** for:
  - Users can only manage their own courses
  - Published courses viewable by all
  - Users can only view/update their own progress
  - Google Drive connections are user-specific

---

## 📝 TODO Items

### High Priority (Sprint 3-4)
- [ ] Implement Supabase Authentication
- [ ] Create login/signup pages
- [ ] Connect Create Course to database
- [ ] Implement file uploads to Supabase Storage
- [ ] Replace mock data with real database queries

### Medium Priority (Sprint 5-6)
- [ ] Implement micro-video segmentation
- [ ] Video stitching/merging logic
- [ ] Timestamp-based video streaming
- [ ] Video player with segment controls

### Lower Priority (Sprint 7-8)
- [ ] Google Drive OAuth integration
- [ ] Google Drive file selection
- [ ] Video streaming from Google Drive

---

## 🐛 Known Issues

- All data is mock/placeholder - needs backend integration
- Authentication not implemented - user data is hardcoded
- File uploads not connected to storage
- Google Drive integration is UI-only

---

## 📚 Additional Resources

- **Project Plan**: `project_plan.md` - Complete roadmap
- **Backend Setup**: `BACKEND_SETUP.md` - Supabase setup guide
- **Implementation Details**: `PAGES_IMPLEMENTATION.md` - UI features
- **Changes Log**: `CHANGES.md` - Development history

---

**Ready for**: Backend integration, Authentication implementation, Real data connections
