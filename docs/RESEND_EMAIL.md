# Resend email setup

Coursify uses [Resend](https://resend.com) for outbound email. Invites and reminders are **saved to the database even when email is not configured**; Resend only controls whether the recipient gets an email.

## What sends email

| Flow | API | Trigger |
|------|-----|---------|
| Learner invite | `POST /api/email/invite` | Learners → Invite learners |
| Learner reminder | `POST /api/email/reminder` | Learners → Send reminder |
| Co-instructor added | (in `POST /api/courses/invite-collaborator`) | My Courses → Collaborators |

## Environment variables

Set in `.env.local` (local) and Vercel → Settings → Environment Variables (production):

```bash
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM_EMAIL=Coursify <notifications@yourdomain.com>
NEXT_PUBLIC_APP_URL=https://coursify.bsoc.space
```

- **`RESEND_API_KEY`** — required for any email to send.
- **`RESEND_FROM_EMAIL`** — optional. Defaults to `Coursify <onboarding@resend.dev>` (Resend test sender; only delivers to your Resend account email in dev).
- **`RESEND_REPLY_TO`** — optional. Defaults to the address inside `RESEND_FROM_EMAIL`. Set a monitored inbox so replies do not bounce.
- **`NEXT_PUBLIC_APP_URL`** — used in invite links (`?enroll={courseId}` for course-specific invites).

## Production checklist

1. Create a Resend account and API key.
2. Verify your sending domain in Resend (DNS records).
3. Set `RESEND_FROM_EMAIL` to an address on that domain.
4. Add env vars to Vercel for the **develop** / production environment.
5. Redeploy.
6. Check status: `GET /api/email/status` → `{ "configured": true }`.
7. Test: Learners → Invite learners → confirm recipient receives email.

## Invite email content

- **Personal message + boarding pass** — optional creator note at the top, then the invitation card. Plain-text fallback is included for clients that prefer text.
- **Invitation card design** — dark wide card with copper accents, course code, enrollment code, and enroll CTA (see `lib/email/boarding-pass-invite.ts`).
- Includes inviter name (from profile) when available.
- Subject examples: `Raghavendra invited you to Advanced UX Research` or `Invitation to Advanced UX Research on Coursify`.
- If a course is selected, CTA links to `?enroll={courseId}` for auto-enroll on sign-up.
- One personalized email per recipient (name derived from email local-part).

## Deliverability (reduce spam folder)

1. **Verify `bsoc.space` in Resend** — SPF, DKIM, and DMARC must show as verified (Resend → Domains).
2. **Use a real From address** on that domain (`invite@bsoc.space` is fine once verified).
3. **Set `RESEND_REPLY_TO`** to a monitored inbox (e.g. same as From).
4. **Ask recipients** to mark the first message as “Not spam” and add the sender to contacts.
5. **Warm up** — avoid blasting many invites at once from a new domain.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| “Invites saved. Add RESEND_API_KEY…” | Set `RESEND_API_KEY` on Vercel and redeploy |
| Email not received (test sender) | With `onboarding@resend.dev`, only sends to the Resend account owner email |
| 401 on invite API | User must be signed in; route requires instructor session |
| Invite saved but no enroll | Learner must sign up with the **same email**; `process-pending` runs on login |

See also [LIVE_TESTING_CHECKLIST.md](LIVE_TESTING_CHECKLIST.md).
