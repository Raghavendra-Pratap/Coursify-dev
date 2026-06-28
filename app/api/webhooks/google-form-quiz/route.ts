/**
 * POST: Receive Google Form quiz score from Apps Script webhook.
 * Security: (1) Token signed by us, (2) one-time use, (3) strict validation, (4) rate limit.
 */
import { NextResponse } from "next/server";
import { createServerClient as createServiceClient } from "@/lib/supabase-admin";
import { verifyQuizToken, hashToken } from "@/lib/webhook-quiz-token";

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 10;
const rateMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string): boolean {
  const now = Date.now();
  const cur = rateMap.get(key);
  if (!cur) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (now >= cur.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  cur.count += 1;
  return cur.count > RATE_LIMIT_MAX;
}

export async function POST(request: Request) {
  const clientId = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";
  if (rateLimit(clientId)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const { token, score, passed, submissionId } = body as { token?: unknown; score?: unknown; passed?: unknown; submissionId?: unknown };
  if (typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const payload = verifyQuizToken(token.trim());
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const scoreNum = typeof score === "number" && Number.isFinite(score) ? Math.round(score) : null;
  if (scoreNum === null || scoreNum < 0 || scoreNum > 100) {
    return NextResponse.json({ error: "score must be a number 0-100" }, { status: 400 });
  }
  const passedBool = passed === true || passed === false ? passed : null;
  if (passedBool === null) {
    return NextResponse.json({ error: "passed must be boolean" }, { status: 400 });
  }
  const submissionIdSanitized = typeof submissionId === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(submissionId) ? submissionId : null;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const db = createServiceClient();
  const tokenHash = hashToken(token);

  const { data: existing } = await db.from("webhook_quiz_token_used").select("token_hash").eq("token_hash", tokenHash).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Token already used" }, { status: 409 });
  }

  const { data: quizRow } = await db.from("quizzes").select("id").eq("content_item_id", payload.content_item_id).maybeSingle();
  if (!quizRow) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 400 });
  }
  const quizId = (quizRow as { id: string }).id;

  const { data: contentItem } = await db.from("content_items").select("lesson_id").eq("id", payload.content_item_id).single();
  if (!contentItem) {
    return NextResponse.json({ error: "Content item not found" }, { status: 400 });
  }
  const lessonId = (contentItem as { lesson_id: string }).lesson_id;

  await db.from("webhook_quiz_token_used").insert({ token_hash: tokenHash });

  await db.from("quiz_attempts").insert({
    enrollment_id: payload.enrollment_id,
    quiz_id: quizId,
    score: scoreNum,
    passed: passedBool,
    answers: submissionIdSanitized ? { submissionId: submissionIdSanitized } : {},
  });

  const { data: progressRow } = await db.from("progress").select("id").eq("enrollment_id", payload.enrollment_id).eq("lesson_id", lessonId).maybeSingle();
  if (progressRow) {
    await db.from("progress").update({
      quiz_score: scoreNum,
      quiz_passed: passedBool,
      last_accessed_at: new Date().toISOString(),
    }).eq("enrollment_id", payload.enrollment_id).eq("lesson_id", lessonId);
  } else {
    await db.from("progress").insert({
      enrollment_id: payload.enrollment_id,
      lesson_id: lessonId,
      quiz_score: scoreNum,
      quiz_passed: passedBool,
      last_accessed_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
