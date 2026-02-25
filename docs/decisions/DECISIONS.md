# Decision Log: Coursify LMS

Decisions recovered from existing codebase and developer clarification.

---

## 2025-01-XX - Documented During Context Recovery

### Tech Stack
**Context:** Analyzed existing codebase and package.json  
**Decision:** 
- Frontend: Next.js 14 with React 18 and TypeScript
- Styling: Tailwind CSS
- Backend: Supabase (PostgreSQL)
- Icons: Lucide React
**Rationale:** Modern, type-safe stack with free-tier hosting options suitable for <1000 users

### Single-Page Application Architecture (Root Only — Superseded)
**Context:** Observed in `components/CoursifyLMS.tsx`  
**Decision:** Root app uses view-based routing with `currentView` state instead of Next.js App Router.  
**Rationale:** Historical. **Superseded:** Final product is coursify-app, which uses App Router (see Resolved Decisions below).

### Component Organization
**Context:** Observed pattern in codebase  
**Decision:** Page components in `components/pages/`, main orchestrator in `components/CoursifyLMS.tsx`  
**Rationale:** Established convention for organizing page-level components

### State Management
**Context:** Analyzed all components  
**Decision:** Local component state using React `useState` hooks, no global state management  
**Rationale:** Historical - predates documentation. May need refactoring for complex state.

### Database Schema Structure
**Context:** Analyzed `database/schema.sql`  
**Decision:** Hierarchical structure: Courses → Modules → Lessons → Content Items (videos/quizzes/forms)  
**Rationale:** Supports micro-video feature where lessons contain multiple content items that can be individually updated

### Micro-Video Architecture
**Context:** Core differentiating feature in CreateCourse component  
**Decision:** Lessons contain multiple content items (video segments, quizzes, forms) that can be reordered and individually updated  
**Rationale:** Enables updating specific video sections without re-recording entire videos - core product differentiator

### Drag-and-Drop Implementation
**Context:** Observed in CreateCourse component  
**Decision:** Custom drag-and-drop using native HTML5 Drag API, not a library  
**Rationale:** Lightweight implementation without external dependencies

### Type Safety
**Context:** Analyzed TypeScript usage  
**Decision:** TypeScript strict mode enabled, interfaces defined for all data structures  
**Rationale:** Type safety for complex nested data structures (Course → Module → Lesson → ContentItem)

### Row Level Security (RLS)
**Context:** Analyzed database schema  
**Decision:** RLS enabled on all tables with ownership-based and public read policies  
**Rationale:** Security best practice for multi-tenant application

### Mock Data Strategy
**Context:** All components use hardcoded mock data  
**Decision:** UI-first development approach - all UI complete before backend integration  
**Rationale:** Allows UI development to proceed independently of backend setup

### File Upload Strategy
**Context:** CreateCourse component supports three upload types  
**Decision:** Support multiple sources: direct file upload, Google Drive, YouTube  
**Rationale:** Flexibility for users and cost reduction (external storage)

### Version History
**Context:** Observed in CreateCourse component  
**Decision:** Version history UI implemented but not persisted  
**Rationale:** Feature planned but not yet connected to database

### Course Status
**Context:** Observed in course data structure  
**Decision:** Three statuses: 'draft', 'published', 'archived'  
**Rationale:** Standard LMS workflow for course lifecycle

---

## Resolved Decisions (Developer Clarification — Feb 2025)

### coursify-app/ as Final Product
**Context:** Two implementations exist (root vs coursify-app).  
**Decision:** **coursify-app/** is the **final product** — the codebase where we test and fine-tune for release.  
**Rationale:** Developer confirmed coursify-app is the local build used as the release target.

### Routing Strategy
**Context:** Root uses SPA view switching; coursify-app uses App Router.  
**Decision:** Use **coursify-app/ structure** — Next.js App Router (`/auth/login`, `/dashboard/courses`, etc.).  
**Rationale:** Developer chose coursify-app structure.

### Authentication Approach
**Context:** Auth exists in coursify-app; root has none.  
**Decision:** **Use existing auth** from coursify-app (auth routes + auth-context).  
**Rationale:** Developer confirmed: "Yes, I suggest so."

### User Profile & Mock Data
**Decision:** Build auth/profile integration **as and when required**; "John Doe" / "Jane Doe" is a placeholder for now. Mock data replacement and DB connection priorities to be planned as needed.  
**Rationale:** Development stage; no fixed sprint for these.

### Database Schema
**Decision:** **Explore and tweak** schema as per requirements; no single canonical schema yet. Align root vs coursify-app schema (e.g. segment time columns) when consolidating.  
**Rationale:** Developer: "We can explore and tweak it as per the requirements."

### Micro-Video Strategy
**Context:** video-utils had stitching TODOs; root has timestamp-based UI.  
**Decision:** **Timestamp-based streaming** — avoid heavy live video merging/stitching. Use single source URL + start/end time in player.  
**Rationale:** Developer: "Avoid heavy executions live video merging or stitching, and use timestamp-based streaming instead."

### Video / File Storage
**Decision:** **Primary sources: Google Drive, YouTube.** Use Google Drive for file storage for now; plan Supabase or other storage later. Open to other sources in future.  
**Rationale:** Developer specified Google Drive for now and primary sources as Google Drive + YouTube.

### Supabase scope (no content storage)
**Decision:** Supabase is used for **Auth** and **Database** only; course videos and thumbnails are stored in Google Drive, YouTube, or other external storage—not in Supabase Storage.  
**Rationale:** Aligns with BACKEND_SETUP and avoids Supabase Storage for content.

### Component Reuse
**Decision:** **Reuse components from coursify-app** (e.g. GoogleDrivePicker, CourseEditor, LessonEditor, VideoSegmentEditor, ModuleEditor).  
**Rationale:** Developer: "Yes, I guess so."

### State, API, Validation, Errors, Loading, etc.
**Decision:** **Explore options; plan and implement when needed** (state management, API route strategy, form validation, error handling, loading states, formatting, testing, caching, analytics, env/deployment).  
**Rationale:** Developer deferred these to later planning.

---

## Pending / Follow-up (Post-Answers)

### Consolidation Path
**Status:** ❓ Open  
**Question:** Port root’s Dashboard, MyCourses, Learners, Analytics, Reports, CreateCourse into coursify-app, or rebuild in coursify-app and treat root as reference? See `docs/CLARIFICATIONS.md` → "New / Follow-up Questions."

### Learners, Reports, Analytics in coursify-app
**Status:** ❓ Open  
**Question:** Are these pages required in the final product? If yes, port from root or rebuild?

### Multi-Segment Playback
**Status:** ❓ Open  
**Question:** For lessons with multiple segments, support playlist-style (auto-advance) or one segment at a time?

### Root Codebase After Consolidation
**Status:** ❓ Open  
**Question:** Archive or remove root-level app once coursify-app has the needed features?

---

*Add new decisions as development continues.*
