"use client"

import { useEffect } from "react"
import { useForm } from "@tanstack/react-form"
import { Button } from "@repo/web-ui/components/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/web-ui/components/select"
import { Switch } from "@repo/web-ui/components/switch"
import {
    DataFilterBar,
    DataFilterBarActions,
    DataFilterBarContent,
    DataFilterBarFooter,
    DataFilterBarResetButton,
} from "@/components/common"

const APP_OPTIONS = [
    { label: "全部应用", value: "all" },
    { label: "用户端", value: "mobile-user" },
    { label: "服务人员端", value: "mobile-worker" },
]

const PLATFORM_OPTIONS = [
    { label: "全部平台", value: "all" },
    { label: "Android", value: "android" },
    { label: "iOS", value: "ios" },
]

export type AppReleasesFilterValues = {
    app: string
    platform: string
    activeOnly: boolean
}

type AppReleasesFilterBarProps = {
    defaultValues: AppReleasesFilterValues
    onApply: (values: AppReleasesFilterValues) => void
    onReset: () => void
    isSubmitting?: boolean
}

export function AppReleasesFilterBar({
    defaultValues,
    onApply,
    onReset,
    isSubmitting,
}: AppReleasesFilterBarProps) {
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
                <form.Field name="app">
                    {(field) => (
                        <FilterField label="应用">
                            <Select
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="全部应用" />
                                </SelectTrigger>
                                <SelectContent>
                                    {APP_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FilterField>
                    )}
                </form.Field>
                <form.Field name="platform">
                    {(field) => (
                        <FilterField label="平台">
                            <Select
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="全部平台" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PLATFORM_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FilterField>
                    )}
                </form.Field>
                <form.Field name="activeOnly">
                    {(field) => (
                        <FilterField label="仅看允许下载">
                            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                                <Switch
                                    checked={field.state.value}
                                    onCheckedChange={(value) => field.handleChange(value)}
                                />
                                <span className="text-sm text-muted-foreground">
                                    只展示允许用户下载的版本
                                </span>
                            </div>
                        </FilterField>
                    )}
                </form.Field>
            </DataFilterBarContent>
            <DataFilterBarActions>
                <DataFilterBarResetButton
                    onClick={() => {
                        onReset()
                        form.reset({
                            app: "all",
                            platform: "all",
                            activeOnly: false,
                        })
                    }}
                />
                <Button type="submit" size="sm" disabled={isSubmitting}>
                    {isSubmitting ? "筛选中..." : "应用筛选"}
                </Button>
            </DataFilterBarActions>
            <DataFilterBarFooter>
                <span>按应用/平台筛选，并可一键查看当前允许下载的版本。</span>
            </DataFilterBarFooter>
        </DataFilterBar>
    )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{label}</label>
            {children}
        </div>
    )
}
