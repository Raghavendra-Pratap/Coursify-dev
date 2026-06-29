import { buildBoardingPassInviteHtml } from '@/lib/email/boarding-pass-invite';

const SAMPLE = {
  recipientEmail: 'jordan.avery@example.com',
  courseTitle: 'Advanced UX Research',
  courseId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  inviterName: 'Raghavendra Voss',
  enrollUrl: 'https://coursify.bsoc.space?enroll=a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  moduleCount: 4,
  lessonCount: 18,
  durationLabel: '2H 45M',
};

export default function InviteEmailPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <p>Email preview is only available in development.</p>
      </main>
    );
  }

  const html = buildBoardingPassInviteHtml(SAMPLE);

  return (
    <main style={{ margin: 0, padding: 0, minHeight: '100vh', background: '#05080c' }}>
      <div
        style={{
          padding: '12px 16px',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
          color: '#8899aa',
          borderBottom: '1px solid #243040',
        }}
      >
        Dev preview · learner invitation. Sample stats: 4 modules, 18 lessons, 2H 45M.
      </div>
      <iframe
        title="Learner invite email preview"
        srcDoc={html}
        style={{ display: 'block', width: '100%', minHeight: 'calc(100vh - 44px)', border: 'none' }}
      />
    </main>
  );
}
