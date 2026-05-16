"use client"

import { useEffect } from "react"
import { useForm } from "@tanstack/react-form"
import { Search, RefreshCcw } from "lucide-react"
import { Button } from "@repo/web-ui/components/button"
import { Input } from "@repo/web-ui/components/input"
import {
    ToggleGroup,
    ToggleGroupItem,
} from "@repo/web-ui/components/toggle-group"
import { cn } from "@repo/web-ui/lib/utils"
import type { ServiceOfferingsGroupMode } from "../_utils/query"

export type ServiceOfferingsFilterValues = {
    keyword: string
    groupMode: ServiceOfferingsGroupMode
}

type ServiceOfferingsFilterBarProps = {
    defaultValues: ServiceOfferingsFilterValues
    onApply: (values: ServiceOfferingsFilterValues) => void
    onRefresh: () => void
    isFetching?: boolean
    isSubmitting?: boolean
}

export function ServiceOfferingsFilterBar({
    defaultValues,
    onApply,
    onRefresh,
    isFetching,
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
        <form
            onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit()
            }}
            className="flex flex-wrap items-center gap-3"
        >
            <form.Field name="keyword">
                {(field) => (
                    <div className="relative min-w-[260px] flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            placeholder="搜索服务人员、手机号或服务名称"
                            value={field.state.value}
                            onChange={(event) =>
                                field.handleChange(event.target.value)
                            }
                            onBlur={field.handleBlur}
                        />
                    </div>
                )}
            </form.Field>

            <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "查询中..." : "查询"}
            </Button>

            <div className="ml-auto flex items-center gap-2">
                <form.Field name="groupMode">
                    {(field) => (
                        <ToggleGroup
                            type="single"
                            size="sm"
                            value={field.state.value}
                            onValueChange={(value) => {
                                if (value) {
                                    field.handleChange(
                                        value as ServiceOfferingsGroupMode,
                                    )
                                    onApply({
                                        ...form.state.values,
                                        groupMode:
                                            value as ServiceOfferingsGroupMode,
                                    })
                                }
                            }}
                            variant="outline"
                        >
                            <ToggleGroupItem value="flat">
                                按提交记录
                            </ToggleGroupItem>
                            <ToggleGroupItem value="by-personnel">
                                按服务人员
                            </ToggleGroupItem>
                        </ToggleGroup>
                    )}
                </form.Field>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isFetching}
                    onClick={onRefresh}
                >
                    <RefreshCcw
                        className={cn(
                            "size-4",
                            isFetching ? "animate-spin" : undefined,
                        )}
                    />
                    刷新
                </Button>
            </div>
        </form>
    )
}
