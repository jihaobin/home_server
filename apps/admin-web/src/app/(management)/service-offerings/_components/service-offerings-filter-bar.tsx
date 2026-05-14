"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { useForm } from "@tanstack/react-form"
import { Search } from "lucide-react"
import { Button } from "@repo/web-ui/components/button"
import { Input } from "@repo/web-ui/components/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/web-ui/components/select"
import {
    DataFilterBar,
    DataFilterBarActions,
    DataFilterBarContent,
    DataFilterBarFooter,
    DataFilterBarResetButton,
} from "@/components/common"

const STATUS_OPTIONS = [
    { label: "全部类型", value: "all" },
    { label: "待审核草稿", value: "pending" },
    { label: "已发布服务", value: "published" },
] as const

const REVIEW_STATUS_OPTIONS = [
    { label: "全部审核状态", value: "all" },
    { label: "待审核", value: "pending" },
    { label: "已通过", value: "approved" },
    { label: "已拒绝", value: "rejected" },
] as const

const PUBLICATION_STATUS_OPTIONS = [
    { label: "全部发布状态", value: "all" },
    { label: "上架中", value: "active" },
    { label: "已下架", value: "taken_down" },
] as const

export type ServiceOfferingsFilterValues = {
    keyword: string
    status: string
    reviewStatus: string
    publicationStatus: string
}

type ServiceOfferingsFilterBarProps = {
    defaultValues: ServiceOfferingsFilterValues
    onApply: (values: ServiceOfferingsFilterValues) => void
    onReset: () => void
    isSubmitting?: boolean
}

export function ServiceOfferingsFilterBar({
    defaultValues,
    onApply,
    onReset,
    isSubmitting,
}: ServiceOfferingsFilterBarProps) {
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
            className="shadow-none"
            onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit()
            }}
        >
            <DataFilterBarContent>
                <form.Field name="status">
                    {(field) => (
                        <FilterField label="列表类型">
                            <Select
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="全部类型" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FilterField>
                    )}
                </form.Field>
                <form.Field name="reviewStatus">
                    {(field) => (
                        <FilterField label="审核状态">
                            <Select
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="全部审核状态" />
                                </SelectTrigger>
                                <SelectContent>
                                    {REVIEW_STATUS_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FilterField>
                    )}
                </form.Field>
                <form.Field name="publicationStatus">
                    {(field) => (
                        <FilterField label="发布状态">
                            <Select
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="全部发布状态" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PUBLICATION_STATUS_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FilterField>
                    )}
                </form.Field>
                <form.Field name="keyword">
                    {(field) => (
                        <FilterField label="关键词">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    className="pl-9"
                                    placeholder="服务人员、手机号或服务名称"
                                    value={field.state.value}
                                    onChange={(event) =>
                                        field.handleChange(event.target.value)
                                    }
                                    onBlur={field.handleBlur}
                                />
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
                            keyword: "",
                            status: "all",
                            reviewStatus: "all",
                            publicationStatus: "all",
                        })
                    }}
                />
                <Button type="submit" size="sm" disabled={isSubmitting}>
                    {isSubmitting ? "筛选中..." : "查询"}
                </Button>
            </DataFilterBarActions>
            <DataFilterBarFooter>
                <span>支持按服务人员、手机号、服务名称筛选审核与上架状态。</span>
            </DataFilterBarFooter>
        </DataFilterBar>
    )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{label}</label>
            {children}
        </div>
    )
}
