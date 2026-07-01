import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/site-urls';

/** Root → marketing home. Signed-in users are sent to the LMS from middleware when possible. */
export default function RootPage() {
  redirect(ROUTES.home);
}
