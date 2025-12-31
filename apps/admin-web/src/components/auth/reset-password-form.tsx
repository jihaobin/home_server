"use client"

import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@repo/web-ui/components/button"

export function ResetPasswordForm() {
    return (
        <Suspense fallback={<Loader2 className="w-4 h-4 animate-spin" />}>
            <div className="space-y-6 text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    密码重置已关闭
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    管理端暂不支持忘记密码和重置密码功能，请联系管理员协助处理。
                </p>
                <Button className="w-full" asChild>
                    <a href="/auth/login">返回登录</a>
                </Button>
            </div>
        </Suspense>
    )
}
