"use client"

import { useEffect } from "react"
import { useForm, type AnyFieldApi } from "@tanstack/react-form"
import { z } from "zod/v4"
import type { AdminMerchantJoinRequest } from "@repo/types"
import { useUpdateAdminMerchantJoinRequest } from "@repo/hooks/api/ssr"
import { Button } from "@repo/web-ui/components/button"
import { Label } from "@repo/web-ui/components/label"
import { Switch } from "@repo/web-ui/components/switch"
import { Textarea } from "@repo/web-ui/components/textarea"
import {
    EntityDrawer,
    EntityDrawerBody,
    EntityDrawerContent,
    EntityDrawerHeader,
    EntityDrawerProperty,
    EntityDrawerSection,
    EntityDrawerTitle,
} from "@/components/common"
import type { MerchantJoinRequestsQueryState } from "../_utils/query"
import { toast } from "sonner"

type MerchantJoinRequestDetailDrawerProps = {
    merchantJoinRequest: AdminMerchantJoinRequest | null
    open: boolean
    onOpenChange: (open: boolean) => void
    query: MerchantJoinRequestsQueryState
    onMerchantJoinRequestUpdated?: (request: AdminMerchantJoinRequest) => void
}

type FormValues = {
    isContacted: boolean
    adminRemark: string
}

const MerchantJoinRequestFormSchema = z.object({
    isContacted: z.boolean(),
    adminRemark: z.string().max(2000, "管理员备注不能超过 2000 个字符"),
})

export function MerchantJoinRequestDetailDrawer({
    merchantJoinRequest,
    open,
    onOpenChange,
    query,
    onMerchantJoinRequestUpdated,
}: MerchantJoinRequestDetailDrawerProps) {
    const updateMutation = useUpdateAdminMerchantJoinRequest(query)

    const defaultValues: FormValues = {
        isContacted: merchantJoinRequest?.isContacted ?? false,
        adminRemark: merchantJoinRequest?.adminRemark ?? "",
    }

    const form = useForm({
        defaultValues,
        validators: {
            onSubmit: MerchantJoinRequestFormSchema,
        },
        onSubmit: async ({ value }) => {
            if (!merchantJoinRequest) {
                return
            }

            const parsed = MerchantJoinRequestFormSchema.parse(value)
            const trimmedRemark = parsed.adminRemark.trim()

            try {
                const updated = await updateMutation.mutateAsync({
                    merchantJoinRequestId: merchantJoinRequest.id,
                    payload: {
                        isContacted: parsed.isContacted,
                        adminRemark: trimmedRemark ? trimmedRemark : null,
                    },
                })
                onMerchantJoinRequestUpdated?.(updated)
                toast.success("加盟申请已更新")
                onOpenChange(false)
            } catch (error) {
                toast.error(`保存失败：${getErrorMessage(error)}`)
            }
        },
    })

    useEffect(() => {
        if (open) {
            form.reset(defaultValues)
        }
    }, [defaultValues, form, open])

    return (
        <EntityDrawer open={open} onOpenChange={onOpenChange} direction="right">
            <EntityDrawerContent width="lg">
                <EntityDrawerHeader>
                    <EntityDrawerTitle>加盟申请详情</EntityDrawerTitle>
                </EntityDrawerHeader>
                <EntityDrawerBody className="gap-6">
                    {merchantJoinRequest ? (
                        <>
                            <section className="space-y-3 rounded-2xl border bg-card/60 px-5 py-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex flex-col">
                                        <span className="text-lg font-semibold leading-tight">
                                            {merchantJoinRequest.merchantName}
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            申请 ID：{merchantJoinRequest.id}
                                        </span>
                                    </div>
                                    <div className="ml-auto inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-foreground">
                                        {merchantJoinRequest.isContacted
                                            ? "已联系"
                                            : "未联系"}
                                    </div>
                                </div>
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            手机号
                                        </p>
                                        <p className="text-2xl font-semibold">
                                            {merchantJoinRequest.phone}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            意向合作城市
                                        </p>
                                        <p className="font-medium">
                                            {merchantJoinRequest.intentCity}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatGender(merchantJoinRequest.gender)} · {merchantJoinRequest.age} 岁
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <EntityDrawerSection title="申请信息">
                                <div className="space-y-3 rounded-xl border px-4 py-3">
                                    <EntityDrawerProperty
                                        label="提交时间"
                                        value={formatDateTime(merchantJoinRequest.createdAt)}
                                    />
                                    <EntityDrawerProperty
                                        label="更新时间"
                                        value={formatDateTime(merchantJoinRequest.updatedAt)}
                                    />
                                    <EntityDrawerProperty
                                        label="联系时间"
                                        value={
                                            formatDateTime(merchantJoinRequest.contactedAt) ||
                                            "—"
                                        }
                                    />
                                    <EntityDrawerProperty
                                        label="照片文件 ID"
                                        value={merchantJoinRequest.photoFileId ?? "—"}
                                    />
                                </div>
                            </EntityDrawerSection>

                            <EntityDrawerSection title="近期照">
                                <div className="space-y-3 rounded-xl border px-4 py-4">
                                    {merchantJoinRequest.photoFileUrl ? (
                                        <>
                                            <img
                                                src={merchantJoinRequest.photoFileUrl}
                                                alt={`${merchantJoinRequest.merchantName}近期照`}
                                                className="h-64 w-full rounded-xl border object-cover"
                                            />
                                            <a
                                                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                                                href={merchantJoinRequest.photoFileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                新标签页查看原图
                                            </a>
                                        </>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            申请人未上传近期照。
                                        </p>
                                    )}
                                </div>
                            </EntityDrawerSection>

                            <EntityDrawerSection title="联系跟进">
                                <form
                                    className="space-y-4 rounded-xl border px-4 py-4"
                                    onSubmit={(event) => {
                                        event.preventDefault()
                                        void form.handleSubmit()
                                    }}
                                >
                                    <form.Field name="isContacted">
                                        {(field) => (
                                            <div className="flex items-center justify-between rounded-lg border px-3 py-3">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium text-foreground">
                                                        已联系申请人
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        标记后可帮助运营区分已跟进与待回访线索。
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={field.state.value}
                                                    onCheckedChange={(checked) =>
                                                        field.handleChange(Boolean(checked))
                                                    }
                                                    disabled={updateMutation.isPending}
                                                />
                                            </div>
                                        )}
                                    </form.Field>

                                    <form.Field
                                        name="adminRemark"
                                        validators={{
                                            onChange:
                                                MerchantJoinRequestFormSchema.shape.adminRemark,
                                        }}
                                    >
                                        {(field) => (
                                            <div className="space-y-2">
                                                <Label htmlFor="merchant-join-request-admin-remark">
                                                    管理员备注
                                                </Label>
                                                <Textarea
                                                    id="merchant-join-request-admin-remark"
                                                    rows={5}
                                                    placeholder="记录电话沟通情况、回访计划或补充信息"
                                                    value={field.state.value}
                                                    onChange={(event) =>
                                                        field.handleChange(event.target.value)
                                                    }
                                                    onBlur={field.handleBlur}
                                                    disabled={updateMutation.isPending}
                                                />
                                                <div className="flex items-center justify-between gap-3">
                                                    <FieldError field={field} />
                                                    <span className="text-xs text-muted-foreground">
                                                        {field.state.value.length}/2000
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </form.Field>

                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => onOpenChange(false)}
                                            disabled={updateMutation.isPending}
                                        >
                                            取消
                                        </Button>
                                        <Button type="submit" disabled={updateMutation.isPending}>
                                            {updateMutation.isPending ? "保存中..." : "保存变更"}
                                        </Button>
                                    </div>
                                </form>
                            </EntityDrawerSection>
                        </>
                    ) : (
                        <EmptyState />
                    )}
                </EntityDrawerBody>
            </EntityDrawerContent>
        </EntityDrawer>
    )
}

function EmptyState() {
    return (
        <div className="flex min-h-80 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            请选择一条商户加盟申请查看详情。
        </div>
    )
}

function FieldError({ field }: { field: AnyFieldApi }) {
    const error = field.state.meta.errors[0]
    if (!error) {
        return null
    }

    return <p className="text-xs text-destructive">{String(error)}</p>
}

function formatGender(value: AdminMerchantJoinRequest["gender"]) {
    return value === "male" ? "男" : "女"
}

function formatDateTime(value?: string | null) {
    if (!value) {
        return ""
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }

    return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message
    }

    return "请稍后重试"
}
