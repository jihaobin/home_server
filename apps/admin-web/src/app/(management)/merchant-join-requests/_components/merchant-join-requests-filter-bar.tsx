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

const CONTACT_STATUS_OPTIONS = [
    { label: "全部线索", value: "all" },
    { label: "已联系", value: "contacted" },
    { label: "未联系", value: "uncontacted" },
]

export type MerchantJoinRequestsFilterValues = {
    keyword: string
    contactStatus: string
}

type MerchantJoinRequestsFilterBarProps = {
    defaultValues: MerchantJoinRequestsFilterValues
    onApply: (values: MerchantJoinRequestsFilterValues) => void
    onReset: () => void
    isSubmitting?: boolean
}

export function MerchantJoinRequestsFilterBar({
    defaultValues,
    onApply,
    onReset,
    isSubmitting,
}: MerchantJoinRequestsFilterBarProps) {
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
                <form.Field name="contactStatus">
                    {(field) => (
                        <FilterField label="联系状态">
                            <Select
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="全部线索" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CONTACT_STATUS_OPTIONS.map((option) => (
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
                                    placeholder="姓名、手机号或意向城市"
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
                            contactStatus: "all",
                        })
                    }}
                />
                <Button type="submit" size="sm" disabled={isSubmitting}>
                    {isSubmitting ? "筛选中..." : "查询"}
                </Button>
            </DataFilterBarActions>
            <DataFilterBarFooter>
                <span>支持按姓名、手机号、意向城市搜索加盟线索。</span>
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
