"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { useForm } from "@tanstack/react-form"
import { CalendarIcon, Search } from "lucide-react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { Button } from "@repo/web-ui/components/button"
import { Input } from "@repo/web-ui/components/input"
import { Calendar } from "@repo/web-ui/components/calendar"
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

const STATUS_OPTIONS = [
    { label: "全部状态", value: "all" },
    { label: "待审核", value: "pending" },
    { label: "待渠道处理", value: "approved" },
    { label: "处理中", value: "processing" },
    { label: "已完成", value: "completed" },
    { label: "打款失败", value: "failed" },
    { label: "已取消", value: "cancelled" },
    { label: "已驳回", value: "rejected" },
]

const METHOD_OPTIONS = [
    { label: "全部方式", value: "all" },
    { label: "支付宝", value: "alipay" },
    { label: "微信支付", value: "wechat_pay" },
    { label: "银行转账", value: "bank_transfer" },
]

export type WithdrawalsFilterValues = {
    status: string
    method: string
    keyword: string
    dateRange: DateRange | undefined
    minAmount: string
    maxAmount: string
}

type WithdrawalsFilterBarProps = {
    defaultValues: WithdrawalsFilterValues
    onApply: (values: WithdrawalsFilterValues) => void
    onReset: () => void
    isSubmitting?: boolean
}

export function WithdrawalsFilterBar({
    defaultValues,
    onApply,
    onReset,
    isSubmitting,
}: WithdrawalsFilterBarProps) {
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
                <form.Field name="status">
                    {(field) => (
                        <FilterField label="提现状态">
                            <Select
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="全部状态" />
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

                <form.Field name="method">
                    {(field) => (
                        <FilterField label="提现方式">
                            <Select
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="全部方式" />
                                </SelectTrigger>
                                <SelectContent>
                                    {METHOD_OPTIONS.map((option) => (
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
                        <FilterField label="服务人员 / 账号关键词">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    className="pl-9"
                                    placeholder="姓名、手机号或收款账号"
                                    value={field.state.value}
                                    onChange={(event) => field.handleChange(event.target.value)}
                                    onBlur={field.handleBlur}
                                />
                            </div>
                        </FilterField>
                    )}
                </form.Field>

                <form.Field name="dateRange">
                    {(field) => (
                        <FilterField label="申请时间">
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
                            status: "all",
                            method: "all",
                            keyword: "",
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
                <span>支持按服务人员信息或收款账号模糊搜索提现申请。</span>
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
