# Coursify — Assessment Pro Integration Development Guide

**Status:** Draft for Coursify developers  
**Last updated:** 2026-06-25  
**Partner system:** [Assessment Pro](https://github.com/Raghavendra-Pratap/assessment-pro)  
**Master integration plan:** [`ASSESSMENT_PRO_INTEGRATION.md`](ASSESSMENT_PRO_INTEGRATION.md)

This document describes **what Coursify must build** to integrate with Assessment Pro. Assessment Pro will deliver the APIs and embed surface described in the master plan; this guide covers your schema, APIs, UI, and webhooks.

---

## 1. Integration summary

You will support **two assessment types** linked to course content:

| Type | `access_mode` | Learner UX | Grading |
|------|---------------|------------|---------|
| **Module quiz** | `lms_embed` | iframe inside Take Course | AP auto-grades; **you grade** manual questions in Coursify |
| **Final / proctored exam** | `proctored_portal` | New tab → Assessment Pro portal | **AP grading UI** (link from instructor dashboard) |

**Unchanged:** Google Form quizzes for lightweight checks (existing webhook).

**You do not need** for module quizzes:

- Google OAuth for learners
- Proctoring
- Server-side email invitations
- Assessment Pro grading UI

---

## 2. Prerequisites (from Assessment Pro team)

Before development, obtain:

| Item | Purpose |
|------|---------|
| `ASSESSMENT_PRO_BASE_URL` | API + embed iframe origin |
| `ASSESSMENT_PRO_API_KEY` | Server-to-server calls (never in browser) |
| `ASSESSMENT_PRO_WEBHOOK_SECRET` | Verify inbound webhooks |
| `ASSESSMENT_PRO_COMPANY_SLUG` | v1 shared company: `coursify-bsoc-space` |
| At least one `lms_embed` assessment UUID | Testing embed flow |
| At least one `proctored_portal` assessment UUID | Testing final exam flow |

---

## 3. Database schema

### 3.1 `external_assessments`

Links a course content item to an Assessment Pro assessment.

```sql
CREATE TABLE IF NOT EXISTS external_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'assessment_pro' CHECK (provider IN ('assessment_pro')),
  assessment_pro_assessment_id UUID NOT NULL,
  company_slug TEXT NOT NULL DEFAULT 'coursify-bsoc-space',
  access_mode TEXT NOT NULL DEFAULT 'lms_embed'
    CHECK (access_mode IN ('lms_embed', 'proctored_portal')),
  passing_score INTEGER DEFAULT 70 CHECK (passing_score >= 0 AND passing_score <= 100),
  duration_minutes INTEGER,
  -- lms_embed: iframe in Take Course; proctored_portal: always new tab
  presentation TEXT NOT NULL DEFAULT 'embed'
    CHECK (presentation IN ('embed', 'new_tab')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (content_item_id),
  CONSTRAINT presentation_matches_mode CHECK (
    (access_mode = 'lms_embed' AND presentation = 'embed')
    OR (access_mode = 'proctored_portal' AND presentation = 'new_tab')
  )
);
```

**Notes**

- Sync `passing_score` from Assessment Pro at save time when possible; treat AP webhook `passed` as authoritative when present.
- `lms_embed` → `presentation = 'embed'` only.
- `proctored_portal` → `presentation = 'new_tab'` only.

### 3.2 `external_assessment_sessions`

Tracks learner attempts (replaces invitation-centric model for easy mode; also used for hard mode).

```sql
CREATE TABLE IF NOT EXISTS external_assessment_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  external_assessment_id UUID NOT NULL REFERENCES external_assessments(id) ON DELETE CASCADE,
  -- AP identifiers (set after launch or invitation)
  assessment_pro_session_id UUID,
  assessment_pro_invitation_id UUID,  -- hard mode only
  launch_token TEXT,                  -- easy mode; encrypt at rest
  candidate_token TEXT,               -- hard mode invitation token; encrypt at rest
  embed_url TEXT,
  take_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'in_progress',
    'submitted',
    'pending_manual_grade',
    'graded',
    'expired',
    'cancelled'
  )),
  auto_score NUMERIC,
  final_score NUMERIC,
  passed BOOLEAN,
  manual_grading_required BOOLEAN DEFAULT false,
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES auth.users(id),  -- Coursify instructor (easy mode manual)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (enrollment_id, external_assessment_id)
);
```

**Retake policy:** If you allow retakes, drop the unique constraint and add `attempt_number` or archive old rows before creating a new session.

### 3.3 `external_assessment_responses` (easy mode manual grading)

Store per-question answers when `manualGradingRequired` is true.

```sql
CREATE TABLE IF NOT EXISTS external_assessment_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES external_assessment_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  question_type TEXT NOT NULL,
  answer JSONB NOT NULL,
  auto_score NUMERIC,
  manual_score NUMERIC,
  max_score NUMERIC,
  needs_manual_grade BOOLEAN DEFAULT false,
  reviewer_notes TEXT,
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, question_id)
);
```

### 3.4 Content type

Add `content_type = 'assessment'` on `content_items` (or extend existing quiz type with `provider = 'assessment_pro'`). Recommended: dedicated `assessment` type to avoid conflating Google Form quizzes.

---

## 4. Environment variables

```env
# Assessment Pro integration (server-only)
ASSESSMENT_PRO_BASE_URL=https://assessments.bsoc.space
ASSESSMENT_PRO_COMPANY_SLUG=coursify-bsoc-space
ASSESSMENT_PRO_API_KEY=
ASSESSMENT_PRO_WEBHOOK_SECRET=
```

**Never** expose `ASSESSMENT_PRO_API_KEY` to the client. The browser only receives `embedUrl` or `takeUrl` from your launch API.

---

## 5. Server APIs to build (Coursify)

### 5.1 Launch — easy mode (`lms_embed`)

**`POST /api/learning/courses/{courseId}/assessments/{contentItemId}/launch`**

**Auth:** Coursify learner session + enrollment check.

**Flow:**

1. Load `external_assessments` for `contentItemId`; assert `access_mode = 'lms_embed'`.
2. Verify user is enrolled in `courseId`.
3. Upsert `external_assessment_sessions` for `(enrollment_id, external_assessment_id)`.
4. Call Assessment Pro:

   ```
   POST {ASSESSMENT_PRO_BASE_URL}/api/v1/integrations/lms/launch
   Authorization: Bearer {ASSESSMENT_PRO_API_KEY}
   ```

   Body:

   ```json
   {
     "assessmentId": "<assessment_pro_assessment_id>",
     "learner": {
       "email": "<user email>",
       "name": "<display name>",
       "externalUserId": "<coursify user id>"
     },
     "externalRef": {
       "enrollmentId": "<enrollment id>",
       "contentItemId": "<content item id>",
       "courseId": "<course id>"
     }
   }
   ```

5. Store `launch_token`, `embed_url`, `assessment_pro_session_id`; set status `in_progress`.
6. Return to client:

   ```json
   {
     "embedUrl": "https://assessments.example.com/embed/assessment/...",
     "sessionId": "<coursify session row id>",
     "expiresAt": "..."
   }
   ```

**Reuse:** If an active session exists and AP allows resume, return existing `embedUrl` instead of creating a duplicate.

### 5.2 Launch — hard mode (`proctored_portal`)

**Same route** or dedicated `.../launch-exam` — branch on `access_mode`.

**Flow:**

1. Assert `access_mode = 'proctored_portal'`.
2. Verify enrollment.
3. Call Assessment Pro M2M invitation API:

   ```
   POST {ASSESSMENT_PRO_BASE_URL}/api/v1/integrations/lms/invitations
   Authorization: Bearer {ASSESSMENT_PRO_API_KEY}
   ```

   Body:

   ```json
   {
     "assessmentId": "<uuid>",
     "email": "<learner email>",
     "candidateName": "<name>",
     "skipEmail": true,
     "allowDuplicate": false,
     "externalRef": {
       "enrollmentId": "...",
       "contentItemId": "...",
       "coursifyUserId": "...",
       "courseId": "..."
     }
   }
   ```

4. Store `candidate_token`, `take_url`, `assessment_pro_invitation_id`.
5. Return `{ "takeUrl": "...", "openInNewTab": true }`.

### 5.3 Webhook receiver

**`POST /api/webhooks/assessment-pro`**

Mirror your existing `app/api/webhooks/google-form-quiz/route.ts` pattern.

**Verify:**

```typescript
const auth = request.headers.get("authorization");
const expected = `Bearer ${process.env.ASSESSMENT_PRO_WEBHOOK_SECRET}`;
if (auth !== expected) return Response.json({ error: "Unauthorized" }, { status: 401 });
```

**Handler logic by `accessMode`:**

#### `lms_embed` + `event: session.submitted`

1. Resolve session via `externalRef.enrollmentId` + `externalRef.contentItemId`.
2. Upsert responses into `external_assessment_responses` when `responses[]` is present.
3. If `manualGradingRequired === false`:
   - Set `final_score`, `passed`, status `graded`
   - Update `progress` / `quiz_attempts` (same as Google Form webhook)
   - Mark lesson complete if `passed === true` and policy requires it
4. If `manualGradingRequired === true`:
   - Set status `pending_manual_grade`
   - **Do not** mark lesson complete yet
   - Notify instructor (optional)

#### `proctored_portal` + `event: session.submitted`

- Set status `submitted`
- Show learner “Awaiting review” in Take Course
- **Do not** update pass/fail yet

#### `proctored_portal` + `event: session.graded`

- Set `final_score`, `passed`, `graded_at`, status `graded`
- Update progress / completion

**Idempotency:** Key on `(sessionId, event)` or store `webhook_event_id` to ignore duplicates.

### 5.4 Manual grading API (easy mode)

**`GET /api/instructor/courses/{courseId}/assessments/pending-grades`**

List sessions with `status = 'pending_manual_grade'`.

**`POST /api/instructor/assessments/sessions/{sessionId}/grade`**

Body:

```json
{
  "responses": [
    { "questionId": "uuid", "manualScore": 8, "reviewerNotes": "..." }
  ],
  "finalScore": 85,
  "passed": true
}
```

**Flow:**

1. Validate instructor owns course.
2. Update `external_assessment_responses` rows.
3. Compute or accept `finalScore` / `passed` (compare to `external_assessments.passing_score`).
4. Set session `graded`, `graded_at`, `graded_by`.
5. Update learner `progress` / completion.

Optional: `POST` final grade back to Assessment Pro for audit (not required for v1 if Coursify is source of truth for course progress).

---

## 6. UI components

### 6.1 Take Course — module quiz (`lms_embed`)

1. Learner opens assessment content step.
2. Call your launch API; show loading state.
3. Render iframe:

   ```tsx
   <iframe
     src={embedUrl}
     title="Assessment"
     className="w-full min-h-[600px] border-0 rounded-lg"
     allow="clipboard-read; clipboard-write"
   />
   ```

4. Listen for `postMessage` (optional, when AP implements it):

   ```typescript
   useEffect(() => {
     function onMessage(event: MessageEvent) {
       if (event.origin !== process.env.NEXT_PUBLIC_ASSESSMENT_PRO_ORIGIN) return;
       if (event.data?.type === "assessment-pro:submitted") {
         // Refresh progress UI; webhook is still source of truth for persistence
       }
     }
     window.addEventListener("message", onMessage);
     return () => window.removeEventListener("message", onMessage);
   }, []);
   ```

5. States to show:
   - **In progress** — iframe visible
   - **Submitted / pending manual grade** — “Submitted — your instructor will review short answers”
   - **Graded** — score / pass-fail per your UX policy

### 6.2 Take Course — final exam (`proctored_portal`)

1. Show CTA: “Start final exam” (not an iframe).
2. On click → launch API → `window.open(takeUrl, '_blank', 'noopener')`.
3. Copy: exam opens in Assessment Pro; requires Google sign-in and proctoring setup.
4. Poll session status or rely on webhooks for “Submitted” / “Graded” badges on the course page.

### 6.3 Create Course — authoring

**Add Assessment** (alongside Add Quiz):

| Field | Required | Notes |
|-------|----------|-------|
| Assessment type | Yes | Module quiz (`lms_embed`) vs Final exam (`proctored_portal`) |
| Assessment Pro ID | Yes (v1) | Paste UUID; phase 6: picker from AP list API |
| Passing score | Yes | Default 70; sync from AP when available |
| Title / description | Optional | Display in Take Course; AP title shown inside embed |

**Phase 6:** Call AP `POST /integrations/coursify/assessments` to create quiz assessments from your builder instead of paste-ID.

### 6.4 Instructor — analytics & grading

| View | Easy mode | Hard mode |
|------|-----------|-----------|
| Pending manual grades | Coursify grading queue | N/A |
| Submitted / awaiting AP review | N/A | Status badge + link to AP |
| Grade submission | Your grading UI | Link: `{ASSESSMENT_PRO_BASE_URL}/{companySlug}/grade/{invitationId}` |
| Per-learner status | `external_assessment_sessions.status` | Same table |

Instructors who grade hard-mode exams need Assessment Pro evaluator accounts on `coursify-main` (or shared grader login).

---

## 7. Progress & completion rules

| Event | Update `quiz_attempts`? | Mark lesson complete? | Update course completion? |
|-------|-------------------------|----------------------|---------------------------|
| Easy: auto-graded submit | Yes | If `passed` | Per your policy |
| Easy: manual grade complete | Yes | If `passed` | Per your policy |
| Hard: submit only | Optional (record attempt) | **No** | **No** |
| Hard: graded webhook | Yes | If `passed` | Per your policy |

Align field names with your existing Google Form webhook (`progress.quiz_score`, `progress.quiz_passed`, etc.).

---

## 8. Implementation phases (Coursify)

| Phase | Tasks | Effort |
|-------|-------|--------|
| **0** | Read this doc + master plan; obtain API keys and test assessment IDs | 0.5 day |
| **1** | DB migration (`external_assessments`, `external_assessment_sessions`) | 0.5 day |
| **2** | Launch API (`lms_embed`) + Take Course iframe | 1–1.5 days |
| **3** | Webhook handler + progress sync (auto-graded) | 1 day |
| **4** | `external_assessment_responses` + instructor grading UI | 1.5–2 days |
| **5** | Hard mode launch + new-tab CTA + graded webhook | 1–2 days |
| **6** | CreateCourse “Add Assessment” + content type | 1–2 days |

**Suggested order:** 0 → 1 → 2 → 3 (first end-to-end demo) → 4 → 5 → 6.

---

## 9. Security checklist

- [ ] `ASSESSMENT_PRO_API_KEY` only in server env / Edge secrets
- [ ] Launch API requires authenticated learner + valid enrollment
- [ ] Webhook verifies `Authorization: Bearer` secret
- [ ] Rate-limit `POST /api/webhooks/assessment-pro`
- [ ] Encrypt `launch_token` / `candidate_token` at rest (or store only AP session IDs if tokens are short-lived)
- [ ] Validate `event.origin` on `postMessage` if used
- [ ] Do not pass API key in iframe URL query params

---

## 10. Testing checklist

### Easy mode (`lms_embed`)

- [ ] Enrolled learner sees iframe; non-enrolled gets 403
- [ ] Complete auto-graded quiz → webhook → progress updated without page reload (or after refresh)
- [ ] Quiz with paragraph / file upload → `pending_manual_grade` → instructor grades in Coursify → progress updates
- [ ] Re-open lesson reuses or resumes session per policy
- [ ] Passing score respected for `passed` flag

### Hard mode (`proctored_portal`)

- [ ] CTA opens new tab to Assessment Pro
- [ ] Google OAuth + proctoring flow works on AP side
- [ ] Submit webhook sets “awaiting review”; lesson **not** auto-completed
- [ ] Graded webhook sets score and completion
- [ ] Instructor link opens AP grading UI

### Webhook

- [ ] Invalid secret → 401
- [ ] Duplicate delivery → idempotent (no double progress update)
- [ ] Malformed `externalRef` → log + 400 (no partial progress corruption)

---

## 11. Differences from original single-mode plan

| Original plan | Updated approach |
|---------------|------------------|
| All assessments via invitation + embed/tab choice | Easy: launch token + embed only; Hard: invitation + new tab only |
| Grading always in AP | Easy: Coursify grades manual items; Hard: AP portal |
| Google OAuth for all AP assessments | OAuth only for `proctored_portal` |
| `open_in_new_tab` boolean per content | Derived from `access_mode` |
| Poll invitation status | Webhooks primary; optional poll via your session table |

---

## 12. Reference files in Coursify repo

Use these as patterns when implementing:

| Pattern | Location |
|---------|----------|
| Inbound scoring webhook | `app/api/webhooks/google-form-quiz/route.ts` |
| Quiz webhook docs | `docs/QUIZ_WEBHOOK_GOOGLE_FORMS.md` |
| Take Course content rendering | Your existing content item / quiz step components |
| Progress updates | Same helpers used by Google Form webhook handler |

---

## 13. Questions for Assessment Pro team

1. Exact launch token TTL and retake semantics?
2. `postMessage` event shape and target origin?
3. When will `POST /integrations/coursify/assessments` (create from builder) be available?
4. Issued API key scopes (launch only vs launch + create + invitations)?
5. Staging `AUTH_URL` for integration testing before production?

---

## 14. Contact / alignment

- Master plan (both teams): [`ASSESSMENT_PRO_INTEGRATION.md`](ASSESSMENT_PRO_INTEGRATION.md)
- Assessment Pro API reference: `docs/API.md` in Assessment Pro repo
