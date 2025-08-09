"use client"

import { useState, useEffect, Suspense } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { authClient } from "@/lib/auth-cient"
import { ErrorContext } from "better-auth/react"
import { Button } from "@repo/web-ui/components/button"
import { Input } from "@repo/web-ui/components/input"
import { Label } from "@repo/web-ui/components/label"

const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, "密码至少需要8个字符")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "密码必须包含大小写字母和数字"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"]
})

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

interface ResetPasswordFormProps {
  onSuccess?: () => void
}

function Form({ onSuccess }: ResetPasswordFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState(false)

  const searchParams = useSearchParams()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema)
  })

  useEffect(() => {
    const tokenParam = searchParams.get('token')
    if (tokenParam) {
      setToken(tokenParam)
    } else {
      setTokenError(true)
    }
  }, [searchParams])

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setError("root", {
        message: "重置链接无效，请重新申请密码重置"
      })
      return
    }

    try {
      setIsLoading(true)

      const result = await authClient.resetPassword({
        token,
        newPassword: data.password,
      }, {
        onError: (ctx: ErrorContext) => {
          console.error("重置密码失败:", ctx.error)
          if (ctx.error.message?.includes("token")) {
            setError("root", {
              message: "重置链接已过期或无效，请重新申请密码重置"
            })
          } else {
            setError("root", {
              message: "重置密码失败，请稍后重试"
            })
          }
        }
      })

      if (result?.error) {
        if (result.error.message?.includes("token")) {
          setError("root", {
            message: "重置链接已过期或无效，请重新申请密码重置"
          })
        } else {
          setError("root", {
            message: "重置密码失败，请稍后重试"
          })
        }
        return
      }

      setIsSuccess(true)
      onSuccess?.()
    } catch (error) {
      console.error("重置密码失败:", error)
      setError("root", {
        message: "重置密码失败，请稍后重试"
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Token错误状态
  if (tokenError) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            重置链接无效
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            该重置链接无效或已过期，请重新申请密码重置。
          </p>
        </div>

        <div className="space-y-3">
          <Link href="/auth/forgot-password">
            <Button className="w-full">
              重新申请密码重置
            </Button>
          </Link>

          <Link href="/auth/login">
            <Button variant="ghost" className="w-full">
              返回登录
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // 成功状态
  if (isSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            密码重置成功
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            您的密码已成功重置，现在可以使用新密码登录了。
          </p>
        </div>

        <Link href="/auth/login">
          <Button className="w-full">
            立即登录
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          请输入您的新密码，确保密码安全性。
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* New Password Field */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">
            新密码
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="请输入新密码"
              className="pl-10 pr-10 h-11"
              disabled={isLoading}
              {...register("password")}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">
            确认新密码
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="请再次输入新密码"
              className="pl-10 pr-10 h-11"
              disabled={isLoading}
              {...register("confirmPassword")}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isLoading}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Password Requirements */}
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>密码要求：</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>至少8个字符</li>
            <li>包含大写字母</li>
            <li>包含小写字母</li>
            <li>包含数字</li>
          </ul>
        </div>

        {/* Error Message */}
        {errors.root && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {errors.root.message}
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full h-11 text-sm font-medium"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              重置中...
            </div>
          ) : (
            "重置密码"
          )}
        </Button>
      </form>

      {/* Back to Login */}
      <div className="text-center">
        <Link
          href="/auth/login"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
        >
          返回登录
        </Link>
      </div>
    </div>
  )
}

export function ResetPasswordForm({ onSuccess }: ResetPasswordFormProps){
  return (
    <Suspense  fallback={<Loader2 className="w-4 h-4 animate-spin" />}>
    <Form onSuccess={onSuccess}/>
    </Suspense>
  )
}
