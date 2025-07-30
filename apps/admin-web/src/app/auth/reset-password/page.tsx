import { AuthLayout } from "@/components/auth/auth-layout"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="重置密码"
      subtitle="设置您的新密码，确保账户安全"
    >
      <ResetPasswordForm />
    </AuthLayout>
  )
}
