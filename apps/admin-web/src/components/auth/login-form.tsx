"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { Eye, EyeOff, Mail, Lock } from "lucide-react"
import { sendVerificationEmail } from "@/hooks/useAuth"
import { SocialLoginButtons } from "./social-login-buttons"
import { login } from "@/lib/auth"
import { Input } from "@repo/ui/components/input"
import { Button } from "@repo/ui/components/button"
import { Label } from "@repo/ui/components/label"

const loginSchema = z.object({
  email: z.email("请输入有效的邮箱地址"),
  password: z.string().min(6, "密码至少需要6个字符")
})

type LoginFormData = z.infer<typeof loginSchema>

interface LoginFormProps {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [isResendingVerification, setIsResendingVerification] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true)
      setNeedsVerification(false)

      const result = await login({
        email: data.email,
        password: data.password,
      })

      console.log(result)

      if (result.error) {
        if (result.error.status === 403) {
          // 邮箱未验证
          setUserEmail(data.email)
          setNeedsVerification(true)
        } else {
          setError("root", {
            message: "邮箱或密码错误，请重试"
          })
        }
        return
      }

      onSuccess?.()
    } catch (error) {
      console.error("登录失败:", error)
      setError("root", {
        message: "登录失败，请稍后重试"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendVerification = async () => {
    try {
      setIsResendingVerification(true)
      await sendVerificationEmail({
        email: userEmail,
        callbackURL: "/dashboard"
      })
      alert('验证邮件已重新发送，请检查您的邮箱')
    } catch (error) {
      console.error('重新发送验证邮件失败:', error)
      alert('发送失败，请稍后重试')
    } finally {
      setIsResendingVerification(false)
    }
  }

  const isFormLoading = isLoading || socialLoading

  return (
    <div className="space-y-6">
      {/* Social Login */}
      <SocialLoginButtons onLoading={setSocialLoading} />

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-300 dark:border-gray-600" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">
            或使用邮箱登录
          </span>
        </div>
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            邮箱地址
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="email"
              type="email"
              placeholder="请输入您的邮箱"
              className="pl-10 h-11"
              disabled={isFormLoading}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">
            密码
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="请输入您的密码"
              className="pl-10 pr-10 h-11"
              disabled={isFormLoading}
              {...register("password")}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isFormLoading}
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

        {/* Forgot Password Link */}
        <div className="flex justify-end">
          <Link
            href="/auth/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            忘记密码？
          </Link>
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
          disabled={isFormLoading}
        >
          {isLoading ? (
            <div className="flex items-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              登录中...
            </div>
          ) : (
            "登录"
          )}
        </Button>
      </form>

      {/* Sign Up Link */}
      <div className="text-center">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          还没有账户？{" "}
          <Link
            href="/auth/register"
            className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            立即注册
          </Link>
        </span>
      </div>
    </div>
  )
}
