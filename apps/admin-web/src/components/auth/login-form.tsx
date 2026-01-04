"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Mail, Lock, Eye, EyeOff } from "lucide-react"
import { useForm } from "@tanstack/react-form"
import { zodValidator } from "@tanstack/zod-form-adapter"
import { useQueryClient } from "@tanstack/react-query"
import { AdminLoginRequestSchema } from "@repo/types"
import { ApiClientError } from "@repo/utils/api-client"
import { translateAuthErrorMessage } from "@repo/lib/auth-errors";
import { adminProfileQueryOptions } from "@repo/hooks/api/ssr"
import { Input } from "@repo/web-ui/components/input"
import { Button } from "@repo/web-ui/components/button"
import { Label } from "@repo/web-ui/components/label"
import { Checkbox } from "@repo/web-ui/components/checkbox"
import { adminLogin } from "@/lib/auth"

const loginFormSchema = AdminLoginRequestSchema.extend({
    rememberMe: AdminLoginRequestSchema.shape.rememberMe.default(false),
})

type LoginFormValues = {
    email: string
    password: string
    rememberMe: boolean
}

interface LoginFormProps {
    onSuccess?: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
    const [showPassword, setShowPassword] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirectTo = searchParams.get("redirect") || "/dashboard"
    const queryClient = useQueryClient()

    const defaultValues: LoginFormValues = {
        email: "",
        password: "",
        rememberMe: false,
    }

    const form = useForm({
        defaultValues,
        onSubmit: async ({ value }) => {
            setFormError(null)
            try {
                await adminLogin(value)
                await queryClient.invalidateQueries({
                    queryKey: adminProfileQueryOptions().queryKey,
                })
                onSuccess?.()
                router.replace(redirectTo)
            } catch (error) {
                const fallback = "登录失败，请稍后重试";
                if (error instanceof ApiClientError) {
                    setFormError(translateAuthErrorMessage(error, fallback));
                    return;
                }
                setFormError(translateAuthErrorMessage(error, fallback));
            }
        },
    })

    return (
        <form
            className="space-y-6"
            onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit()
            }}
        >
            <form.Field
                name="email"
                validators={{ onChange: loginFormSchema.shape.email }}
            >
                {(field) => (
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium">
                            邮箱地址
                        </Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                            <Input
                                id="email"
                                type="email"
                                placeholder="请输入管理员邮箱"
                                className="pl-10 h-11"
                                value={field.state.value}
                                onChange={(event) =>
                                    field.handleChange(event.target.value)
                                }
                                onBlur={field.handleBlur}
                                autoComplete="email"
                            />
                        </div>
                        {field.state.meta.errors.length > 0 ? (
                            <p className="text-sm text-red-600 dark:text-red-400">
                                {String(field.state.meta.errors[0]?.message)}
                            </p>
                        ) : null}
                    </div>
                )}
            </form.Field>

            <form.Field
                name="password"
                validators={{ onChange: loginFormSchema.shape.password }}
            >
                {(field) => (
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm font-medium">
                            密码
                        </Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="请输入密码"
                                className="pl-10 pr-10 h-11"
                                value={field.state.value}
                                onChange={(event) =>
                                    field.handleChange(event.target.value)
                                }
                                onBlur={field.handleBlur}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                onClick={() => setShowPassword((prev) => !prev)}
                                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                            >
                                {showPassword ? (
                                    <EyeOff className="size-4" />
                                ) : (
                                    <Eye className="size-4" />
                                )}
                            </button>
                        </div>
                        {field.state.meta.errors.length > 0 ? (
                            <p className="text-sm text-red-600 dark:text-red-400">
                                {String(field.state.meta.errors[0]?.message)}
                            </p>
                        ) : null}
                    </div>
                )}
            </form.Field>

            {formError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                    {formError}
                </div>
            ) : null}

            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit, isSubmitting]) => (
                    <Button
                        type="submit"
                        className="w-full h-11 text-sm font-medium"
                        disabled={!canSubmit}
                    >
                        {isSubmitting ? "登录中..." : "登录"}
                    </Button>
                )}
            </form.Subscribe>

            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                还没有账户？{" "}
                <Link
                    href="/auth/register"
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                    立即注册
                </Link>
            </div>
        </form>
    )
}
