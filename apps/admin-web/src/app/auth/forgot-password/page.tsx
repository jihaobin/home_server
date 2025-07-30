import { AuthLayout } from "@/components/auth/auth-layout"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="重置密码"
      subtitle="忘记密码了？别担心，我们来帮您找回"
    >
      <ForgotPasswordForm />
    </AuthLayout>
  )
}