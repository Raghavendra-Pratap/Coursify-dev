# Codebase Map: Coursify LMS

**Last Updated**: 2025-03 (post–learner mode & course import from sheet)  
**Purpose**: Navigation guide for the codebase structure, entry points, and component relationships

---

## 📁 Folder Structure

```
Coursify/
├── app/                          # Next.js App Router (entry point)
│   ├── layout.tsx               # Root layout with metadata
│   ├── page.tsx                 # Home page (renders CoursifyLMS)
│   └── globals.css              # Global Tailwind CSS styles
│
├── components/                   # React components
│   ├── CoursifyLMS.tsx          # Main app orchestrator (sidebar + routing)
│   └── pages/                   # Page-level components
│       ├── Dashboard.tsx         # Dashboard with stats, charts, activity
│       ├── CreateCourse.tsx      # Course creation + Import from sheet
│       ├── MyCourses.tsx         # Course management; learner/instructor tabs
│       ├── Learners.tsx         # Learner management and tracking
│       ├── Analytics.tsx        # Analytics dashboard (4 metric views)
│       ├── Reports.tsx          # Report generation and scheduling
│       ├── TakeCourse.tsx       # Learner: video, reading, quiz/form, Q&A, notes
│       ├── MyNotes.tsx          # Learner: notes by course (localStorage)
│       ├── Notifications.tsx    # Learner: notifications sidebar
│       └── QAndA.tsx            # Learner: course Q&A threads
│
├── lib/                          # Utility libraries and clients
│   ├── supabase.ts              # Supabase client (client & server)
│   ├── database.types.ts        # TypeScript types for database
│   ├── magic-link.ts            # HMAC-signed magic link tokens (share links)
│   └── parseCourseSheet.ts      # CSV course import parser (segment_sequence)
│
├── public/                       # Static assets
│   └── course-import-template.csv # Template for Import from sheet
│
├── app/api/                      # API routes (Next.js)
│   ├── courses/[id]/magic-link/ # GET: generate magic link for course share
│   ├── instructor/
│   │   ├── courses/import-from-sheet/ # POST: create draft course from CSV
│   │   ├── courses/[courseId]/structure/ # POST: replace course structure
│   │   ├── courses/[courseId]/notify-update/ # POST: notify learners
│   │   └── questions/           # GET/POST: instructor Q&A
│   ├── learning/
│   │   ├── enrolled/            # GET: enrolled courses (with extra fields)
│   │   ├── my-questions/        # GET: current user's questions
│   │   ├── courses/[courseId]/questions/ # GET/POST: course Q&A
│   │   ├── courses/[courseId]/questions/[questionId]/ # PATCH: answer
│   │   └── courses/[courseId]/rating/ # POST: rate course (1–5, review)
│   └── notifications/          # GET/PATCH: user notifications
├── app/go/[token]/               # Magic link redirect: /go/TOKEN → /course/[id]
│
├── vercel.json                   # Vercel config (e.g. redirect vercel.app → custom domain)
│
├── database/                     # Database schema
│   └── schema.sql               # Complete PostgreSQL schema with RLS
│
├── sample ui/                    # Reference UI mockups (original designs)
│   ├── coursify-lms-app.tsx     # Main sample UI
│   ├── coursify-lms-app - [page] page.tsx  # Page-specific samples
│   └── coursify-architecture.md # Architecture reference
│
├── docs/                         # Documentation
│   ├── plans/                    # Planning documents
│   ├── decisions/                # Architecture decisions
│   ├── sessions/                 # Session notes
│   └── modules/                  # Module-specific docs
│
├── coursify-app/                 # ✅ Final product (develop & release here)
│   ├── app/                      # Next.js app structure
│   ├── components/               # Alternative components
│   ├── lib/                      # Alternative utilities
│   └── database/                 # Alternative schema
│
├── [config files]                # Configuration
│   ├── package.json              # Dependencies and scripts
│   ├── tsconfig.json             # TypeScript configuration
│   ├── tailwind.config.js        # Tailwind CSS configuration
│   ├── next.config.js            # Next.js configuration
│   ├── postcss.config.js         # PostCSS configuration
│   └── env.template              # Environment variables template
│
└── [documentation]               # Project documentation
    ├── PROJECT_CONTEXT.md        # Project overview and status
    ├── BACKEND_SETUP.md          # Supabase setup guide
    ├── README.md                 # Project README
    ├── project_plan.md           # Development roadmap
    └── [other .md files]         # Various analysis documents
```

---

## 🚪 Entry Points

### Primary Entry Point
**File**: `app/page.tsx`
- Renders `<CoursifyLMS />` component
- Client-side component (`'use client'`)
- Simple wrapper around main app

### Root Layout
**File**: `app/layout.tsx`
- Sets metadata (title, description)
- Imports global CSS
- Provides HTML structure

### Main App Component
**File**: `components/CoursifyLMS.tsx`
- **Purpose**: App orchestrator with sidebar navigation
- **State Management**: 
  - `currentView` - Controls which page to display
  - `sidebarOpen` - Sidebar collapse state
  - `showProfileModal` - Profile modal visibility
- **Navigation**: Routes to dashboard, courses, create, learners, analytics, reports, settings; learner views (take course, My Notes, Notifications, Q&A)
- **Components**: Renders page components based on `currentView`; supports learner/instructor session mode

---

## 🔗 Component Hierarchy

```
app/page.tsx
└── CoursifyLMS (components/CoursifyLMS.tsx)
    ├── Sidebar Navigation
    │   ├── NavItem components
    │   └── Profile Section (bottom)
    │
    └── Main Content Area (conditional rendering)
        ├── Dashboard (pages/Dashboard.tsx)
        ├── MyCourses (pages/MyCourses.tsx) — instructor + learner tabs
        ├── CreateCourse (pages/CreateCourse.tsx) — includes Import from sheet
        ├── TakeCourse (pages/TakeCourse.tsx) — learner course player
        ├── MyNotes (pages/MyNotes.tsx)
        ├── Notifications (pages/Notifications.tsx)
        ├── QAndA (pages/QAndA.tsx)
        ├── Learners (pages/Learners.tsx)
        ├── Analytics (pages/Analytics.tsx)
        ├── Reports (pages/Reports.tsx)
        └── Settings (inline placeholder)
```

---

## 📦 Component Details

### 1. CoursifyLMS (`components/CoursifyLMS.tsx`)
**Purpose**: Main application container
**Responsibilities**:
- Sidebar navigation management
- View routing/switching
- Profile modal management
- Layout structure

**Key Features**:
- Collapsible sidebar
- Active view highlighting
- Profile modal with quick actions
- Sign out functionality (placeholder)

**Dependencies**:
- All page components
- Lucide React icons
- React hooks (useState)

---

### 2. Dashboard (`components/pages/Dashboard.tsx`)
**Purpose**: Main dashboard with overview metrics
**Features**:
- Stats cards (4 metrics with trends)
- Engagement chart
- Recent activity feed
- Notifications panel
- Quick actions

**State**: Local state for notifications, filters
**Data**: Mock data (TODO: Connect to Supabase)

---

### 3. CreateCourse (`components/pages/CreateCourse.tsx`)
**Purpose**: Course creation with micro-video editor
**Features**:
- **Import from sheet**: Upload CSV → create draft course (parser: `lib/parseCourseSheet.ts`); template: `public/course-import-template.csv`; API: `POST /api/instructor/courses/import-from-sheet`
- Drag-and-drop for modules/lessons/content
- Multiple upload options (file, Google Drive, YouTube)
- Quiz/form insertion
- Video streaming UI with timestamps
- Version history sidebar
- Course structure management

**Data Structure**:
```typescript
Course
  └── Modules[]
      └── Lessons[]
          └── ContentItems[] (video/quiz/form)
              └── VideoSegments[] (for micro-video)
```

**State Management**: Complex local state for course structure
**Dependencies**: Drag-and-drop handlers, upload modals

---

### 4. MyCourses (`components/pages/MyCourses.tsx`)
**Purpose**: Course catalog management
**Features**:
- Grid/list view toggle
- Filtering (status, category)
- Sorting options
- Search functionality
- Bulk actions
- Share/Delete modals

**State**: View mode, filters, selected courses
**Data**: Mock course data

---

### 5. Learners (`components/pages/Learners.tsx`)
**Purpose**: Learner management and tracking
**Features**:
- Status filtering (All, Active, Inactive, Pending)
- Search and sorting
- Invite modal (email/CSV)
- Learner profile modal
- Progress tracking display

**State**: Filters, search, selected learner
**Data**: Mock learner data

---

### 6. Analytics (`components/pages/Analytics.tsx`)
**Purpose**: Analytics dashboard
**Features**:
- 4 metric views (Overview, Engagement, Completion, Performance)
- Interactive charts
- Department breakdowns
- Course performance tables
- Top performers
- At-risk learners

**State**: Selected metric view, date range, filters
**Data**: Mock analytics data

---

### 7. Reports (`components/pages/Reports.tsx`)
**Purpose**: Report generation and scheduling
**Features**:
- Report templates
- Recently generated reports
- Create custom reports modal
- Schedule reports modal
- Category filtering
- Search functionality

**State**: Selected category, search, modals, report management
**Data**: Mock report templates

---

## 🔌 Integration Points

### Supabase Client
**File**: `lib/supabase.ts`
**Exports**:
- `supabase` - Client-side Supabase client
- `createServerClient()` - Server-side client
- `getCurrentUser()` - Get authenticated user
- `getUserProfile()` - Get user profile

**Usage**: Imported in components (currently not used - TODO)

### Database Types
**File**: `lib/database.types.ts`
**Purpose**: TypeScript type definitions for database tables
**Usage**: Used with Supabase client for type safety

### Magic Links (Share URLs)
**File**: `lib/magic-link.ts`
**Purpose**: HMAC-signed tokens (1y expiry) for shareable course links; avoids exposing course UUID.
**API**: `GET /api/courses/[id]/magic-link` (auth required) → returns `magicLink` (uses `NEXT_PUBLIC_APP_URL`).
**Route**: `app/go/[token]/page.tsx` — verifies token, redirects to `/course/[id]` or `/?error=invalid_link`.
**Env**: `MAGIC_LINK_SECRET` (min 16 chars). Share modal in MyCourses uses magic link when available.

### Vercel Redirect
**File**: `vercel.json`
**Purpose**: Redirect `coursify-dev.vercel.app` → `https://coursify.bsoc.space` (same path) so production uses custom domain only.

---

## 📊 Data Flow

### Current State (Mock Data)
```
Component State → UI Rendering → User Interaction → State Update
```

### Target State (With Backend)
```
Component → Supabase Client → Database → Response → Component State → UI
```

### Example: Create Course Flow
```
1. User creates course structure (local state)
2. User adds modules/lessons/content (local state)
3. User uploads videos (TODO: Supabase Storage)
4. User saves course (TODO: Database insert)
5. Course persisted in database
```

---

## 🎨 Styling Patterns

### Framework
- **Tailwind CSS** - Utility-first CSS framework
- **Global Styles**: `app/globals.css` (Tailwind directives)

### Patterns Observed
- Gradient backgrounds for cards (`bg-gradient-to-br`)
- Rounded corners (`rounded-xl`, `rounded-2xl`)
- Shadow effects (`shadow-lg`, `shadow-xl`)
- Color scheme: Blue primary, with purple/green/orange accents
- Responsive: Grid layouts with breakpoints

### Component Styling
- Inline Tailwind classes (no separate CSS files)
- Conditional classes based on state
- Hover effects for interactivity

---

## 🔧 Configuration Files

### `package.json`
**Dependencies**:
- `next` (^14.0.0) - Next.js framework
- `react` (^18.2.0) - React library
- `@supabase/supabase-js` (^2.38.0) - Supabase client
- `lucide-react` (^0.294.0) - Icon library
- `tailwindcss` (^3.3.5) - CSS framework

**Scripts**:
- `dev` - Development server
- `build` - Production build
- `start` - Production server
- `lint` - ESLint

### `tsconfig.json`
- TypeScript configuration
- Path aliases: `@/*` → root directory

### `tailwind.config.js`
- Content paths for Tailwind scanning
- Theme extensions (currently minimal)

### `next.config.js`
- React strict mode enabled
- Image domains (commented out - TODO)

---

## 📝 File Naming Conventions

### Components
- **PascalCase**: `CoursifyLMS.tsx`, `CreateCourse.tsx`
- **Location**: `components/` or `components/pages/`

### Pages (Next.js App Router)
- **lowercase**: `page.tsx`, `layout.tsx`
- **Location**: `app/` directory

### Utilities
- **camelCase**: `supabase.ts`, `database.types.ts`
- **Location**: `lib/` directory

### Documentation
- **UPPERCASE**: `README.md`, `PROJECT_CONTEXT.md`
- **kebab-case**: `backend-setup.md` (some files)

---

## 🔄 Import Patterns

### Component Imports
```typescript
// Relative imports for local components
import Dashboard from './pages/Dashboard';
import CreateCourse from './pages/CreateCourse';

// Absolute imports (using @ alias)
import CoursifyLMS from '@/components/CoursifyLMS';
```

### Icon Imports
```typescript
// Named imports from lucide-react
import { Play, Upload, Edit, Users, ... } from 'lucide-react';
```

### Library Imports
```typescript
// React hooks
import React, { useState } from 'react';

// Supabase (when implemented)
import { supabase } from '@/lib/supabase';
```

---

## 🗂 Code Organization Patterns

### 1. Component Structure
```typescript
'use client'  // Client component directive

import React, { useState } from 'react';
import { ... } from 'lucide-react';

// Type definitions (if needed)
interface Props { ... }

// Component
const ComponentName: React.FC<Props> = ({ ... }) => {
  // State declarations
  const [state, setState] = useState(...);
  
  // Event handlers
  const handleAction = () => { ... };
  
  // Render
  return ( ... );
};

export default ComponentName;
```

### 2. State Management
- **Local State**: `useState` hooks in components
- **No Global State**: No Redux/Zustand (yet)
- **Props Drilling**: State passed via props

### 3. Data Handling
- **Mock Data**: Currently hardcoded in components
- **TODO**: Replace with Supabase queries
- **Type Safety**: TypeScript interfaces defined

---

## 🎯 Feature-to-Code Mapping

| Feature | Component | Status |
|---------|-----------|--------|
| Dashboard Overview | `pages/Dashboard.tsx` | ✅ UI Complete |
| Course Creation | `pages/CreateCourse.tsx` | ✅ UI Complete |
| Course Management | `pages/MyCourses.tsx` | ✅ UI Complete |
| Learner Management | `pages/Learners.tsx` | ✅ UI Complete |
| Analytics | `pages/Analytics.tsx` | ✅ UI Complete |
| Reports | `pages/Reports.tsx` | ✅ UI Complete |
| Navigation | `CoursifyLMS.tsx` | ✅ Complete |
| Authentication | ❌ Not Implemented | TODO |
| File Uploads | `CreateCourse.tsx` (UI only) | ⚠️ UI Ready |
| Google Drive | `CreateCourse.tsx` (UI only) | ⚠️ UI Ready |
| Database Integration | All pages | ❌ Mock Data |

---

## 🔍 Key Patterns Identified

### 1. View-Based Routing
- Single-page app with view switching
- `currentView` state controls rendering
- No Next.js routing (all in one component)

### 2. Modal Pattern
- Modals for forms/actions
- State: `show[ModalName]Modal`
- Overlay with backdrop click to close

### 3. Drag-and-Drop
- Custom implementation (not using library)
- `draggedItem` state tracks drag
- `onDragStart`, `onDragOver`, `onDrop` handlers

### 4. Filter/Search Pattern
- Local state for filters
- Filtered arrays computed from state
- Search with `.includes()` on strings

### 5. Stat Cards
- Reusable gradient card component
- Color variants (blue, purple, green, orange)
- Trend indicators (up/down arrows)

---

## 🚨 Technical Debt & TODOs

### High Priority
- [ ] **Authentication**: Replace hardcoded user data
- [ ] **Database Integration**: Connect all pages to Supabase
- [ ] **File Uploads**: Implement Supabase Storage
- [ ] **Mock Data**: Replace with real queries

### Medium Priority
- [ ] **Error Handling**: Add error boundaries
- [ ] **Loading States**: Add loading indicators
- [ ] **Form Validation**: Add validation logic
- [ ] **Type Safety**: Complete TypeScript coverage

### Low Priority
- [ ] **Code Splitting**: Lazy load page components
- [ ] **State Management**: Consider global state solution
- [ ] **Testing**: Add unit/integration tests

---

## ❓ Open Questions

1. **`coursify-app/` directory**: What is this? Legacy code or alternative implementation?
2. **Routing Strategy**: Will this remain single-page or migrate to Next.js routing?
3. **State Management**: Will we add Redux/Zustand for global state?
4. **API Routes**: Will we use Next.js API routes or direct Supabase calls?
5. **Image Handling**: How will course thumbnails be handled?

---

## 🔗 Related Documentation

- **Docs index**: `docs/DOCS_INDEX.md` - Full list of docs with descriptions
- **Project Context**: `docs/PROJECT_CONTEXT.md` - Overall project status, recent completions
- **Technical Reference**: `docs/TECHNICAL_REFERENCE.md` - Schema, APIs, Supabase
- **Course import plan**: `docs/plans/COURSE_FROM_SHEET_PLAN.md` - CSV import structure and API
- **Decisions**: `docs/decisions/DECISIONS.md` - Architecture decisions

---

## 📍 Quick Reference

### Where to Find...

**Main App Entry**: `app/page.tsx`  
**App Orchestrator**: `components/CoursifyLMS.tsx`  
**Page Components**: `components/pages/*.tsx`  
**Database Client**: `lib/supabase.ts`  
**Database Schema**: `database/schema.sql`  
**Type Definitions**: `lib/database.types.ts`  
**Configuration**: Root level config files  
**Documentation**: Root level `.md` files + `docs/` directory

### Common Tasks

**Add a new page**:
1. Create component in `components/pages/`
2. Import in `CoursifyLMS.tsx`
3. Add NavItem in sidebar
4. Add conditional rendering in main content

**Connect to database**:
1. Import `supabase` from `lib/supabase.ts`
2. Replace mock data with Supabase query
3. Add loading/error states
4. Update TypeScript types if needed

**Add a new feature**:
1. Identify which page component
2. Add state management
3. Add UI elements
4. Connect to backend (if needed)

---

**Status**: Codebase Map Complete  
**Next**: `/technical` for technical deep-dive
