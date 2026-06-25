# Coursify × Assessment Pro — Integration Handoff

**From:** Assessment Pro team  
**To:** Coursify developers  
**Last updated:** 2026-06-18  
**Production:** https://coursify.bsoc.space · https://assessments.bsoc.space

Canonical deep-dive for Coursify implementation details: [`COURSIFY_DEVELOPMENT.md`](COURSIFY_DEVELOPMENT.md).  
Aligned partner plan: [`ASSESSMENT_PRO_INTEGRATION response.md`](ASSESSMENT_PRO_INTEGRATION%20response.md).

---

## Coursify implementation status (repo)

| Area | Status |
|------|--------|
| Env vars + webhook route | **Done** — deployed; production smoke test passed |
| DB (`external_assessments`, sessions, responses) | **Done** — migration `add_external_assessments` applied |
| Take Course: launch + iframe (`lms_embed`) | **Done** |
| Final exam: invitations + new tab (`proctored_portal`) | **Done** |
| Webhook → session / progress / grading queue | **Done** |
| Instructor grading panel (Create Course) | **Done** |
| Authoring: **paste UUID only** | **Done** |
| Authoring: picker / create / builder iframe | **Not started** — see §3 below |

Production smoke test (from repo root, after Vercel env is set):

```bash
npm run test:assessment-pro:prod
```

---

## 1. Credentials (secure channel only)

Share API key and webhook secret out-of-band (1Password, etc.) — **not** in Slack/email plaintext.

```env
ASSESSMENT_PRO_BASE_URL=https://assessments.bsoc.space
NEXT_PUBLIC_ASSESSMENT_PRO_ORIGIN=https://assessments.bsoc.space
ASSESSMENT_PRO_API_KEY=<shared secret>
ASSESSMENT_PRO_WEBHOOK_SECRET=<shared secret>
ASSESSMENT_PRO_COMPANY_SLUG=coursify-bsoc-space
```

| Secret | Who sets | Notes |
|--------|----------|--------|
| API key | AP issues | Same value on both sides; server-side only |
| Webhook secret | AP issues | Same value on both sides |

On AP (`web/.env.production`): `COURSIFY_INTEGRATION_API_KEY`, `COURSIFY_WEBHOOK_SECRET`.

**Never** expose `ASSESSMENT_PRO_API_KEY` in the browser.

**Webhook URL (Coursify):** `POST https://coursify.bsoc.space/api/webhooks/assessment-pro`  
Verify: `Authorization: Bearer <ASSESSMENT_PRO_WEBHOOK_SECRET>`

---

## 2. Test assessment UUIDs

| Type | `access_mode` | UUID | Title in AP |
|------|---------------|------|-------------|
| Module quiz | `lms_embed` | `e4529d58-2210-436f-a7e1-516fe15680c7` | Coursify Sample Quiz (Embed) |
| Final exam | `proctored_portal` | `7c65beec-a852-4e92-a2a8-95076c03f8ef` | Coursify Sample Final Exam (Proctored) |

Store in `external_assessments.assessment_pro_assessment_id` linked to a `content_items` row with `content_type = 'assessment'`.

---

## 3. “Add Assessment” modal — four options

Current Coursify UI supports **paste UUID** only. Remaining authoring work:

| Option | What to build | AP API |
|--------|----------------|--------|
| **Pick existing** | Server proxy → dropdown in Create Course | `GET /api/v1/integrations/lms/assessments?accessMode=lms_embed` |
| **Create simple** | Instructor form → create assessment in AP | `POST /api/v1/integrations/lms/assessments` |
| **Design in AP** | Builder iframe in modal | `POST /api/v1/integrations/lms/builder-sessions` → `embedBuilderUrl` |
| **Paste UUID** | Advanced / fallback | *(no AP call — store UUID in `external_assessments`)* |

All server-to-server calls: `Authorization: Bearer <ASSESSMENT_PRO_API_KEY>`.

Suggested Coursify proxy routes (not built yet):

- `GET /api/instructor/assessments/catalog?accessMode=lms_embed`
- `POST /api/instructor/assessments/create`
- `POST /api/instructor/assessments/builder-session`

---

## 4. Learner flows

Base URL: `https://assessments.bsoc.space`

| Flow | Coursify API | AP API | UX |
|------|--------------|--------|-----|
| **Module quiz** | `POST /api/learning/courses/{courseId}/assessments/{contentItemId}/launch` | `POST /api/v1/integrations/lms/launch` | iframe with `embedUrl` |
| **Final exam** | same launch route (branches on `access_mode`) | `POST /api/v1/integrations/lms/invitations` | `window.open(takeUrl)` |

Both require:

- Authenticated, **enrolled** learner
- `learner.email`, `learner.name`, `learner.externalUserId`
- `externalRef.enrollmentId`, `externalRef.contentItemId`, `externalRef.courseId`

Aliases `/api/v1/integrations/coursify/launch` and `/invitations` also work.

---

## 5. Webhook events (AP → Coursify)

| Event | `access_mode` | Coursify action |
|-------|---------------|-----------------|
| `session.submitted` | `lms_embed` | Auto-grade → progress; or `pending_manual_grade` |
| `session.submitted` | `proctored_portal` | Status `submitted` — do not complete lesson |
| `session.graded` | `proctored_portal` | `finalScore`, `passed` → progress |

Payload shapes: [`ASSESSMENT_PRO_INTEGRATION response.md`](ASSESSMENT_PRO_INTEGRATION%20response.md) §6.2.

Handler: `app/api/webhooks/assessment-pro/route.ts`

---

## 6. Embedded builder `postMessage`

After instructor clicks **Publish** inside the AP builder iframe:

```javascript
window.addEventListener("message", (event) => {
  if (event.origin !== "https://assessments.bsoc.space") return;
  if (event.data?.type === "assessment-pro:builder-saved") {
    saveAssessmentId(event.data.assessmentId); // → external_assessments
  }
});
```

Use `NEXT_PUBLIC_ASSESSMENT_PRO_ORIGIN` for origin checks in app code.

---

## 7. Implementation order

| Phase | Task | Coursify status |
|-------|------|-----------------|
| 1 | Env vars + webhook route | Done |
| 2 | DB: `external_assessments`, `external_assessment_sessions` | Done |
| 3 | **Authoring:** picker +/or create +/or builder iframe | **Next** |
| 4 | Take Course: launch + iframe (`lms_embed`) | Done |
| 5 | Final exam: invitations + new tab (`proctored_portal`) | Done |
| 6 | Webhook → progress / grading queue | Done |

---

## 8. Quick smoke tests

### AP catalog (from your machine)

```bash
curl -s "https://assessments.bsoc.space/api/v1/integrations/lms/assessments" \
  -H "Authorization: Bearer $ASSESSMENT_PRO_API_KEY"
```

Should list sample assessments under `coursify-bsoc-space`.

### Coursify production webhook

```bash
npm run test:assessment-pro:prod
```

### Coursify launch (needs enrolled learner cookie)

```bash
export TEST_SESSION_COOKIE='<Cookie from coursify.bsoc.space DevTools>'
./scripts/test-assessment-pro-production.sh launch
```

---

## 9. Key repo paths

| Purpose | Path |
|---------|------|
| AP client (launch, invitations) | `lib/assessment-pro.ts` |
| Learner launch API | `app/api/learning/courses/[courseId]/assessments/[contentItemId]/launch/route.ts` |
| Webhook | `app/api/webhooks/assessment-pro/route.ts` |
| Take Course embed | `components/AssessmentStepEmbed.tsx` |
| Create Course (paste UUID) | `components/pages/CreateCourse.tsx` |
| Grading queue | `components/AssessmentGradingPanel.tsx` |
| DB migration | `database/ADD_EXTERNAL_ASSESSMENTS.sql` |

---

## 10. One-liner

Use AP at `assessments.bsoc.space` with the shared API key; company slug `coursify-bsoc-space`; link content to assessment UUIDs in `external_assessments`; webhook at `https://coursify.bsoc.space/api/webhooks/assessment-pro` with the shared webhook secret.
