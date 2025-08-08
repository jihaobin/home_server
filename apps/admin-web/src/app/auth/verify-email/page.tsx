"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle, XCircle, Mail, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { sendVerificationEmail } from "@/hooks/useAuth"
import { authClient } from "@/lib/authClient"
import { Button } from "@repo/web-ui/components/button"

type VerificationStatus = 'loading' | 'success' | 'error' | 'expired' | 'invalid'

function VerifyEmailPageComponent() {
  const [status, setStatus] = useState<VerificationStatus>('loading')
  const [isResending, setIsResending] = useState(false)
  const [email, setEmail] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token')

      if (!token) {
        setStatus('invalid')
        setErrorMessage('验证链接无效，缺少验证令牌')
        return
      }

      try {
        const result = await authClient.verifyEmail({
          query: { token }
        })

        if (result.error) {
          console.error('邮箱验证失败:', result.error)

          // 根据错误类型设置不同的状态
          if (result.error.message?.includes('expired') || result.error.message?.includes('过期')) {
            setStatus('expired')
            setErrorMessage('验证链接已过期，请重新发送验证邮件')
          } else if (result.error.message?.includes('invalid') || result.error.message?.includes('无效')) {
            setStatus('invalid')
            setErrorMessage('验证链接无效，请检查链接是否正确')
          } else {
            setStatus('error')
            setErrorMessage(result.error.message || '验证失败，请稍后重试')
          }
        } else {
          setStatus('success')
          // 验证成功后，3秒后自动跳转到仪表板
          setTimeout(() => {
            router.push('/dashboard')
          }, 3000)
        }
      } catch (error) {
        console.error('验证过程中发生错误:', error)
        setStatus('error')
        setErrorMessage('验证过程中发生错误，请稍后重试')
      }
    }

    verifyEmail()
  }, [searchParams, router])

  const handleResendEmail = async () => {
    if (!email) {
      alert('请输入您的邮箱地址')
      return
    }

    try {
      setIsResending(true)
      await sendVerificationEmail({
        email,
        callbackURL: "/dashboard"
      })
      alert('验证邮件已重新发送，请检查您的邮箱')
    } catch (error) {
      console.error('重新发送验证邮件失败:', error)
      alert('发送失败，请稍后重试')
    } finally {
      setIsResending(false)
    }
  }

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                正在验证邮箱
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                请稍候，我们正在验证您的邮箱地址...
              </p>
            </div>
          </div>
        )

      case 'success':
        return (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                邮箱验证成功！
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                您的邮箱已成功验证，正在跳转到仪表板...
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => router.push('/dashboard')}
                className="w-full"
              >
                立即前往仪表板
              </Button>
            </div>
          </div>
        )

      case 'expired':
      case 'invalid':
      case 'error':
        return (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                验证失败
              </h1>
              <p className="text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
            </div>

            {(status === 'expired' || status === 'error') && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    邮箱地址
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="请输入您的邮箱地址"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleResendEmail}
                  disabled={isResending || !email}
                  className="w-full"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      发送中...
                    </>
                  ) : (
                    '重新发送验证邮件'
                  )}
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <Link href="/auth/login">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回登录
                </Button>
              </Link>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage(){
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailPageComponent />
    </Suspense>
  )
}
