"use client"

import { useEffect } from "react"
import { useForm } from "@tanstack/react-form"
import { Input } from "@repo/web-ui/components/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/web-ui/components/select"
import { Button } from "@repo/web-ui/components/button"
import {
    DataFilterBar,
    DataFilterBarActions,
    DataFilterBarContent,
    DataFilterBarFooter,
    DataFilterBarResetButton,
} from "@/components/common"

export type UsersFilterValues = {
    name: string
    phone: string
    role: string
    status: string
}

type UsersFilterBarProps = {
    defaultValues: UsersFilterValues
    onApply: (values: UsersFilterValues) => void
    onReset: () => void
    isSubmitting?: boolean
}

const roleOptions: Array<{ label: string; value: string }> = [
    { label: "全部角色", value: "all" },
    { label: "普通用户", value: "customer" },
    { label: "服务人员", value: "service_personnel" },
    { label: "店铺管理员", value: "shop_admin" },
    { label: "平台管理员", value: "admin" },
    { label: "超级管理员", value: "super_admin" },
]

const statusOptions = [
    { label: "全部状态", value: "all" },
    { label: "启用", value: "active" },
    { label: "禁用", value: "inactive" },
]

export function UsersFilterBar({
    defaultValues,
    onApply,
    onReset,
    isSubmitting,
}: UsersFilterBarProps) {
    const form = useForm({
        defaultValues,
        onSubmit: async ({ value }) => {
            onApply(value)
        },
    })

    useEffect(() => {
        form.reset(defaultValues)
    }, [defaultValues, form])

    return (
        <DataFilterBar
            onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit()
            }}
            className="shadow-none"
        >
            <DataFilterBarContent>
                <form.Field name="name">
                    {(field) => (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">
                                用户名
                            </label>
                            <Input
                                placeholder="输入用户名关键词"
                                value={field.state.value}
                                onChange={(event) =>
                                    field.handleChange(event.target.value)
                                }
                                onBlur={field.handleBlur}
                            />
                        </div>
                    )}
                </form.Field>
                <form.Field name="phone">
                    {(field) => (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">
                                手机号
                            </label>
                            <Input
                                placeholder="支持模糊匹配"
                                value={field.state.value}
                                onChange={(event) =>
                                    field.handleChange(event.target.value)
                                }
                                onBlur={field.handleBlur}
                                inputMode="numeric"
                            />
                        </div>
                    )}
                </form.Field>
                <form.Field name="role">
                    {(field) => (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">
                                角色
                            </label>
                            <Select
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="全部角色" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roleOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </form.Field>
                <form.Field name="status">
                    {(field) => (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">
                                状态
                            </label>
                            <Select
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="全部状态" />
                                </SelectTrigger>
                                <SelectContent>
                                    {statusOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </form.Field>
            </DataFilterBarContent>
            <DataFilterBarActions>
                <DataFilterBarResetButton
                    onClick={() => {
                        onReset()
                        form.reset({
                            name: "",
                            phone: "",
                            role: "all",
                            status: "all",
                        })
                    }}
                />
                <Button type="submit" size="sm" disabled={isSubmitting}>
                    {isSubmitting ? "筛选中..." : "查询"}
                </Button>
            </DataFilterBarActions>
            <DataFilterBarFooter>
                <span>最多支持同时组合 4 个条件，导出遵循当前筛选范围。</span>
            </DataFilterBarFooter>
        </DataFilterBar>
    )
}
