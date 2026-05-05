"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { useForm } from "@tanstack/react-form"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
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

const STATUS_OPTIONS = [
    { label: "全部状态", value: "all" },
    { label: "待支付", value: "pending_payment" },
    { label: "支付超时", value: "payment_timeout" },
    { label: "待接单", value: "pending_acceptance" },
    { label: "待服务/待完成确认", value: "paid" },
    { label: "服务人员拒单", value: "staff_rejected" },
    { label: "已完成", value: "completed" },
    { label: "已取消", value: "cancelled" },
    { label: "已退款", value: "refunded" },
]

const ASSIGNMENT_OPTIONS = [
    { label: "全部分配方式", value: "all" },
    { label: "系统指派", value: "system_auto" },
    { label: "用户指定", value: "customer_designated" },
    { label: "抢单", value: "grab" },
]

export type OrdersFilterValues = {
    orderSerial: string
    customerKeyword: string
    servicePersonnelKeyword: string
    status: string
    assignmentType: string
    dateRange: DateRange | undefined
    minAmount: string
    maxAmount: string
}

type OrdersFilterBarProps = {
    defaultValues: OrdersFilterValues
    onApply: (values: OrdersFilterValues) => void
    onReset: () => void
    isSubmitting?: boolean
}

export function OrdersFilterBar({
    defaultValues,
    onApply,
    onReset,
    isSubmitting,
}: OrdersFilterBarProps) {
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
                <form.Field name="orderSerial">
                    {(field) => (
                        <FilterField label="订单编号">
                            <Input
                                placeholder="输入订单号关键词"
                                value={field.state.value}
                                onChange={(event) => field.handleChange(event.target.value)}
                                onBlur={field.handleBlur}
                            />
                        </FilterField>
                    )}
                </form.Field>
                <form.Field name="customerKeyword">
                    {(field) => (
                        <FilterField label="用户信息">
                            <Input
                                placeholder="姓名/手机号"
                                value={field.state.value}
                                onChange={(event) => field.handleChange(event.target.value)}
                                onBlur={field.handleBlur}
                            />
                        </FilterField>
                    )}
                </form.Field>
                <form.Field name="servicePersonnelKeyword">
                    {(field) => (
                        <FilterField label="服务人员">
                            <Input
                                placeholder="姓名/手机号"
                                value={field.state.value}
                                onChange={(event) => field.handleChange(event.target.value)}
                                onBlur={field.handleBlur}
                            />
                        </FilterField>
                    )}
                </form.Field>
                <form.Field name="status">
                    {(field) => (
                        <FilterField label="订单状态">
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
                <form.Field name="assignmentType">
                    {(field) => (
                        <FilterField label="分配方式">
                            <Select
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="全部方式" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ASSIGNMENT_OPTIONS.map((option) => (
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
                        <FilterField label="创建时间">
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
                        <FilterField label="最低金额 (¥)">
                            <Input
                                type="number"
                                placeholder="0"
                                min="0"
                                step="0.01"
                                value={field.state.value}
                                onChange={(event) => field.handleChange(event.target.value)}
                                onBlur={field.handleBlur}
                            />
                        </FilterField>
                    )}
                </form.Field>
                <form.Field name="maxAmount">
                    {(field) => (
                        <FilterField label="最高金额 (¥)">
                            <Input
                                type="number"
                                placeholder="不限"
                                min="0"
                                step="0.01"
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
                            orderSerial: "",
                            customerKeyword: "",
                            servicePersonnelKeyword: "",
                            status: "all",
                            assignmentType: "all",
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
                <span>可组合多个条件，导出结果与当前筛选保持一致。</span>
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
