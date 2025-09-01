import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ErrorBoundary } from 'react-error-boundary';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { AlertCircle } from '@repo/mobile-ui/lib/icons/AlertCicle';
import { RotateCcw } from '@repo/mobile-ui/lib/icons/RotateCcw';

// 错误回退组件类型
interface ErrorFallbackProps {
    error: Error;
    resetErrorBoundary: () => void;
}

// 城市搜索错误回退组件
function CitySearchErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
    return (
        <View className="bg-white absolute z-10 w-full h-full items-center justify-center p-6">
            <AlertCircle size={40} className="text-destructive mb-3" />
            <Text className="text-base font-medium text-foreground mb-2 text-center">
                搜索服务暂时不可用
            </Text>
            <Text className="text-sm text-muted-foreground mb-4 text-center">
                无法获取城市搜索结果，请检查网络连接后重试
            </Text>
            <Pressable
                onPress={resetErrorBoundary}
                className="flex-row items-center px-3 py-2 bg-primary rounded-md"
            >
                <RotateCcw size={14} className="text-primary-foreground mr-1" />
                <Text className="text-primary-foreground text-sm">重新搜索</Text>
            </Pressable>
        </View>
    );
}

// 地址建议错误回退组件
function AddressSuggestionErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
    return (
        <View className="bg-white absolute z-10 w-full h-full items-center justify-center p-6">
            <AlertCircle size={40} className="text-destructive mb-3" />
            <Text className="text-base font-medium text-foreground mb-2 text-center">
                地址搜索出错了
            </Text>
            <Text className="text-sm text-muted-foreground mb-4 text-center">
                无法加载地址建议，请稍后重试
            </Text>
            <Pressable
                onPress={resetErrorBoundary}
                className="flex-row items-center px-3 py-2 bg-primary rounded-md"
            >
                <RotateCcw size={14} className="text-primary-foreground mr-1" />
                <Text className="text-primary-foreground text-sm">重新加载</Text>
            </Pressable>
        </View>
    );
}

// 主内容错误回退组件
function MainContentErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
    return (
        <View className="flex-1 items-center justify-center p-6 bg-white">
            <AlertCircle size={48} className="text-destructive mb-4" />
            <Text className="text-lg font-semibold text-foreground mb-2 text-center">
                页面加载失败
            </Text>
            <Text className="text-sm text-muted-foreground mb-6 text-center">
                无法加载城市选择页面，请检查网络连接
            </Text>
            <Pressable
                onPress={resetErrorBoundary}
                className="flex-row items-center px-4 py-2 bg-primary rounded-lg"
            >
                <RotateCcw size={16} className="text-primary-foreground mr-2" />
                <Text className="text-primary-foreground font-medium">重新加载</Text>
            </Pressable>
        </View>
    );
}

// 城市搜索错误边界组件
export function CitySearchErrorBoundary({ children }: { children: React.ReactNode }) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    fallbackRender={CitySearchErrorFallback}
                    onReset={reset}
                >
                    {children}
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    );
}

// 地址建议错误边界组件
export function AddressSuggestionErrorBoundary({ children }: { children: React.ReactNode }) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    fallbackRender={AddressSuggestionErrorFallback}
                    onReset={reset}
                >
                    {children}
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    );
}

// 主内容错误边界组件
export function MainContentErrorBoundary({ children }: { children: React.ReactNode }) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    fallbackRender={MainContentErrorFallback}
                    onReset={reset}
                >
                    {children}
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    );
}
