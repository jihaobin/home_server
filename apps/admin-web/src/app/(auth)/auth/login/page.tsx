import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
    return (
        <AuthLayout
            title="欢迎回来"
            subtitle="登录您的账户以继续使用我们的服务"
        >
            <Suspense
                fallback={
                    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/70 p-4 text-sm text-muted-foreground shadow-sm">
                        <div className="flex items-center gap-2 text-foreground">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span>正在准备登录表单...</span>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="h-11 rounded-md bg-muted animate-pulse" />
                            <div className="h-11 rounded-md bg-muted animate-pulse" />
                            <div className="h-11 rounded-md bg-muted animate-pulse" />
                        </div>
                    </div>
                }
            >
                <LoginForm />
            </Suspense>
        </AuthLayout>
    )
}
