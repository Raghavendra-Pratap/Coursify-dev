# Technical Reference: Coursify LMS

**Last Updated**: Current Session  
**Purpose**: Technical details - APIs, types, schemas, and implementation specifics

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend Framework** | Next.js | 14.0.0 | React framework with App Router |
| **UI Library** | React | 18.2.0 | Component library |
| **Language** | TypeScript | 5.2.2 | Type safety |
| **Styling** | Tailwind CSS | 3.3.5 | Utility-first CSS |
| **Icons** | Lucide React | 0.294.0 | Icon components |
| **Backend** | Supabase | 2.38.0 | PostgreSQL database + Auth + Storage |
| **Database** | PostgreSQL | (via Supabase) | Relational database |
| **Hosting** | Vercel | (planned) | Deployment platform |

### Frontend Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| `next` | ^14.0.0 | Next.js framework with App Router |
| `react` | ^18.2.0 | React library |
| `react-dom` | ^18.2.0 | React DOM rendering |
| `@supabase/supabase-js` | ^2.38.0 | Supabase JavaScript client |
| `lucide-react` | ^0.294.0 | Icon component library |

### Development Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.2.2 | TypeScript compiler |
| `@types/node` | ^20.9.0 | Node.js type definitions |
| `@types/react` | ^18.2.37 | React type definitions |
| `@types/react-dom` | ^18.2.15 | React DOM type definitions |
| `tailwindcss` | ^3.3.5 | Tailwind CSS framework |
| `autoprefixer` | ^10.4.16 | CSS autoprefixer |
| `postcss` | ^8.4.31 | CSS post-processor |
| `eslint` | ^8.53.0 | JavaScript linter |
| `eslint-config-next` | ^14.0.0 | Next.js ESLint config |

---

## Type System

### Core Type Definitions

#### Content Types (`components/pages/CreateCourse.tsx`)

```typescript
type ContentType = 'video' | 'quiz' | 'form';
type VideoSource = 'upload' | 'google_drive' | 'youtube';
```

#### Video Segment Interface

```typescript
interface VideoSegment {
  id: number;
  name: string;
  duration: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'processing';
  size: string;
  lastEdited: string;
  source: VideoSource;
  sourceUrl?: string; // For YouTube or Google Drive
  startTimestamp?: number; // For streaming: start time in seconds
  endTimestamp?: number; // For streaming: end time in seconds
}
```

#### Quiz Interfaces

```typescript
interface QuizQuestion {
  id: number;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];
  correctAnswer: string | number;
  required: boolean;
}

interface Quiz {
  id: number;
  title: string;
  questions: QuizQuestion[];
  passingScore: number;
}
```

#### Course Structure Interfaces

```typescript
interface ContentItem {
  id: number;
  type: ContentType;
  order: number;
  videoSegment?: VideoSegment;
  quiz?: Quiz;
  form?: any; // Form structure similar to quiz
}

interface Lesson {
  id: number;
  title: string;
  order: number;
  content: ContentItem[]; // Can have multiple content items
  duration: string;
}

interface Module {
  id: number;
  title: string;
  order: number;
  lessons: Lesson[];
  duration: string;
}
```

#### Component Props

```typescript
interface CreateCourseProps {
  setCurrentView: (view: string) => void;
}

interface LearnersProps {
  setCurrentView: (view: string) => void;
}

interface MyCoursesProps {
  setCurrentView: (view: string) => void;
}

interface DashboardProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setCurrentView: (view: string) => void;
}
```

### Database Types (`lib/database.types.ts`)

#### Database Interface Structure

```typescript
export interface Database {
  public: {
    Tables: {
      courses: { Row: {...}, Insert: {...}, Update: {...} }
      modules: { Row: {...}, Insert: {...}, Update: {...} }
      lessons: { Row: {...}, Insert: {...}, Update: {...} }
      content_items: { Row: {...}, Insert: {...}, Update: {...} }
      video_segments: { Row: {...}, Insert: {...}, Update: {...} }
      quizzes: { Row: {...}, Insert: {...}, Update: {...} }
      quiz_questions: { Row: {...}, Insert: {...}, Update: {...} }
      // ... other tables
    }
  }
}
```

#### Key Table Row Types

**Courses:**
```typescript
{
  id: string (UUID)
  title: string
  description: string | null
  created_by: string (UUID)
  created_at: string (TIMESTAMPTZ)
  updated_at: string (TIMESTAMPTZ)
  status: 'draft' | 'published' | 'archived'
  thumbnail_url: string | null
  metadata: Json | null
}
```

**Video Segments:**
```typescript
{
  id: string (UUID)
  content_item_id: string (UUID)
  name: string
  duration_seconds: number
  start_time_seconds: number
  end_time_seconds: number
  source: 'upload' | 'google_drive' | 'youtube'
  source_url: string | null
  storage_path: string | null
  file_size_bytes: number | null
  status: 'active' | 'processing' | 'failed'
  created_at: string (TIMESTAMPTZ)
  updated_at: string (TIMESTAMPTZ)
}
```

---

## Database Schema

### Entity Relationship Diagram

```
auth.users (Supabase Auth)
  └── user_profiles
      └── courses (created_by)
          └── modules (course_id)
              └── lessons (module_id)
                  └── content_items (lesson_id)
                      ├── video_segments (content_item_id)
                      ├── quizzes (content_item_id)
                      │   └── quiz_questions (quiz_id)
                      └── forms (content_item_id)
                          └── form_fields (form_id)

courses
  └── enrollments (course_id, user_id)
      └── progress (enrollment_id, lesson_id)
          └── quiz_attempts (enrollment_id, quiz_id)

courses
  └── course_versions (course_id)
  └── course_analytics (course_id)

user_profiles
  └── google_drive_connections (user_id)
```

### Key Tables

#### `courses`
- **Primary Key**: `id` (UUID)
- **Foreign Keys**: `created_by` → `auth.users(id)`
- **Constraints**: `status` CHECK ('draft', 'published', 'archived')
- **Indexes**: `created_by`, `status`
- **RLS**: Enabled with policies for owner access

#### `modules`
- **Primary Key**: `id` (UUID)
- **Foreign Keys**: `course_id` → `courses(id)`
- **Constraints**: `UNIQUE(course_id, order_index)`
- **Indexes**: `course_id`, `(course_id, order_index)`

#### `lessons`
- **Primary Key**: `id` (UUID)
- **Foreign Keys**: `module_id` → `modules(id)`
- **Constraints**: `UNIQUE(module_id, order_index)`
- **Indexes**: `module_id`, `(module_id, order_index)`

#### `content_items`
- **Primary Key**: `id` (UUID)
- **Foreign Keys**: `lesson_id` → `lessons(id)`
- **Constraints**: 
  - `content_type` CHECK ('video', 'quiz', 'form')
  - `UNIQUE(lesson_id, order_index)`
- **Indexes**: `lesson_id`, `(lesson_id, order_index)`

#### `video_segments`
- **Primary Key**: `id` (UUID)
- **Foreign Keys**: `content_item_id` → `content_items(id)`
- **Constraints**:
  - `source` CHECK ('upload', 'google_drive', 'youtube')
  - `status` CHECK ('active', 'processing', 'failed')
- **Indexes**: `content_item_id`

#### `enrollments`
- **Primary Key**: `id` (UUID)
- **Foreign Keys**: 
  - `course_id` → `courses(id)`
  - `user_id` → `auth.users(id)`
- **Constraints**: `UNIQUE(course_id, user_id)`
- **Indexes**: `course_id`, `user_id`

#### `progress`
- **Primary Key**: `id` (UUID)
- **Foreign Keys**:
  - `enrollment_id` → `enrollments(id)`
  - `lesson_id` → `lessons(id)`
- **Constraints**: `UNIQUE(enrollment_id, lesson_id)`
- **Indexes**: `enrollment_id`, `lesson_id`

### Database Functions

#### `update_updated_at_column()`
- **Purpose**: Automatically update `updated_at` timestamp
- **Trigger**: Applied to all tables with `updated_at` column
- **Language**: PL/pgSQL

#### `handle_new_user()`
- **Purpose**: Create user profile on signup
- **Trigger**: `on_auth_user_created` after INSERT on `auth.users`
- **Language**: PL/pgSQL
- **Security**: `SECURITY DEFINER`

### Row Level Security (RLS)

**All tables have RLS enabled** with policies for:
- **Ownership-based access**: Users can manage their own resources
- **Public read access**: Published courses viewable by all
- **Enrollment-based access**: Users can view enrolled courses
- **Progress tracking**: Users can only view/update their own progress

---

## API & Integration

### Supabase Client (`lib/supabase.ts`)

#### Client-Side Client

```typescript
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
)
```

**Configuration:**
- Auto-refresh tokens
- Persist sessions in localStorage
- Detect session in URL (for OAuth callbacks)

#### Server-Side Client

```typescript
export const createServerClient = () => {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
```

**Usage**: API routes and server components
**Security**: Uses service role key (admin access)

#### Helper Functions

```typescript
// Get current authenticated user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

// Get user profile
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}
```

### Environment Variables

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

**Optional:**
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth redirect URI

---

## State Management

### Current Approach: Local Component State

**Pattern**: Each component manages its own state using React `useState`

#### Example: CreateCourse Component

```typescript
const [currentModule, setCurrentModule] = useState(0);
const [currentLesson, setCurrentLesson] = useState(0);
const [selectedContent, setSelectedContent] = useState(0);
const [isPlaying, setIsPlaying] = useState(false);
const [showVersions, setShowVersions] = useState(false);
const [driveConnected, setDriveConnected] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);
const [showUploadModal, setShowUploadModal] = useState(false);
const [uploadType, setUploadType] = useState<'file' | 'drive' | 'youtube'>('file');
const [courseData, setCourseData] = useState<{...}>({...});
```

#### Example: CoursifyLMS Component

```typescript
const [currentView, setCurrentView] = useState('dashboard');
const [sidebarOpen, setSidebarOpen] = useState(true);
const [showProfileModal, setShowProfileModal] = useState(false);
```

### State Flow

**Parent → Child**: Props passed down
**Child → Parent**: Callback functions passed as props
**Sibling Communication**: Through parent component state

### Future Considerations

- ❓ No global state management (Redux/Zustand) yet
- ❓ Consider context API for user authentication state
- ❓ Consider state management library for complex course editing

---

## Component Architecture

### Component Structure Pattern

```typescript
'use client'  // Client component directive

import React, { useState } from 'react';
import { ... } from 'lucide-react';

// Type definitions
interface Props { ... }

// Component
const ComponentName: React.FC<Props> = ({ ... }) => {
  // State declarations
  const [state, setState] = useState(...);
  
  // Event handlers
  const handleAction = () => { ... };
  
  // Computed values
  const filteredData = data.filter(...);
  
  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};

export default ComponentName;
```

### Component Communication

**Pattern**: Props and callbacks

```typescript
// Parent
<ChildComponent 
  data={data}
  onAction={handleAction}
  setCurrentView={setCurrentView}
/>

// Child
interface ChildProps {
  data: DataType;
  onAction: (param: Type) => void;
  setCurrentView: (view: string) => void;
}
```

---

## Data Flow Patterns

### Current: Mock Data Flow

```
Component State → UI Rendering → User Interaction → State Update → Re-render
```

### Target: Database Flow

```
User Action → Component Handler → Supabase Query → Database → Response → State Update → UI Update
```

### Example: Create Course Flow

```
1. User fills form → setCourseData({...})
2. User adds module → setCourseData(prev => ({...prev, modules: [...]}))
3. User saves → TODO: supabase.from('courses').insert({...})
4. Database returns → setCourseData with new ID
5. UI updates → Course appears in list
```

---

## Build & Deployment

### Build Configuration

**File**: `next.config.js`
```javascript
{
  reactStrictMode: true,
  // TODO: Add image domains when implementing file uploads
}
```

### TypeScript Configuration

**File**: `tsconfig.json`
- **Target**: ES5
- **Module**: ESNext
- **JSX**: Preserve (Next.js handles)
- **Strict**: Enabled
- **Paths**: `@/*` → root directory

### Tailwind Configuration

**File**: `tailwind.config.js`
- **Content**: Scans `pages/`, `components/`, `app/` directories
- **Theme**: Extended (minimal customizations)

### Build Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev` | Start development server (localhost:3000) |
| `build` | `next build` | Create production build |
| `start` | `next start` | Start production server |
| `lint` | `next lint` | Run ESLint |

### Build Output

- **Output Directory**: `.next/` (generated)
- **Static Assets**: `public/` (if exists)
- **Type Definitions**: `next-env.d.ts` (auto-generated)

---

## Security

### Authentication

**Current Status**: ❌ Not implemented
**Planned**: Supabase Auth
- Email/password authentication
- OAuth providers (Google for Drive integration)
- Session management

### Row Level Security (RLS)

**Status**: ✅ Configured in database schema
**Tables**: All tables have RLS enabled
**Policies**: 
- Users can only access their own resources
- Published courses are publicly readable
- Progress tracking is user-specific

### Environment Variables

**Client-Side**: `NEXT_PUBLIC_*` variables exposed to browser
**Server-Side**: Service role key never exposed to client
**Security**: Service role key only in server-side code

---

## Performance Considerations

### Code Splitting

**Current**: All components loaded upfront
**Opportunity**: Lazy load page components

```typescript
// Potential optimization
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreateCourse = lazy(() => import('./pages/CreateCourse'));
```

### Image Optimization

**Status**: ❌ Not configured
**TODO**: Configure Next.js image domains in `next.config.js`

### Database Queries

**Current**: Mock data (no queries)
**Target**: Optimized queries with:
- Proper indexes (already defined)
- Query batching
- Pagination for large datasets

---

## Error Handling

### Current State

**Pattern**: Minimal error handling
- Console warnings for missing Supabase config
- No error boundaries
- No loading states

### Recommended Patterns

```typescript
// Error Boundary (TODO)
<ErrorBoundary fallback={<ErrorUI />}>
  <Component />
</ErrorBoundary>

// Loading States (TODO)
{loading && <LoadingSpinner />}
{error && <ErrorMessage error={error} />}

// Try-Catch (TODO)
try {
  const data = await supabase.from('courses').select();
} catch (error) {
  // Handle error
}
```

---

## Testing

### Current Status

**Tests**: ❌ None
**Test Framework**: Not configured
**Coverage**: 0%

### Recommended Setup

- **Unit Tests**: Jest + React Testing Library
- **E2E Tests**: Playwright or Cypress
- **Test Location**: `__tests__/` or `*.test.tsx`

---

## Development Workflow

### Local Development

1. **Install dependencies**: `npm install`
2. **Set up environment**: Copy `env.template` to `.env.local`
3. **Configure Supabase**: Follow `BACKEND_SETUP.md`
4. **Start dev server**: `npm run dev`
5. **Access**: http://localhost:3000

### Code Quality

- **Linting**: ESLint with Next.js config
- **Type Checking**: TypeScript strict mode
- **Formatting**: ❓ No formatter configured (Prettier recommended)

---

## Technical Debt

### High Priority

1. **Authentication**: Implement Supabase Auth
2. **Database Integration**: Replace mock data with queries
3. **Error Handling**: Add error boundaries and loading states
4. **File Uploads**: Implement Supabase Storage integration

### Medium Priority

1. **State Management**: Consider global state solution
2. **Code Splitting**: Lazy load page components
3. **Image Optimization**: Configure Next.js image domains
4. **Form Validation**: Add validation logic

### Low Priority

1. **Testing**: Set up test framework
2. **Performance**: Optimize bundle size
3. **Accessibility**: Add ARIA labels and keyboard navigation
4. **Documentation**: Add JSDoc comments

---

## Open Questions

❓ **State Management**: Will we add Redux/Zustand for global state?  
❓ **API Routes**: Will we use Next.js API routes or direct Supabase calls?  
❓ **Image Handling**: How will course thumbnails be stored and served?  
❓ **Video Processing**: How will micro-video stitching be implemented?  
❓ **Google Drive**: Will we use Google Drive API or Supabase Storage?  
❓ **Caching**: What caching strategy for course data?  
❓ **Monitoring**: What error tracking and analytics tools?

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Supabase client configuration |
| `lib/database.types.ts` | TypeScript database types |
| `database/schema.sql` | Database schema definition |
| `components/CoursifyLMS.tsx` | Main app orchestrator |
| `components/pages/*.tsx` | Page components |
| `app/page.tsx` | Next.js entry point |
| `app/layout.tsx` | Root layout |
| `next.config.js` | Next.js configuration |
| `tsconfig.json` | TypeScript configuration |
| `tailwind.config.js` | Tailwind CSS configuration |

---

**Status**: Technical Reference Complete  
**Next**: `/gaps` to identify documentation gaps and clarifications needed
