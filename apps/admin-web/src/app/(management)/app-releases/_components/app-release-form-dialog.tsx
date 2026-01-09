"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useForm, type AnyFieldApi } from "@tanstack/react-form"
import { z } from "zod/v4"
import {
    AdminCreateAppReleaseSchema,
    AdminUpdateAppReleaseSchema,
    AppReleaseAppEnum,
    AppReleasePlatformEnum,
    type AppReleaseListItem,
} from "@repo/types"
import { useUploadFile } from "@repo/hooks/api/files"
import {
    useCreateAdminAppRelease,
    useUpdateAdminAppRelease,
} from "@repo/hooks/api/ssr"
import { ApiClientError } from "@repo/utils/api-client"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@repo/web-ui/components/dialog"
import { Button } from "@repo/web-ui/components/button"
import { Input } from "@repo/web-ui/components/input"
import { Label } from "@repo/web-ui/components/label"
import { Textarea } from "@repo/web-ui/components/textarea"
import { Switch } from "@repo/web-ui/components/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/web-ui/components/select"
import { ScrollArea } from "@repo/web-ui/components/scroll-area"
import { UploadField, type UploadValue } from "@repo/web-ui/upload"
import { cn } from "@repo/web-ui/lib/utils"
import { toast } from "sonner"

type AppReleaseFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    mode: "create" | "edit"
    initialData?: AppReleaseListItem
    onSuccess?: () => void
}

type FormValues = z.input<typeof AdminCreateAppReleaseSchema>

const createFormSchema = AdminCreateAppReleaseSchema.superRefine(
    (data, ctx) => {
        if (!data.fileId && !data.downloadUrlOverride) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "请上传 APK 或填写下载外链",
                path: ["fileId"],
            })
        }
    },
)

const APP_OPTIONS = [
    { label: "用户端", value: AppReleaseAppEnum.enum["mobile-user"] },
    { label: "服务人员端", value: AppReleaseAppEnum.enum["mobile-worker"] },
]

const PLATFORM_OPTIONS = [
    { label: "Android", value: AppReleasePlatformEnum.enum.android },
    { label: "iOS", value: AppReleasePlatformEnum.enum.ios },
]

export function AppReleaseFormDialog({
    open,
    onOpenChange,
    mode,
    initialData,
    onSuccess,
}: AppReleaseFormDialogProps) {
    const createMutation = useCreateAdminAppRelease()
    const updateMutation = useUpdateAdminAppRelease()
    const uploadFile = useUploadFile()

    const defaultValues = useMemo<FormValues>(() => {
        if (mode === "edit" && initialData) {
            return {
                app: initialData.app,
                platform: initialData.platform,
                version: initialData.version,
                buildNumber: initialData.buildNumber ?? undefined,
                forceUpdate: initialData.forceUpdate ?? false,
                minSupportedVersion: initialData.minSupportedVersion ?? undefined,
                changelog: initialData.changelog ?? "",
                status: initialData.releaseStatus,
                isActive: initialData.isActive ?? true,
                fileId: initialData.file?.id ?? undefined,
                downloadUrlOverride: initialData.downloadUrlOverride ?? undefined,
                rollbackFromId: initialData.rollbackFromId ?? undefined,
            }
        }
        return {
            app: AppReleaseAppEnum.enum["mobile-user"],
            platform: AppReleasePlatformEnum.enum.android,
            version: "",
            buildNumber: undefined,
            forceUpdate: false,
            minSupportedVersion: undefined,
            changelog: "",
            status: undefined,
            isActive: true,
            fileId: undefined,
            downloadUrlOverride: undefined,
            rollbackFromId: undefined,
        }
    }, [initialData, mode])

    const [uploadedFile, setUploadedFile] = useState<UploadValue | null>(() =>
        mapReleaseToUploadValue(initialData),
    )

    const form = useForm<FormValues>({
        defaultValues,
        validators: {
            onSubmit: mode === "create" ? createFormSchema : AdminUpdateAppReleaseSchema,
        },
        onSubmit: async ({ value }) => {
            try {
                if (mode === "create") {
                    const payload = createFormSchema.parse(value)
                    await createMutation.mutateAsync(payload)
                    toast.success("已创建应用版本")
                } else if (initialData) {
                    const { app, platform, version, ...rest } = value
                    const payload = AdminUpdateAppReleaseSchema.parse(rest)
                    await updateMutation.mutateAsync({
                        id: initialData.id,
                        payload,
                    })
                    toast.success("已更新应用版本")
                }
                onSuccess?.()
                onOpenChange(false)
            } catch (error) {
                if (error instanceof ApiClientError) {
                    toast.error(error.message)
                    return
                }
                if (error instanceof z.ZodError) {
                    toast.error(error.issues[0]?.message ?? "表单校验失败")
                    return
                }
                toast.error("提交失败，请稍后重试")
            }
        },
    })

    useEffect(() => {
        if (open) {
            form.reset(defaultValues)
            void Promise.resolve().then(() => {
                setUploadedFile(mapReleaseToUploadValue(initialData))
            })
        }
    }, [defaultValues, form, initialData, open])

    const isSubmitting =
        createMutation.isPending || updateMutation.isPending

    const handleUpload = useCallback(
        async (file: File) => {
            const result = await uploadFile.mutateAsync({ file, fileType: file.type })
            const value: UploadValue = {
                id: result.id,
                url: result.fileUrl,
                name: result.originalName,
                mimeType: result.mimeType,
            }
            setUploadedFile(value)
            form.setFieldValue("fileId", value.id)
            return value
        },
        [form, uploadFile],
    )

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => (!nextOpen ? onOpenChange(nextOpen) : undefined)}
        >
            <DialogContent className="max-w-4xl overflow-hidden p-0">
                <DialogHeader className="px-6 pb-4 pt-6">
                    <DialogTitle>
                        {mode === "create" ? "新增应用版本" : "编辑应用版本"}
                    </DialogTitle>
                    <DialogDescription>
                        依据更新方案配置版本信息，校验由 TanStack Form + Zod 驱动。
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(event) => {
                        event.preventDefault()
                        void form.handleSubmit()
                    }}
                    className="flex flex-col"
                >
                    <ScrollArea className="max-h-[70vh] px-6">
                        <div className="space-y-6 pb-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <form.Field
                                    name="app"
                                    validators={{
                                        onChange: AdminCreateAppReleaseSchema.shape.app,
                                    }}
                                >
                                    {(field) => (
                                        <div className="space-y-2">
                                            <Label>应用</Label>
                                            <Select
                                                value={field.state.value}
                                                onValueChange={(value) =>
                                                    field.handleChange(
                                                        value as FormValues["app"],
                                                    )
                                                }
                                                disabled={mode === "edit"}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="请选择应用" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {APP_OPTIONS.map((option) => (
                                                        <SelectItem
                                                            key={option.value}
                                                            value={option.value}
                                                        >
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </form.Field>

                                <form.Field
                                    name="platform"
                                    validators={{
                                        onChange: AdminCreateAppReleaseSchema.shape.platform,
                                    }}
                                >
                                    {(field) => (
                                        <div className="space-y-2">
                                            <Label>平台</Label>
                                            <Select
                                                value={field.state.value}
                                                onValueChange={(value) =>
                                                    field.handleChange(
                                                        value as FormValues["platform"],
                                                    )
                                                }
                                                disabled={mode === "edit"}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="请选择平台" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PLATFORM_OPTIONS.map((option) => (
                                                        <SelectItem
                                                            key={option.value}
                                                            value={option.value}
                                                        >
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </form.Field>

                                <form.Field
                                    name="version"
                                    validators={{
                                        onChange: AdminCreateAppReleaseSchema.shape.version,
                                    }}
                                >
                                    {(field) => (
                                        <div className="space-y-2">
                                            <Label>版本号</Label>
                                            <Input
                                                placeholder="例如 1.2.3 或 1.2.3-beta"
                                                value={field.state.value}
                                                onChange={(event) =>
                                                    field.handleChange(event.target.value.trim())
                                                }
                                                onBlur={field.handleBlur}
                                                disabled={mode === "edit"}
                                            />
                                            <FieldError field={field} />
                                        </div>
                                    )}
                                </form.Field>

                                <form.Field
                                    name="buildNumber"
                                    validators={{
                                        onChange: AdminUpdateAppReleaseSchema.shape.buildNumber,
                                    }}
                                >
                                    {(field) => (
                                        <div className="space-y-2">
                                            <Label>构建号（可选）</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                placeholder="整数，便于区分热修复"
                                                value={
                                                    field.state.value === undefined ||
                                                        field.state.value === null
                                                        ? ""
                                                        : String(field.state.value)
                                                }
                                                onChange={(event) => {
                                                    const raw = event.target.value
                                                    field.handleChange(
                                                        raw === ""
                                                            ? undefined
                                                            : Number(raw),
                                                    )
                                                }}
                                                onBlur={field.handleBlur}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                仅用于同版本多次构建区分，整数即可。
                                            </p>
                                            <FieldError field={field} />
                                        </div>
                                    )}
                                </form.Field>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <form.Field name="isActive">
                                    {(field) => (
                                        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-foreground">
                                                    允许用户下载
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    关闭后用户无法获取下载链接，适用于下架或风险版本。
                                                </p>
                                            </div>
                                            <Switch
                                                checked={field.state.value ?? false}
                                                onCheckedChange={(checked) =>
                                                    field.handleChange(Boolean(checked))
                                                }
                                            />
                                        </div>
                                    )}
                                </form.Field>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <form.Field name="forceUpdate">
                                    {(field) => (
                                        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-foreground">
                                                    强制更新
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    启用后低于最低兼容版本将强制升级。
                                                </p>
                                            </div>
                                            <Switch
                                                checked={field.state.value ?? false}
                                                onCheckedChange={(checked) =>
                                                    field.handleChange(Boolean(checked))
                                                }
                                            />
                                        </div>
                                    )}
                                </form.Field>

                                <form.Field
                                    name="minSupportedVersion"
                                    validators={{
                                        onChange:
                                            AdminCreateAppReleaseSchema.shape.minSupportedVersion,
                                    }}
                                >
                                    {(field) => (
                                        <div className="space-y-2">
                                            <Label>最低兼容版本（可选）</Label>
                                            <Input
                                                placeholder="如 1.0.0，低于将强更"
                                                value={field.state.value ?? ""}
                                                onChange={(event) => {
                                                    const raw = event.target.value.trim()
                                                    field.handleChange(
                                                        raw === "" ? undefined : raw,
                                                    )
                                                }}
                                                onBlur={field.handleBlur}
                                            />
                                            <FieldError field={field} />
                                        </div>
                                    )}
                                </form.Field>
                            </div>

                            <div className="grid gap-4 md:grid-cols-1">
                                <form.Field
                                    name="downloadUrlOverride"
                                    validators={{
                                        onChange:
                                            AdminCreateAppReleaseSchema.shape.downloadUrlOverride,
                                    }}
                                >
                                    {(field) => (
                                        <div className="space-y-2">
                                            <Label>下载外链（可选）</Label>
                                            <Input
                                                placeholder="TestFlight / App Store / 直链 URL"
                                                value={field.state.value ?? ""}
                                                onChange={(event) => {
                                                    const raw = event.target.value.trim()
                                                    field.handleChange(
                                                        raw === "" ? undefined : raw,
                                                    )
                                                }}
                                                onBlur={field.handleBlur}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                iOS 可填写外链；如留空请上传 APK 以生成下载链接。
                                            </p>
                                            <FieldError field={field} />
                                        </div>
                                    )}
                                </form.Field>

                                <form.Field name="fileId">
                                    {(field) => (
                                        <div className="space-y-1.5">
                                            <UploadField
                                                label="APK 文件"
                                                description="支持 .apk/.ipa，上传后将生成对象存储链接"
                                                value={uploadedFile}
                                                onChange={(value) => {
                                                    setUploadedFile(value)
                                                    field.handleChange(value?.id)
                                                }}
                                                onUpload={handleUpload}
                                                accept=".apk,.ipa,application/vnd.android.package-archive"
                                                disabled={isSubmitting}
                                                helperText="至少上传 APK 或填写外链，其余字段将复用已有文件。"
                                                onError={(error) => toast.error(error.message)}
                                            />
                                            <FieldError field={field} />
                                        </div>
                                    )}
                                </form.Field>
                            </div>

                            <form.Field name="changelog">
                                {(field) => (
                                    <div className="space-y-2">
                                        <Label>更新说明</Label>
                                        <Textarea
                                            rows={4}
                                            placeholder="用于客户端展示的更新日志，支持换行。"
                                            value={field.state.value ?? ""}
                                            onChange={(event) =>
                                                field.handleChange(event.target.value)
                                            }
                                            onBlur={field.handleBlur}
                                        />
                                        <FieldError field={field} />
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </ScrollArea>

                    <DialogFooter className={cn(
                        "mt-auto gap-2 border-t px-6 py-4",
                        "bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/80",
                    )}>
                        <form.Subscribe
                            selector={(state) => [state.canSubmit, state.isSubmitting]}
                        >
                            {([canSubmit, formSubmitting]) => (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => onOpenChange(false)}
                                        disabled={isSubmitting}
                                    >
                                        取消
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={!canSubmit || isSubmitting || formSubmitting}
                                    >
                                        {isSubmitting || formSubmitting
                                            ? "提交中..."
                                            : mode === "create"
                                                ? "创建并保存"
                                                : "保存更新"}
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

function mapReleaseToUploadValue(
    release?: AppReleaseListItem,
): UploadValue | null {
    if (!release?.file?.id) {
        return null
    }
    return {
        id: release.file.id,
        url: release.downloadUrl ?? release.downloadUrlOverride ?? "",
        name: release.file.objectPath ?? release.version,
        mimeType: release.file.mimeType,
    }
}

function FieldError({ field }: { field: AnyFieldApi }) {
    const message = field.state.meta.errors[0]?.message
    if (!message) {
        return null
    }
    return <p className="text-xs text-destructive">{String(message)}</p>
}
