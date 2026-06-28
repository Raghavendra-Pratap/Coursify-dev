/**
 * GET: Issue a one-time signed token for the Google Form quiz webhook.
 * Auth required; verifies the user is enrolled and the content item is a quiz in that course.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { createServerClient as createServiceClient } from "@/lib/supabase-admin";
import { signQuizToken } from "@/lib/webhook-quiz-token";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const enrollmentId = searchParams.get("enrollmentId");
  const contentItemId = searchParams.get("contentItemId");

  if (!enrollmentId || !contentItemId) {
    return NextResponse.json({ error: "enrollmentId and contentItemId required" }, { status: 400 });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const m = cookieHeader.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
        return m ? decodeURIComponent(m[1]) : undefined;
      },
      set() {},
      remove() {},
    },
  });

  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();

  const { data: enrollment } = await db
    .from("enrollments")
    .select("id, user_id, course_id")
    .eq("id", enrollmentId)
    .single();

  if (!enrollment || (enrollment as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: contentItem } = await db
    .from("content_items")
    .select("id, lesson_id, content_type")
    .eq("id", contentItemId)
    .single();

  if (!contentItem || (contentItem as { content_type: string }).content_type !== "quiz") {
    return NextResponse.json({ error: "Invalid content item" }, { status: 400 });
  }

  const lessonId = (contentItem as { lesson_id: string }).lesson_id;
  const { data: lesson } = await db.from("lessons").select("id, module_id").eq("id", lessonId).single();
  if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 400 });

  const { data: module } = await db.from("modules").select("id, course_id").eq("id", (lesson as { module_id: string }).module_id).single();
  if (!module || (module as { course_id: string }).course_id !== (enrollment as { course_id: string }).course_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const token = signQuizToken(enrollmentId, contentItemId);
    return NextResponse.json({ token });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Token generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
