"use client"

import { useEffect } from "react"
import { useForm, type AnyFieldApi } from "@tanstack/react-form"
import { z } from "zod/v4"
import type {
    AdminServiceTag,
    CreateAdminServiceTagInput,
    UpdateAdminServiceTagInput,
} from "@repo/types"
import { Button } from "@repo/web-ui/components/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@repo/web-ui/components/dialog"
import { Input } from "@repo/web-ui/components/input"
import { Label } from "@repo/web-ui/components/label"
import { Switch } from "@repo/web-ui/components/switch"
import { Textarea } from "@repo/web-ui/components/textarea"

type BaseServiceTagFormDialogProps = {
    open: boolean
    onClose: () => void
    isSubmitting: boolean
}

type CreateServiceTagFormDialogProps = BaseServiceTagFormDialogProps & {
    mode: "create"
    tag?: never
    onSubmit: (payload: CreateAdminServiceTagInput) => Promise<void>
}

type EditServiceTagFormDialogProps = BaseServiceTagFormDialogProps & {
    mode: "edit"
    tag: AdminServiceTag | null
    onSubmit: (payload: UpdateAdminServiceTagInput) => Promise<void>
}

type ServiceTagFormDialogProps =
    | CreateServiceTagFormDialogProps
    | EditServiceTagFormDialogProps

type ServiceTagFormValues = {
    name: string
    slug: string
    sortOrder: string
    description: string
    isActive: boolean
}

const ServiceTagFormSchema = z.object({
    name: z.string().trim().min(1, "请输入标签名称").max(100, "名称不超过 100 字"),
    slug: z.string().trim().min(1, "请输入 slug").max(100, "slug 不超过 100 字"),
    sortOrder: z
        .string()
        .trim()
        .min(1, "请输入排序值")
        .refine((value) => /^\d+$/.test(value), "请输入大于等于 0 的整数"),
    description: z.string().max(300, "描述不超过 300 字"),
    isActive: z.boolean(),
})

export function ServiceTagFormDialog({
    open,
    mode,
    tag,
    onClose,
    onSubmit,
    isSubmitting,
}: ServiceTagFormDialogProps) {
    const defaultValues: ServiceTagFormValues = {
        name: tag?.name ?? "",
        slug: tag?.slug ?? "",
        sortOrder:
            tag?.sortOrder !== undefined ? String(tag.sortOrder) : String(0),
        description: tag?.description ?? "",
        isActive: tag?.isActive ?? true,
    }

    const form = useForm({
        defaultValues,
        validators: {
            onSubmit: ServiceTagFormSchema,
        },
        onSubmit: async ({ value }) => {
            const parsed = ServiceTagFormSchema.parse(value)
            const payload = {
                name: parsed.name.trim(),
                slug: parsed.slug.trim(),
                sortOrder: Number(parsed.sortOrder),
                description: parsed.description.trim()
                    ? parsed.description.trim()
                    : null,
                isActive: parsed.isActive,
            }

            if (mode === "create") {
                await onSubmit({
                    ...payload,
                    domain: "massage" as const,
                })
                return
            }

            await onSubmit(payload)
        },
    })

    useEffect(() => {
        if (open) {
            form.reset(defaultValues)
        }
    }, [defaultValues, form, open])

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "create" ? "新增服务标签" : "编辑服务标签"}
                    </DialogTitle>
                    <DialogDescription>
                        仅允许维护 `massage` 域标签。排序值越小越靠前。
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="space-y-5"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void form.handleSubmit()
                    }}
                >
                    <div className="grid gap-4 md:grid-cols-2">
                        <form.Field
                            name="name"
                            validators={{
                                onChange: ServiceTagFormSchema.shape.name,
                            }}
                        >
                            {(field) => (
                                <div className="space-y-2">
                                    <Label>标签名称</Label>
                                    <Input
                                        value={field.state.value}
                                        onChange={(event) =>
                                            field.handleChange(event.target.value)
                                        }
                                        onBlur={field.handleBlur}
                                        placeholder="如 调理放松"
                                    />
                                    <FieldError field={field} />
                                </div>
                            )}
                        </form.Field>

                        <form.Field
                            name="slug"
                            validators={{
                                onChange: ServiceTagFormSchema.shape.slug,
                            }}
                        >
                            {(field) => (
                                <div className="space-y-2">
                                    <Label>Slug</Label>
                                    <Input
                                        value={field.state.value}
                                        onChange={(event) =>
                                            field.handleChange(event.target.value)
                                        }
                                        onBlur={field.handleBlur}
                                        placeholder="如 relaxation"
                                    />
                                    <FieldError field={field} />
                                </div>
                            )}
                        </form.Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <form.Field
                            name="sortOrder"
                            validators={{
                                onChange: ServiceTagFormSchema.shape.sortOrder,
                            }}
                        >
                            {(field) => (
                                <div className="space-y-2">
                                    <Label>排序值</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={field.state.value}
                                        onChange={(event) =>
                                            field.handleChange(event.target.value)
                                        }
                                        onBlur={field.handleBlur}
                                    />
                                    <FieldError field={field} />
                                </div>
                            )}
                        </form.Field>

                        <div className="rounded-lg border bg-muted/30 px-3 py-3">
                            <p className="text-sm font-medium">业务域</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                massage（上门按摩）
                            </p>
                        </div>
                    </div>

                    <form.Field
                        name="description"
                        validators={{
                            onChange: ServiceTagFormSchema.shape.description,
                        }}
                    >
                        {(field) => (
                            <div className="space-y-2">
                                <Label>描述</Label>
                                <Textarea
                                    rows={4}
                                    placeholder="补充标签使用场景或维护说明"
                                    value={field.state.value}
                                    onChange={(event) =>
                                        field.handleChange(event.target.value)
                                    }
                                    onBlur={field.handleBlur}
                                />
                                <FieldError field={field} />
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="isActive">
                        {(field) => (
                            <div className="flex items-center justify-between rounded-lg border px-3 py-3">
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        启用状态
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        停用后保留既有绑定，但不可再用于新的服务绑定
                                    </p>
                                </div>
                                <Switch
                                    checked={field.state.value}
                                    onCheckedChange={(checked) =>
                                        field.handleChange(Boolean(checked))
                                    }
                                />
                            </div>
                        )}
                    </form.Field>

                    <DialogFooter>
                        <form.Subscribe
                            selector={(state) => [
                                state.canSubmit,
                                state.isSubmitting,
                            ]}
                        >
                            {([canSubmit, isFormSubmitting]) => (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={onClose}
                                        disabled={isSubmitting}
                                    >
                                        取消
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={
                                            !canSubmit ||
                                            isSubmitting ||
                                            isFormSubmitting
                                        }
                                    >
                                        {isSubmitting || isFormSubmitting
                                            ? "提交中..."
                                            : mode === "create"
                                              ? "创建"
                                              : "保存"}
                                    </Button>
                                </>
                            )}
                        </form.Subscribe>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function FieldError({ field }: { field: AnyFieldApi }) {
    if (!field.state.meta.errors.length) {
        return null
    }

    return (
        <p className="text-xs text-destructive">
            {String(field.state.meta.errors[0]?.message)}
        </p>
    )
}
