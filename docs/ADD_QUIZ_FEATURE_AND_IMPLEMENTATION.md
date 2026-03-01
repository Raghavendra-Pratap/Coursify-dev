# Add Quiz feature – implementation and context

This document describes the **Add Quiz** feature (Google Form–based quizzes with optional webhook scoring) and how it is implemented, so development can continue without losing context.

---

## 1. Feature overview

- **What it is:** A lesson content type that embeds a **Google Form** as a quiz. Creators add a quiz by providing a **Quiz title**, **Google Form URL**, and **Passing score**. Learners see the form embedded in Take Course and click **Continue** when done.
- **Optional: Record scores in Coursify.** If the creator sets up a hidden field in the form and adds our Apps Script (with an **On form submit** trigger), each submission can send **score** and **passed** to our webhook. We then update progress (quiz_score, quiz_passed) for that enrollment and content item. This uses a **signed one-time token** so we never trust client-supplied identifiers.

**Current UI state:** The **Add Quiz** button is **hidden** in the Create Course lesson content area. Only **Add Video**, **Add Form**, and **Add Reading** are shown. All quiz logic (modal, save/load, webhook, TakeCourse rendering) remains in the codebase so it can be re-enabled in a future release.

---

## 2. Architecture and security approach

### 2.1 Why we use a token (not form ID or user ID in the body)

- The webhook receives only **token + score + passed** from the form’s Apps Script. It does **not** accept quiz ID or user ID in the request body.
- The **token** is created server-side (after auth) and encodes:
  - `enrollment_id` (which user in which course)
  - `content_item_id` (which quiz/lesson step)
  - `exp` (expiry, e.g. 2 hours)
- The webhook **verifies the signature** (HMAC-SHA256 with `WEBHOOK_QUIZ_SECRET`) and **decodes** the token to get enrollment and content item. So we never use unverified input for DB keys or process control; this prevents injection and backtracking.

### 2.2 One-time use and replay protection

- Each token is **single-use**. After a successful webhook call we store `SHA-256(token)` in the table `webhook_quiz_token_used`. A duplicate token returns **409** and is not processed again.

### 2.3 Validation and rate limiting

- **Body:** `score` must be 0–100, `passed` must be boolean. Optional `submissionId` alphanumeric + `_-` only, max 128 chars.
- **Rate limiting:** The webhook endpoint is rate-limited (e.g. 10 requests per minute per client IP) to reduce abuse.

### 2.4 Flow summary

1. **Creator** (when feature is enabled): Add Quiz → Quiz title, Google Form URL, Passing score. Optionally expand “Record scores in Coursify” → paste hidden field **entry ID** → **Copy Apps Script** → paste in form’s Apps Script and add **On form submit** trigger.
2. **Learner** opens quiz in Take Course → frontend calls `GET /api/learning/quiz-submit-token?enrollmentId=…&contentItemId=…` (auth required) → receives token → iframe URL is form embed URL + `&entry.<entryId>=<token>` so the hidden field is pre-filled.
3. **Learner** submits form → Google runs Apps Script → script reads token from hidden field, computes score (0–100) and passed → `POST /api/webhooks/google-form-quiz` with `{ token, score, passed }`.
4. **Webhook:** Rate limit → verify token → check token hash not in `webhook_quiz_token_used` → validate score/passed → insert into `webhook_quiz_token_used` → resolve quiz/lesson from token’s `content_item_id` → insert `quiz_attempts` (if used) → upsert `progress` (quiz_score, quiz_passed).

---

## 3. Data model and database

### 3.1 Existing tables

- **quizzes** (content item–level): `content_item_id`, `title`, `passing_score`, `form_url`, and optionally **`form_entry_id_webhook`** (Google Form hidden field entry ID for token pre-fill).
- **progress** (per enrollment): includes `quiz_score`, `quiz_passed` for the lesson/content.
- **quiz_attempts** (if present): stores individual attempt records; webhook may insert here.

### 3.2 Migrations to run (when enabling the feature)

Run these in Supabase (or your Postgres) if not already applied:

**`database/WEBHOOK_QUIZ_TOKEN_USED.sql`**

```sql
CREATE TABLE IF NOT EXISTS webhook_quiz_token_used (
  token_hash TEXT PRIMARY KEY,
  used_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`database/ADD_QUIZ_WEBHOOK_ENTRY.sql`**

```sql
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS form_entry_id_webhook TEXT;
```

---

## 4. Key files and responsibilities

| Path | Purpose |
|------|--------|
| **`lib/webhook-quiz-token.ts`** | `signQuizToken(enrollmentId, contentItemId)`, `verifyQuizToken(token)`, `hashToken(token)`. HMAC-SHA256, 2h TTL. Requires `WEBHOOK_QUIZ_SECRET` (min 32 chars). |
| **`app/api/learning/quiz-submit-token/route.ts`** | GET, auth required. Query: `enrollmentId`, `contentItemId`. Verifies user owns enrollment and content item is a quiz in that course. Returns `{ token }` from `signQuizToken`. |
| **`app/api/webhooks/google-form-quiz/route.ts`** | POST, no auth (auth is the token). Body: `{ token, score, passed, submissionId? }`. Rate limit → verify token → replay check → validate → persist (webhook_quiz_token_used, progress, optionally quiz_attempts). |
| **`app/api/learning/courses/[courseId]/lessons/[lessonId]/route.ts`** | GET lesson content. Returns `contentItems` (quizzes include `form_entry_id_webhook` from DB) and **`enrollmentId`** so the frontend can request the quiz token. |
| **`app/api/instructor/courses/[courseId]/structure/route.ts`** | POST structure save. When inserting quizzes, includes **`form_entry_id_webhook`** from payload. |
| **`components/pages/CreateCourse.tsx`** | Quiz modal (`showQuizModal`), state: title, form URL, passing score, `formEntryIdWebhook`, script copied, `quizModalRecordScoresOpen`. **Add Quiz button is removed from the UI** (only Add Video, Add Form, Add Reading shown). Modal still exists; “Record scores in Coursify” is a collapsible section with entry ID field and **Copy Apps Script** (script uses `window.location.origin` + `/api/webhooks/google-form-quiz` and pre-fills entry ID and passing score). Load/save: quiz includes `formEntryIdWebhook`; structure save and client-side Supabase insert persist `form_entry_id_webhook`. |
| **`components/pages/TakeCourse.tsx`** | `enrollmentIdForLesson` from lesson API response. For quiz step: if `step.item.quiz.form_entry_id_webhook` is set, uses **`QuizEmbedWithWebhookToken`** (fetches token from quiz-submit-token, builds iframe URL with `entry.<entryId>=<token>`); else plain iframe with form URL. **Continue** button advances step/lesson. |

---

## 5. Environment

- **`WEBHOOK_QUIZ_SECRET`** (optional but required for webhook): Server-side secret, at least 32 characters, used to sign and verify quiz tokens. Documented in `.env.example`. If not set, token issuance and webhook will fail when used.

---

## 6. Re-enabling the Add Quiz button

To show **Add Quiz** again in the Create Course UI:

1. In **`components/pages/CreateCourse.tsx`**, in the “Add Content Buttons” section (around the flex with Add Video, Add Form, Add Reading), add back the quiz button between **Add Video** and **Add Form**:

```tsx
<button
  onClick={() => handleAddContent('quiz')}
  className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-semibold flex items-center transition-all shadow-lg"
>
  <HelpCircle className="w-5 h-5 mr-2" />
  Add Quiz
</button>
```

2. Ensure migrations above are applied and `WEBHOOK_QUIZ_SECRET` is set in the environment where the webhook is used.

---

## 7. Creator-facing documentation

- **`docs/QUIZ_WEBHOOK_GOOGLE_FORMS.md`** – Full guide for instructors: how differentiation works (token = quiz + user), adding the hidden field, getting entry ID, setting webhook entry ID in Coursify, and step-by-step “Add the script to this Google Form” (Extensions → Apps Script, paste script, add On form submit trigger). Includes optional “Record scores” flow and security notes.

---

## 8. Future directions (for next versions)

- **In-house quiz builder:** Native Coursify quizzes (questions stored in DB, rendered in TakeCourse, scored by our API) using a schema similar to the Google Sheet “FormQuestions” (Section, Type, Title, Required, Options, CorrectAnswer, Points). No Google Form or webhook required for basic flow.
- **Import from Google Sheet:** If Sheets API is integrated, “Import quiz from Sheet” could read a “FormQuestions” sheet and map rows into in-house quiz structure.
- **Form ID from URL:** We could parse and store Google Form ID from the form URL for display or analytics; it does not replace the need for **entry ID** for token pre-fill (pre-fill uses `entry.<entryId>=<token>` and entry ID is per-question, not in the form URL).

---

## 9. Quick reference: differentiation and security

- **Differentiation:** Token payload = `enrollment_id` + `content_item_id`. Webhook decodes token server-side; no quiz ID or user ID from request body. One script per form; entry ID and passing score differ per form (Copy Apps Script pre-fills both).
- **Security:** Signed token (HMAC-SHA256); one-time use (webhook_quiz_token_used); strict validation (score 0–100, passed boolean); rate limiting; no raw user input used for DB keys or process control.

This document should be enough to resume Add Quiz development or extend it (e.g. in-house quizzes) without losing the current context and implementation details.
