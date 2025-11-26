"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { useForm } from "@tanstack/react-form"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import type { TransactionType } from "@repo/types"
import { Button } from "@repo/web-ui/components/button"
import { Calendar } from "@repo/web-ui/components/calendar"
import { Input } from "@repo/web-ui/components/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@repo/web-ui/components/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/web-ui/components/select"
import { cn } from "@repo/web-ui/lib/utils"
import {
    DataFilterBar,
    DataFilterBarActions,
    DataFilterBarContent,
    DataFilterBarFooter,
    DataFilterBarResetButton,
} from "@/components/common"

const TRANSACTION_TYPE_OPTIONS: Array<{ label: string; value: string }> = [
    { label: "全部类型", value: "all" },
    { label: "订单收款", value: "payment_received" },
    { label: "服务分成", value: "service_earning" },
    { label: "平台手续费", value: "platform_fee" },
    { label: "提现", value: "withdrawal" },
    { label: "退款支出", value: "refund_paid" },
    { label: "奖金", value: "bonus" },
    { label: "罚金", value: "penalty" },
    { label: "调整", value: "adjustment" },
]

const DIRECTION_OPTIONS = [
    { label: "全部方向", value: "all" },
    { label: "收入", value: "income" },
    { label: "支出", value: "expense" },
]

export type RevenueLogsFilterValues = {
    transactionType: string
    direction: string
    dateRange: DateRange | undefined
    minAmount: string
    maxAmount: string
}

type RevenueLogsFilterBarProps = {
    defaultValues: RevenueLogsFilterValues
    onApply: (values: RevenueLogsFilterValues) => void
    onReset: () => void
    isSubmitting?: boolean
}

export function RevenueLogsFilterBar({
    defaultValues,
    onApply,
    onReset,
    isSubmitting,
}: RevenueLogsFilterBarProps) {
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
                <form.Field name="transactionType">
                    {(field) => (
                        <FilterField label="交易类型">
                            <Select
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="全部类型" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TRANSACTION_TYPE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FilterField>
                    )}
                </form.Field>
                <form.Field name="direction">
                    {(field) => (
                        <FilterField label="收入方向">
                            <Select
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="全部方向" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DIRECTION_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FilterField>
                    )}
                </form.Field>
                <form.Field name="dateRange">
                    {(field) => (
                        <FilterField label="发生时间">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !field.state.value?.from && !field.state.value?.to
                                                ? "text-muted-foreground"
                                                : "",
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 size-4" />
                                        {renderDateRangeLabel(field.state.value)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="range"
                                        selected={field.state.value}
                                        onSelect={(range) => field.handleChange(range)}
                                        numberOfMonths={2}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </FilterField>
                    )}
                </form.Field>
                <form.Field name="minAmount">
                    {(field) => (
                        <FilterField label="最小金额 (¥)">
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                value={field.state.value}
                                onChange={(event) => field.handleChange(event.target.value)}
                                onBlur={field.handleBlur}
                            />
                        </FilterField>
                    )}
                </form.Field>
                <form.Field name="maxAmount">
                    {(field) => (
                        <FilterField label="最大金额 (¥)">
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="不限"
                                value={field.state.value}
                                onChange={(event) => field.handleChange(event.target.value)}
                                onBlur={field.handleBlur}
                            />
                        </FilterField>
                    )}
                </form.Field>
            </DataFilterBarContent>
            <DataFilterBarActions>
                <DataFilterBarResetButton
                    onClick={() => {
                        onReset()
                        form.reset({
                            transactionType: "all",
                            direction: "all",
                            dateRange: undefined,
                            minAmount: "",
                            maxAmount: "",
                        })
                    }}
                />
                <Button type="submit" size="sm" disabled={isSubmitting}>
                    {isSubmitting ? "筛选中..." : "查询"}
                </Button>
            </DataFilterBarActions>
            <DataFilterBarFooter>
                <span>组合时间、类型与金额区间即可定位异常收入或支出。</span>
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

function renderDateRangeLabel(range?: DateRange) {
    if (range?.from && range.to) {
        return `${format(range.from, "yyyy/MM/dd")} - ${format(range.to, "yyyy/MM/dd")}`
    }
    if (range?.from) {
        return format(range.from, "yyyy/MM/dd")
    }
    return "选择时间范围"
}
