# Clarifications Needed: Coursify LMS

**Last Updated**: Current Session  
**Purpose**: Consolidate all questions and identify what needs developer clarification  
**Status**: ✅ Developer answers received. Gap analysis updated below.

---

## Answers Summary (Developer-Provided)

| Area | Decision |
|------|----------|
| **Codebase** | `coursify-app/` is the **final product** — test and fine-tune there for release. |
| **Routing** | Use **coursify-app/ structure** (Next.js App Router). |
| **Auth** | Use **existing auth from coursify-app/** (yes). |
| **User profile** | Build when required; "John Doe" / "Jane Doe" is placeholder for now. |
| **Schema** | Explore and tweak as per requirements (no single source yet). |
| **Mock data / DB** | Build as needed; plan priorities accordingly. |
| **Micro-video** | **Timestamp-based streaming** (avoid live merging/stitching). |
| **Storage** | **Google Drive** for now; Supabase/others later. **Primary sources: Google Drive, YouTube**; open to others later. |
| **Components** | Reuse from coursify-app (e.g. GoogleDrivePicker) — yes. |
| **State / API / Validation / Errors / Loading / Formatting / Tests / etc.** | Explore options; plan and implement when needed. |

---

## Summary

**Total Questions**: 25  
**Answered**: 25  
- **🔴 Must Answer (Blocking)**: 8 — all answered
- **🟡 Should Answer (Important)**: 10 — all answered
- **🟢 Nice to Know**: 7 — all answered

---

## 🔴 Must Answer (Blocking)

### Architecture & Structure

- [x] **`coursify-app/` Directory Purpose**
  - **Answered**: `coursify-app/` is the final product where we test and fine-tune for release (see "Which Codebase is Active?").
  - **Context**: Complete alternative implementation with auth, MicroVideoPlayer, GoogleDrivePicker, own schema.
  - **Files**: `coursify-app/README.md`, `coursify-app/app/auth/`, `coursify-app/components/`

- [x] **Routing Strategy Decision**
  - **Answered**: Use **coursify-app/ structure** (Next.js App Router).
  - **Context**: Root uses SPA view switching; coursify-app uses `/auth/login`, `/dashboard/courses`, etc.

- [x] **Which Codebase is Active?**
  - **Answered**: **coursify-app/** is the active/final codebase for testing and release; root is not the primary product.
  - **Context**: Two implementations exist; coursify-app chosen as the one to develop and release.

### Authentication Implementation

- [x] **Authentication Approach**
  - **Answered**: **Yes** — use existing auth implementation from coursify-app/.
  - **Context**: coursify-app has auth routes and auth-context.tsx; root has none.

- [x] **User Profile Data Source**
  - **Answered**: Build when required; "John Doe" / "Jane Doe" is placeholder during development.
  - **Context**: Hardcoded in CoursifyLMS; Supabase Auth integration deferred until needed.

### Database Integration

- [x] **Database Schema Alignment**
  - **Answered**: Explore and **tweak schema as per requirements** (no fixed “correct” schema yet).
  - **Context**: Two schema files (root vs coursify-app); align/evolve as needed.

- [x] **Mock Data Replacement Timeline**
  - **Answered**: Development stage — **build as and when required**; plan priorities accordingly.
  - **Context**: All page components use mock data; persistence not on a fixed timeline.

### Critical Features

- [x] **Micro-Video Implementation Strategy**
  - **Answered**: Prefer **timestamp-based streaming**; avoid heavy live video merging/stitching.
  - **Context**: coursify-app has MicroVideoPlayer and video-utils; root has CreateCourse UI. Align with streaming approach.

---

## 🟡 Should Answer (Important)

### Implementation Details

- [x] **State Management Strategy** — **Answered**: Yet to plan; explore options.
- [x] **API Route Strategy** — **Answered**: Explore options; yet to plan and implement.
- [x] **Google Drive Integration Approach** — **Answered**: coursify-app is final product; use/carry over existing GoogleDrivePicker there.
- [x] **Component Reusability** — **Answered**: Yes, extract and reuse components from coursify-app (CourseEditor, LessonEditor, VideoSegmentEditor, ModuleEditor, etc.).

### Data & Storage

- [x] **File Upload Implementation** — **Answered**: Use **Google Drive for now**; plan Supabase/other storage later.
- [x] **Image/Thumbnail Handling** — **Answered**: Explore options; yet to plan and implement.
- [x] **Video Storage Strategy** — **Answered**: **Primary: Google Drive, YouTube**; open to other sources later.

### User Experience

- [x] **Form Validation Strategy** — **Answered**: Explore options; yet to plan and implement.
- [x] **Error Handling Approach** — **Answered**: Explore options; yet to plan and implement.
- [x] **Loading State Strategy** — **Answered**: Explore options; yet to plan and implement.

---

## 🟢 Nice to Know

- [x] **Code Formatting (Prettier)** — **Answered**: Explore options; yet to plan and implement.
- [x] **Testing Strategy** — **Answered**: Explore options; yet to plan and implement.
- [x] **Documentation Standards (JSDoc)** — **Answered**: Explore options; yet to plan and implement.
- [x] **Code Splitting** — **Answered**: Explore options; yet to plan and implement.
- [x] **Caching Strategy** — **Answered**: Explore options; yet to plan and implement.
- [x] **Analytics & Monitoring** — **Answered**: Explore options; yet to plan and implement.
- [x] **Environment Configuration** — **Answered**: Explore options; yet to plan and implement.

---

## Gap Analysis After Answers

Based on your answers, the following gaps and implications are clear.

### Resolved (No Longer Blocking)

| Item | Resolution |
|------|------------|
| Which codebase to use | **coursify-app/** is the final product. |
| Routing | Use **coursify-app/** App Router structure. |
| Auth | Use **existing auth** from coursify-app. |
| Micro-video approach | **Timestamp-based streaming** (no live stitching). |
| Primary storage | **Google Drive** for now; **YouTube** as primary source; others later. |
| Schema | **Tweak as needed**; no single canonical schema yet. |
| Reuse | **Reuse** coursify-app components (GoogleDrivePicker, CourseEditor, etc.). |

### Remaining Gaps (Actionable)

1. **Consolidation / migration path**
   - **Root** has: Dashboard (stats, charts), MyCourses (grid/list, filters), Learners (invite, CSV, profile modal), Analytics (multi-view), Reports (templates, scheduling), CreateCourse (full drag-drop, version history, multi-source upload UI).
   - **coursify-app** has: Auth, App Router, dashboard, dashboard/admin, dashboard/courses, dashboard/learn, CourseEditor, MicroVideoPlayer, GoogleDrivePicker, etc.
   - **Gap**: No single place has “everything.” To make coursify-app the final product, you need a **plan to port or reimplement** root-only features (Learners, Reports, Analytics, richer Dashboard/MyCourses/CreateCourse UI) **into coursify-app**, or accept that those live only at root until ported.

2. **Pages missing in coursify-app**
   - **Learners** (invite, list, profile) — not present in coursify-app routes.
   - **Reports** (templates, schedule, generate) — not present; coursify-app has AdminDashboard only.
   - **Analytics** (overview, engagement, completion, performance) — coursify-app has AdminDashboard, not the same as root’s Analytics page.
   - **Gap**: Decide which of these are required in the final product and add them to coursify-app (by porting from root or rebuilding).

3. **Timestamp-based streaming — implementation detail**
   - **coursify-app** `MicroVideoPlayer` already supports `startTime` / `endTime` (single segment); `video-utils.ts` has `stitchVideoSegments` (not implemented; you prefer not to rely on stitching).
   - **Gap**: For a **lesson with multiple segments** (e.g. segment A 0–30s, segment B 45–60s), confirm: play **sequentially in one player** (playlist of segments) or one segment per screen? MicroVideoPlayer has a TODO: “Trigger next segment playback if in playlist mode.” This affects whether playlist-style playback is in scope.

4. **Schema alignment**
   - Root `database/schema.sql`: `start_time_seconds` / `end_time_seconds` (integer).
   - coursify-app `database/schema.sql`: `start_time` / `end_time` (numeric).
   - **Gap**: When consolidating or sharing types, **pick one naming/convention** and align both schemas (or document which app uses which).

5. **Root codebase role**
   - **Gap**: Clarify whether root should be **archived**, **kept as UI reference only**, or **actively merged** into coursify-app and then deprecated.

### Recommended Next Steps

1. **Decide consolidation approach**: Port root pages/UI into coursify-app vs. rebuild in coursify-app vs. keep both and document which is “source” for which feature.
2. **Prioritize missing pages in coursify-app**: Learners, Reports, Analytics — which are must-have for first release?
3. **Confirm segment playback**: Single-segment only, or sequential (playlist) segment playback for multi-segment lessons?
4. **Align schema** (and types): One convention for segment times; update root and coursify-app schemas/docs accordingly.

---

## New / Follow-up Questions (Post-Answers)

These came up from your answers; answering them will narrow remaining gaps.

1. **Consolidation**: Should we **port** root’s Dashboard, MyCourses, Learners, Analytics, Reports, and CreateCourse UI **into coursify-app** so the final product has one codebase with all features? Or develop new versions only inside coursify-app and treat root as reference/archive?
2. **Learners / Reports / Analytics in final product**: Are Learners, Reports, and the detailed Analytics page (from root) required in coursify-app for first release? If yes, should we port from root or rebuild?
3. **Multi-segment playback**: For a lesson with multiple video segments, should the player **auto-advance to the next segment** (playlist mode), or is one-segment-at-a-time enough for now?
4. **Root after consolidation**: Once coursify-app has the features you need, should the root-level app and `components/` be **archived or removed** to avoid confusion?

---

## Inconsistencies Found

| Location 1 | Location 2 | Inconsistency |
|------------|------------|---------------|
| `components/CoursifyLMS.tsx` | `coursify-app/app/` | Different routing approaches (SPA vs App Router) |
| `database/schema.sql` | `coursify-app/database/schema.sql` | Two separate schema files - need to verify if same |
| `lib/supabase.ts` | `coursify-app/lib/supabase-client.ts` | Different Supabase client implementations |
| `components/pages/CreateCourse.tsx` | `coursify-app/components/CourseEditor.tsx` | Different course editing implementations |
| Root `package.json` | `coursify-app/package.json` | May have different dependencies |

---

## Orphaned Code

Code that exists but has no clear purpose or isn't referenced.

| File/Code | Observation |
|-----------|-------------|
| `coursify-app/` directory | Complete alternative implementation - unclear if it's being used or should be removed |
| `sample ui/` directory | Reference mockups - may be safe to archive once implementation is complete |
| `StatCard` component in `CoursifyLMS.tsx` | Defined but not used (may have been used in original sample) |
| Multiple analysis `.md` files in root | `differentiation_analysis.md`, `hosting_options.md`, etc. - planning docs that may be archived |

---

## Missing Code

Code that is referenced but doesn't exist.

| Reference | Expected Location | Status |
|------------|-------------------|--------|
| Authentication pages | `app/auth/login`, `app/auth/signup` | ❌ Missing (exists in `coursify-app/`) |
| API routes for auth | `app/api/auth/` | ❌ Missing (exists in `coursify-app/`) |
| Error boundaries | Anywhere | ❌ Missing |
| Loading components | Anywhere | ❌ Missing |
| Form validation | Form components | ❌ Missing |
| Video player component | `components/` | ❌ Missing (exists in `coursify-app/`) |
| Google Drive picker | `components/` | ❌ Missing (exists in `coursify-app/`) |
| Image upload handler | Anywhere | ❌ Missing |
| Video processing utilities | `lib/` | ❌ Missing (exists in `coursify-app/lib/video-utils.ts`) |

---

## TODO Items Summary

### High Priority (Blocking Features)

From codebase analysis, these TODOs are critical:

1. **Authentication** (`components/CoursifyLMS.tsx:95, 103, 214`)
   - Replace hardcoded user data
   - Implement logout functionality
   - Phase: Sprint 3-4

2. **Database Integration** (All page components)
   - Replace mock data with Supabase queries
   - Phase: Sprint 3-4, 9-10

3. **File Uploads** (`components/pages/CreateCourse.tsx:355`)
   - Implement file upload/YouTube/Drive integration
   - Phase: Sprint 5-8

4. **Google Drive OAuth** (`components/pages/CreateCourse.tsx:483`)
   - Implement Google Drive OAuth
   - Phase: Sprint 7-8

5. **Course Saving** (`components/pages/CreateCourse.tsx:490, 495`)
   - Save to Supabase
   - Publish course functionality
   - Phase: Sprint 3-4

### Medium Priority

6. **Quiz Creation** (`components/pages/CreateCourse.tsx:1341`)
   - Implement quiz creation logic
   - Phase: Not specified

7. **Email Invitations** (`components/pages/Learners.tsx:220`)
   - Send invitations via email API
   - Phase: Sprint 9-10

8. **Image Domains** (`next.config.js:4`)
   - Configure image domains for file uploads
   - Phase: When implementing uploads

### Lower Priority

9. **Report Generation** (`components/pages/Reports.tsx:27`)
   - Fetch reports from Supabase
   - Phase: Phase 2

10. **Analytics Data** (`components/pages/Analytics.tsx:18`)
    - Fetch analytics from Supabase
    - Phase: Phase 2, Month 5

---

## Recommendations

### Immediate Actions (Updated After Your Answers)

1. ~~Clarify coursify-app/ purpose~~ — **Done**: coursify-app is the final product.
2. ~~Routing strategy~~ — **Done**: Use coursify-app App Router structure.
3. ~~Auth approach~~ — **Done**: Use existing auth from coursify-app.
4. **Consolidation**: Decide how root’s pages (Dashboard, MyCourses, Learners, Analytics, Reports, CreateCourse) map into coursify-app (port vs. rebuild vs. reference). See **New / Follow-up Questions** above.
5. **Schema**: When touching DB, align segment time columns (`start_time` / `end_time` vs `start_time_seconds` / `end_time_seconds`) and document one convention.

### Development Priorities (Aligned With Your Answers)

1. **Foundation (coursify-app)**
   - Keep using existing auth; add user profile when needed.
   - Use coursify-app schema; tweak as requirements evolve.
   - Connect features to DB as and when required; plan order as you go.

2. **Core: Timestamp-based streaming**
   - Rely on **single URL + start/end time** in player (no server-side stitching).
   - Use/adapt coursify-app `MicroVideoPlayer`; clarify playlist (multi-segment) behavior if needed.

3. **Storage & integrations**
   - **Primary**: Google Drive, YouTube.
   - Use/adapt coursify-app `GoogleDrivePicker`; plan Supabase/other storage later.

4. **Missing pages in coursify-app**
   - Add Learners, Reports, Analytics to coursify-app if required for release (by porting from root or rebuilding).

---

## Questions for Developer (Legacy)

The following were the original questions; **all have been answered**. For **new** follow-up questions, see **New / Follow-up Questions (Post-Answers)** above.

### Critical — ✅ Answered

1. ~~What is coursify-app/?~~ — Final product for test and release.
2. ~~Routing?~~ — coursify-app App Router.
3. ~~Which codebase is active?~~ — coursify-app.
4. ~~Use existing auth?~~ — Yes.
5. ~~Which schema?~~ — Explore and tweak as needed.
6. ~~Reuse components from coursify-app?~~ — Yes.
7. ~~Micro-video strategy?~~ — Timestamp-based streaming.
8. ~~File storage?~~ — Google Drive (and YouTube) for now.

### Important / Nice to Have — ✅ Answered

All deferred to “explore options; plan and implement when needed.”

---

**Status**: Answers received; gap analysis updated.  
**Next Steps**: (1) Answer **New / Follow-up Questions** if you want to lock consolidation and scope. (2) Proceed with coursify-app as the single codebase; port or add Learners, Reports, Analytics as needed. (3) Align schema and timestamp-based streaming behavior when implementing.
