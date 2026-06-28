import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { createServerClient as createServiceClient } from "@/lib/supabase-admin"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 })
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { courseId } = await params
  const body = await request.json().catch(() => ({}))
  const rating = typeof body.rating === "number" ? Math.min(5, Math.max(1, Math.round(body.rating))) : null
  const review = typeof body.review === "string" ? body.review.trim().slice(0, 2000) : null

  if (rating == null) {
    return NextResponse.json({ error: "rating is required (1-5)" }, { status: 400 })
  }

  const admin = createServiceClient()
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!enrollment) {
    return NextResponse.json({ error: "You must be enrolled to rate this course" }, { status: 403 })
  }

  const { data: row, error } = await admin
    .from("course_ratings")
    .upsert(
      {
        user_id: user.id,
        course_id: courseId,
        rating,
        review: review ?? null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,course_id",
        ignoreDuplicates: false,
      }
    )
    .select("rating, review, created_at, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ rating: row })
}
