import { redirect } from 'next/navigation'
import { verifyMagicToken } from '@/lib/magic-link'
import { ROUTES } from '@/lib/site-urls'

type Props = { params: { token: string } }

export default async function GoMagicPage({ params }: Props) {
  const token = params.token
  const verified = verifyMagicToken(token)
  if (!verified) {
    redirect(`${ROUTES.login}?error=invalid_link`)
  }
  if (verified.type === 'program') {
    redirect(`/program/${verified.id}`)
  }
  redirect(`/course/${verified.id}`)
}
