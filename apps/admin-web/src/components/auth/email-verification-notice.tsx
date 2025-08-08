"use client"

import { useState } from "react"
import { Mail, CheckCircle, Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { sendVerificationEmail } from "@/hooks/useAuth"
import { Button } from "@repo/web-ui/components/button"

interface EmailVerificationNoticeProps {
  email: string
  onBack?: () => void
}

export function EmailVerificationNotice({ email, onBack }: EmailVerificationNoticeProps) {
  const [isResending, setIsResending] = useState(false)
  const [resendCount, setResendCount] = useState(0)
  const [lastResendTime, setLastResendTime] = useState<number | null>(null)

  const canResend = () => {
    if (!lastResendTime) return true
    const timeSinceLastResend = Date.now() - lastResendTime
    return timeSinceLastResend > 60000 // 1分钟后才能重新发送
  }

  const getResendCooldown = () => {
    if (!lastResendTime) return 0
    const timeSinceLastResend = Date.now() - lastResendTime
    const remaining = 60000 - timeSinceLastResend
    return Math.max(0, Math.ceil(remaining / 1000))
  }

  const handleResendEmail = async () => {
    if (!canResend() || isResending) return

    try {
      setIsResending(true)
      await sendVerificationEmail({
        email,
        callbackURL: "/dashboard"
      })
      setResendCount(prev => prev + 1)
      setLastResendTime(Date.now())
    } catch (error) {
      console.error('重新发送验证邮件失败:', error)
      alert('发送失败，请稍后重试')
    } finally {
      setIsResending(false)
    }
  }

  const cooldown = getResendCooldown()

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
          <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          验证您的邮箱地址
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          我们已向 <span className="font-medium text-gray-900 dark:text-white">{email}</span> 发送了验证邮件
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200 text-left">
            <p className="font-medium mb-1">请检查您的邮箱</p>
            <ul className="space-y-1 text-blue-700 dark:text-blue-300">
              <li>• 点击邮件中的验证链接完成验证</li>
              <li>• 如果没有收到邮件，请检查垃圾邮件文件夹</li>
              <li>• 验证链接将在30分钟后过期</li>
            </ul>
          </div>
        </div>
      </div>

      {resendCount > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <p className="text-sm text-green-800 dark:text-green-200">
            ✓ 验证邮件已重新发送 ({resendCount} 次)
          </p>
        </div>
      )}

      <div className="space-y-3">
        <Button
          onClick={handleResendEmail}
          disabled={!canResend() || isResending}
          variant="outline"
          className="w-full"
        >
          {isResending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              发送中...
            </>
          ) : cooldown > 0 ? (
            `重新发送 (${cooldown}s)`
          ) : (
            '重新发送验证邮件'
          )}
        </Button>

        {onBack && (
          <Button
            onClick={onBack}
            variant="ghost"
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回注册
          </Button>
        )}

        <Link href="/auth/login">
          <Button variant="ghost" className="w-full">
            立即登录
          </Button>
        </Link>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        <p>没有收到邮件？</p>
        <p>请检查垃圾邮件文件夹或联系客服获取帮助</p>
      </div>
    </div>
  )
}
