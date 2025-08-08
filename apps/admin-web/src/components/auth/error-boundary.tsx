"use client"

import { Component, ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@repo/web-ui/components/button"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class AuthErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('认证错误边界捕获到错误:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
              <div className="space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    出现了一些问题
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    认证过程中发生了错误，请刷新页面重试
                  </p>
                  {this.state.error && (
                    <details className="mt-4 text-left">
                      <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                        查看错误详情
                      </summary>
                      <pre className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded border overflow-auto">
                        {this.state.error.message}
                      </pre>
                    </details>
                  )}
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => window.location.reload()}
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    刷新页面
                  </Button>

                  <Button
                    onClick={() => window.location.href = '/'}
                    variant="outline"
                    className="w-full"
                  >
                    返回首页
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// 简化的错误提示组件
export function AuthErrorMessage({
  error,
  onRetry,
  onDismiss
}: {
  error: string
  onRetry?: () => void
  onDismiss?: () => void
}) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-red-800 dark:text-red-200">
            {error}
          </p>
          {(onRetry || onDismiss) && (
            <div className="mt-3 flex space-x-2">
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  className="text-red-800 border-red-300 hover:bg-red-100 dark:text-red-200 dark:border-red-600 dark:hover:bg-red-900/30"
                >
                  重试
                </Button>
              )}
              {onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDismiss}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                >
                  关闭
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 成功提示组件
export function AuthSuccessMessage({
  message,
  onDismiss
}: {
  message: string
  onDismiss?: () => void
}) {
  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-md dark:bg-green-900/20 dark:border-green-800">
      <div className="flex items-start space-x-3">
        <div className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0">
          ✓
        </div>
        <div className="flex-1">
          <p className="text-sm text-green-800 dark:text-green-200">
            {message}
          </p>
          {onDismiss && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
              >
                关闭
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
