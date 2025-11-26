import { AuthLayout } from "@/components/auth/auth-layout"
import { RegisterForm } from "@/components/auth/register-form"

export default function RegisterPage() {
  return (
    <AuthLayout
      title="创建新账户"
      subtitle="加入我们，开始您的精彩旅程"
    >
      <RegisterForm />
    </AuthLayout>
  )
}