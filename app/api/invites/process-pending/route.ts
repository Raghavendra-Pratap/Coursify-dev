import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient as createServiceClient } from '@/lib/supabase-admin';

async function enrollCourseIds(
  admin: ReturnType<typeof createServiceClient>,
  userId: string,
  courseIds: string[],
  alreadyEnrolled: Set<string>,
): Promise<number> {
  let enrolled = 0;
  for (const courseId of courseIds) {
    if (alreadyEnrolled.has(courseId)) continue;
    const { error: insertErr } = await admin.from('enrollments').insert({
      course_id: courseId,
      user_id: userId,
    });
    if (!insertErr) {
      enrolled++;
      alreadyEnrolled.add(courseId);
    }
  }
  return enrolled;
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Not configured', enrolled: 0 }, { status: 503 });
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ enrolled: 0 }, { status: 200 });
  }

  const userId = session.user.id;
  const email = session.user.email.toLowerCase();

  let admin: ReturnType<typeof createServiceClient>;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'Server config', enrolled: 0 }, { status: 503 });
  }

  const { data: invites } = await admin
    .from('learner_invites')
    .select('id, course_id, program_id')
    .eq('email', email)
    .eq('status', 'pending');

  if (!invites?.length) {
    return NextResponse.json({ enrolled: 0 }, { status: 200 });
  }

  type InviteRow = { id: string; course_id: string | null; program_id: string | null };
  const rows = invites as InviteRow[];

  const allCourseIds = new Set<string>();
  for (const inv of rows) {
    if (inv.course_id) allCourseIds.add(inv.course_id);
  }
  const programIds = Array.from(new Set(rows.filter((i) => i.program_id).map((i) => i.program_id as string)));
  if (programIds.length > 0) {
    const { data: members } = await admin
      .from('course_program_members')
      .select('course_id')
      .in('program_id', programIds);
    for (const m of members ?? []) {
      allCourseIds.add((m as { course_id: string }).course_id);
    }
  }

  if (allCourseIds.size === 0) {
    return NextResponse.json({ enrolled: 0 }, { status: 200 });
  }

  const { data: existing } = await admin
    .from('enrollments')
    .select('course_id')
    .eq('user_id', userId)
    .in('course_id', Array.from(allCourseIds));

  const alreadyEnrolled = new Set((existing ?? []).map((e: { course_id: string }) => e.course_id));

  let enrolled = 0;

  for (const inv of rows) {
    if (inv.program_id) {
      const { data: members } = await admin
        .from('course_program_members')
        .select('course_id')
        .eq('program_id', inv.program_id)
        .order('order_index');
      const ids = (members ?? []).map((m: { course_id: string }) => m.course_id);
      enrolled += await enrollCourseIds(admin, userId, ids, alreadyEnrolled);
      await admin.from('learner_invites').update({ status: 'accepted' }).eq('id', inv.id);
      continue;
    }

    if (inv.course_id) {
      if (alreadyEnrolled.has(inv.course_id)) {
        await admin.from('learner_invites').update({ status: 'accepted' }).eq('id', inv.id);
        continue;
      }
      const { error: insertErr } = await admin.from('enrollments').insert({
        course_id: inv.course_id,
        user_id: userId,
      });
      if (!insertErr) {
        enrolled++;
        alreadyEnrolled.add(inv.course_id);
        await admin.from('learner_invites').update({ status: 'accepted' }).eq('id', inv.id);
      }
    }
  }

  return NextResponse.json({ enrolled }, { status: 200 });
}
