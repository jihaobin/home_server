import { AuthLayout } from "@/components/auth/auth-layout"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export default function ResetPasswordPage() {
    return (
        <AuthLayout title="重置密码" subtitle="该功能已关闭，请联系管理员">
            <ResetPasswordForm />
        </AuthLayout>
    )
}
