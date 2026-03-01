import { redirect } from 'next/navigation'
import { verifyCourseMagicToken } from '@/lib/magic-link'

type Props = { params: { token: string } }

export default async function GoMagicPage({ params }: Props) {
  const token = params.token
  const courseId = verifyCourseMagicToken(token)
  if (!courseId) {
    redirect('/?error=invalid_link')
  }
  redirect(`/course/${courseId}`)
}
