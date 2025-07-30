"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import Link from "next/link"
import { Mail, ArrowLeft, CheckCircle } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { authClient } from "@/lib/authClient"
import { ErrorContext } from "better-auth/react"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"

const forgotPasswordSchema = z.object({
  email: z.email("请输入有效的邮箱地址")
})

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

interface ForgotPasswordFormProps {
  onSuccess?: () => void
}

export function ForgotPasswordForm({ onSuccess }: ForgotPasswordFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [email, setEmail] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema)
  })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsLoading(true)
      setEmail(data.email)

      const result = await authClient.requestPasswordReset({
        email: data.email,
        redirectTo: "http://localhost:3000/auth/reset-password"
      }, {
        onError: (ctx: ErrorContext) => {
          console.error("发送重置邮件失败:", ctx.error)
          setError("root", {
            message: "发送重置邮件失败，请稍后重试"
          })
        }
      })

      if (result?.error) {
        setError("root", {
          message: "发送重置邮件失败，请稍后重试"
        })
        return
      }

      setIsSuccess(true)
      onSuccess?.()
    } catch (error) {
      console.error("发送重置邮件失败:", error)
      setError("root", {
        message: "发送重置邮件失败，请稍后重试"
      })
    } finally {
      setIsLoading(false)
    }
  }

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
            重置邮件已发送
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            我们已向 <span className="font-medium">{email}</span> 发送了密码重置链接。
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            请检查您的邮箱（包括垃圾邮件文件夹）并点击链接重置密码。
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => {
              setIsSuccess(false)
              setEmail("")
            }}
            variant="outline"
            className="w-full"
          >
            重新发送邮件
          </Button>

          <Link href="/auth/login">
            <Button variant="ghost" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回登录
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          输入您的邮箱地址，我们将向您发送密码重置链接。
        </p>
      </div>

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
              disabled={isLoading}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.email.message}
            </p>
          )}
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
              发送中...
            </div>
          ) : (
            "发送重置邮件"
          )}
        </Button>
      </form>

      {/* Back to Login */}
      <div className="text-center">
        <Link
          href="/auth/login"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回登录
        </Link>
      </div>
    </div>
  )
}
