"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react"
import { SocialLoginButtons } from "./social-login-buttons"
import { EmailVerificationNotice } from "./email-verification-notice"
import { register as registerUser } from "@/lib/auth"
import { Input } from "@repo/web-ui/components/input"
import { Button } from "@repo/web-ui/components/button"
import { Label } from "@repo/web-ui/components/label"
import { authClient } from "@/lib/auth-cient"


const registerSchema = z.object({
  name: z.string().min(2, "姓名至少需要2个字符"),
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string()
    .min(8, "密码至少需要8个字符")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "密码必须包含大小写字母和数字"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"]
})

type RegisterFormData = z.infer<typeof registerSchema>

interface RegisterFormProps {
  onSuccess?: () => void
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState(false)
  const [showVerificationNotice, setShowVerificationNotice] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema)
  })

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsLoading(true)

      const result = await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
      })

      if (result.error) {
        if(result.error.code === authClient.$ERROR_CODES.USER_ALREADY_EXISTS){
            setError("email", {
                message: "该邮箱已被注册，请使用其他邮箱"
            })
            return
        }

        setError("root", {
            message: "注册失败，请稍后重试"
        })
        return
      }

      // 注册成功，显示邮箱验证提示
      setRegisteredEmail(data.email)
      setShowVerificationNotice(true)
      onSuccess?.()
    } catch (error) {
      console.error("注册失败:", error)
      setError("root", {
        message: "注册失败，请稍后重试"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const isFormLoading = isLoading || socialLoading

  // 如果需要显示邮箱验证提示，则显示该组件
  if (showVerificationNotice) {
    return (
      <EmailVerificationNotice
        email={registeredEmail}
        onBack={() => setShowVerificationNotice(false)}
      />
    )
  }

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
            或使用邮箱注册
          </span>
        </div>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name Field */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            姓名
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="name"
              type="text"
              placeholder="请输入您的姓名"
              className="pl-10 h-11"
              disabled={isFormLoading}
              {...register("name")}
            />
          </div>
          {errors.name && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.name.message}
            </p>
          )}
        </div>

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
              placeholder="请输入密码"
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

        {/* Confirm Password Field */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">
            确认密码
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="请再次输入密码"
              className="pl-10 pr-10 h-11"
              disabled={isFormLoading}
              {...register("confirmPassword")}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isFormLoading}
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

        {/* Terms and Privacy */}
        <div className="text-xs text-gray-600 dark:text-gray-400">
          注册即表示您同意我们的{" "}
          <Link href="/terms" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">
            服务条款
          </Link>
          {" "}和{" "}
          <Link href="/privacy" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">
            隐私政策
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
              注册中...
            </div>
          ) : (
            "创建账户"
          )}
        </Button>
      </form>

      {/* Sign In Link */}
      <div className="text-center">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          已有账户？{" "}
          <Link
            href="/auth/login"
            className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            立即登录
          </Link>
        </span>
      </div>
    </div>
  )
}
