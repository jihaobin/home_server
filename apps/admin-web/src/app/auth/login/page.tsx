import { AuthLayout } from "@/components/auth/auth-layout"
import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <AuthLayout
      title="欢迎回来"
      subtitle="登录您的账户以继续使用我们的服务"
    >
      <LoginForm />
    </AuthLayout>
  )
}