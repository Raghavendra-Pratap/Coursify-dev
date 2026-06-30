import { buildLearnerInviteEmail } from '@/lib/resend-email';

const SAMPLE = buildLearnerInviteEmail({
  recipientEmail: 'jordan.avery@example.com',
  recipientName: 'Jordan Avery',
  courseTitle: 'Advanced UX Research',
  courseId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  inviterName: 'Raghavendra Voss',
});

const SAMPLE_WITH_NOTE = buildLearnerInviteEmail({
  recipientEmail: 'jordan.avery@example.com',
  recipientName: 'Jordan Avery',
  courseTitle: 'Advanced UX Research',
  courseId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  inviterName: 'Raghavendra Voss',
  customMessage:
    'We kick off next week. The first module is a great introduction to the field — hope you can join us.',
});

export default function InviteEmailPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <p>Email preview is only available in development.</p>
      </main>
    );
  }

  return (
    <main style={{ margin: 0, padding: 0, minHeight: '100vh', background: '#05080c' }}>
      <div style={{ padding: '12px 16px', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#8899aa', borderBottom: '1px solid #243040' }}>
        Dev preview · minimal invite email (button + plain-text fallback). Boarding pass opens in the app.
      </div>
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#F4F7FA' }}>
        <p style={{ fontSize: 13, color: '#7A8FA3', marginBottom: 8 }}>Subject: {SAMPLE.subject}</p>
      </div>
      <iframe title="Learner invite email preview" srcDoc={SAMPLE.html} style={{ display: 'block', width: '100%', minHeight: 420, border: 'none', borderTop: '1px solid #243040' }} />
      <div style={{ padding: 24 }}>
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#E8A87C', marginBottom: 8 }}>Plain-text fallback</p>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#121A24', border: '1px solid #243040', borderRadius: 12, padding: 20, lineHeight: 1.6, fontSize: 13, color: '#F4F7FA', fontFamily: 'ui-monospace, monospace' }}>
          {SAMPLE.text}
        </pre>
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#E8A87C', margin: '24px 0 8px' }}>With instructor note (HTML)</p>
        <iframe title="Invite with note" srcDoc={SAMPLE_WITH_NOTE.html} style={{ display: 'block', width: '100%', minHeight: 420, border: '1px solid #243040', borderRadius: 12 }} />
      </div>
    </main>
  );
}
