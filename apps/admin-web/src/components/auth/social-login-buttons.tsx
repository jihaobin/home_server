"use client"

import { useState } from "react"
import { Github } from "lucide-react"
import { socialLogin, wechatLogin } from "@/lib/auth"
import { Button } from "@repo/web-ui/components/button"

interface SocialLoginButtonsProps {
  onLoading?: (loading: boolean) => void
}

export function SocialLoginButtons({ onLoading }: SocialLoginButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)

  const handleSocialLogin = async (provider: string) => {
    try {
      setLoadingProvider(provider)
      onLoading?.(true)

      if (provider === "wechat") {
        // 使用 OAuth2 方法进行微信登录
        await wechatLogin()
      } else {
        // 其他社交登录使用原有方法
        await socialLogin({
          provider,
        })
      }
    } catch (error) {
      console.error(`${provider} 登录失败:`, error)
    } finally {
      setLoadingProvider(null)
      onLoading?.(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        className="w-full h-11 text-sm font-medium"
        onClick={() => handleSocialLogin("github")}
        disabled={loadingProvider !== null}
      >
        {loadingProvider === "github" ? (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
        ) : (
          <Github className="w-4 h-4 mr-2" />
        )}
        使用 GitHub 登录
      </Button>

      <Button
        variant="outline"
        className="w-full h-11 text-sm font-medium bg-green-50 hover:bg-green-100 border-green-200 text-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:border-green-800 dark:text-green-400"
        onClick={() => handleSocialLogin("wechat")}
        disabled={loadingProvider !== null}
      >
        {loadingProvider === "wechat" ? (
          <div className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin mr-2" />
        ) : (
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 4.882-1.932 7.621-.55-.302-2.676-2.476-4.824-5.362-4.824zm-2.44 5.11c-.547 0-.99-.44-.99-.982a.988.988 0 0 1 .99-.983c.547 0 .99.441.99.983a.988.988 0 0 1-.99.982zm4.772 0c-.547 0-.99-.44-.99-.982a.988.988 0 0 1 .99-.983c.547 0 .99.441.99.983a.988.988 0 0 1-.99.982z"/>
            <path d="M15.724 9.91c-4.015 0-7.269 2.693-7.269 6.01 0 1.925 1.016 3.658 2.613 4.833a.513.513 0 0 1 .185.577l-.34 1.284c-.017.061-.042.123-.042.185 0 .142.113.257.252.257a.284.284 0 0 0 .145-.047l1.653-.967a.75.75 0 0 1 .623-.085c.47.119.965.18 1.48.18 4.015 0 7.269-2.693 7.269-6.01s-3.254-6.01-7.269-6.01zm-2.44 4.827c-.475 0-.862-.382-.862-.854 0-.471.387-.854.862-.854s.862.383.862.854c0 .472-.387.854-.862.854zm4.772 0c-.475 0-.862-.382-.862-.854 0-.471.387-.854.862-.854s.862.383.862.854c0 .472-.387.854-.862.854z"/>
          </svg>
        )}
        使用微信登录
      </Button>
    </div>
  )
}
