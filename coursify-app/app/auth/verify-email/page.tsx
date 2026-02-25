export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow text-center">
        <h2 className="text-2xl font-bold">Check your email</h2>
        <p className="text-gray-600">
          We've sent a verification link to your email address. Please click the link to verify your account.
        </p>
        <p className="text-sm text-gray-500">
          If you don't see the email, check your spam folder.
        </p>
      </div>
    </div>
  )
}
