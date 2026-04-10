"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod/v4";
import {
    AdminCommissionStrategyBeginnerProtectionSchema,
    AdminCommissionStrategyPublishInputSchema,
    AdminCommissionStrategyRuleSchema,
    SaveAdminCommissionStrategyDraftSchema,
    type AdminCommissionStrategyDetail,
    type AdminCommissionStrategyRule,
    type SaveAdminCommissionStrategyDraftInput,
} from "@repo/types";
import {
    useAdminServiceCategoryCommissionStrategyDetail,
    usePublishAdminServiceCategoryCommissionStrategy,
    useSaveAdminServiceCategoryCommissionStrategyDraft,
} from "@repo/hooks/api/ssr";
import { ApiClientError } from "@repo/utils/api-client";
import { Badge } from "@repo/web-ui/components/badge";
import { Button } from "@repo/web-ui/components/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@repo/web-ui/components/card";
import { Input } from "@repo/web-ui/components/input";
import { Label } from "@repo/web-ui/components/label";
import { Switch } from "@repo/web-ui/components/switch";
import { Textarea } from "@repo/web-ui/components/textarea";
import { toast } from "sonner";
import { ArrowLeft, Save, Send } from "lucide-react";
import { PageHeader, PageHeaderToolbar } from "@/components/common";
import { CommissionStrategyRuleTable } from "./commission-strategy-rule-table";
import { CommissionStrategySimulator } from "./commission-strategy-simulator";

type CommissionStrategyPageContentProps = {
    categoryId: string;
};

type CommissionStrategyEditorValues = SaveAdminCommissionStrategyDraftInput & {
    publishReason: string;
};

const CommissionStrategyEditorSchema =
    SaveAdminCommissionStrategyDraftSchema.extend({
        publishReason: z.string().max(500, "发布说明不能超过 500 字"),
    });

const DEFAULT_PROTECTION_DAYS = 30;

export function CommissionStrategyPageContent({
    categoryId,
}: CommissionStrategyPageContentProps) {
    const { data } =
        useAdminServiceCategoryCommissionStrategyDetail(categoryId);
    const saveDraftMutation =
        useSaveAdminServiceCategoryCommissionStrategyDraft();
    const publishMutation = usePublishAdminServiceCategoryCommissionStrategy();

    const defaultValues = useMemo(() => buildEditorValues(data), [data]);

    const form = useForm({
        defaultValues,
        onSubmit: async ({ value }) => {
            await saveDraft(value);
        },
    });

    useEffect(() => {
        form.reset(defaultValues);
    }, [defaultValues, form]);

    const isSaving = saveDraftMutation.isPending;
    const isPublishing = publishMutation.isPending;
    const isBusy = isSaving || isPublishing;
    const sourceVersion = data.draftVersion ?? data.currentPublishedVersion;
    const enabledRuleCount = form.state.values.rules.filter(
        (rule) => rule.isEnabled,
    ).length;

    const saveDraft = async (values: CommissionStrategyEditorValues) => {
        try {
            const payload = buildDraftPayload(
                CommissionStrategyEditorSchema.parse(values),
            );
            const nextDetail = await saveDraftMutation.mutateAsync({
                categoryId,
                payload,
            });
            form.reset(buildEditorValues(nextDetail));
            toast.success("草稿已保存");
            return nextDetail;
        } catch (error) {
            throw normalizeMutationError(error, "保存草稿失败");
        }
    };

    const handlePublish = async () => {
        try {
            const currentValues = form.state.values;
            await saveDraft(currentValues);

            const publishPayload =
                AdminCommissionStrategyPublishInputSchema.parse({
                    categoryId,
                    publishReason:
                        currentValues.publishReason.trim() === ""
                            ? undefined
                            : currentValues.publishReason.trim(),
                });

            const nextDetail = await publishMutation.mutateAsync({
                categoryId,
                payload: publishPayload,
            });

            form.reset(buildEditorValues(nextDetail));
            toast.success("抽成策略已发布");
        } catch (error) {
            const message = error instanceof Error ? error.message : "发布失败";
            toast.error(message);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title={`${data.categoryName} · 抽成策略`}
                description="仅面向上门按摩分类，支持草稿编辑、发布生效和结算前试算。"
                breadcrumbItems={[
                    { label: "运营管理", href: "/service-categories" },
                    { label: "服务分类管理", href: "/service-categories" },
                    { label: "抽成策略" },
                ]}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/service-categories">
                                <ArrowLeft className="size-4" />
                                返回分类列表
                            </Link>
                        </Button>
                    </div>
                }
            >
                <PageHeaderToolbar className="gap-3">
                    <span>固定抽成 {data.fixedCommissionRate}%</span>
                    <span>策略状态 {getStrategyStatusLabel(data.status)}</span>
                    <span>
                        当前编辑版本{" "}
                        {sourceVersion
                            ? `v${sourceVersion.versionNo}`
                            : "未创建"}
                    </span>
                </PageHeaderToolbar>
            </PageHeader>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>策略配置</CardTitle>
                            <CardDescription>
                                {data.draftVersion
                                    ? "当前正在编辑草稿版本，发布后才会影响线上结算。"
                                    : data.currentPublishedVersion
                                      ? "当前没有草稿，保存时会基于已发布版本复制出新草稿。"
                                      : "当前尚未创建策略版本，保存草稿后即可开始维护。"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-3 md:grid-cols-3">
                                <SummaryItem
                                    label="已发布版本"
                                    value={
                                        data.currentPublishedVersion
                                            ? `v${data.currentPublishedVersion.versionNo}`
                                            : "未发布"
                                    }
                                />
                                <SummaryItem
                                    label="草稿版本"
                                    value={
                                        data.draftVersion
                                            ? `v${data.draftVersion.versionNo}`
                                            : "无草稿"
                                    }
                                />
                                <SummaryItem
                                    label="启用规则数"
                                    value={`${enabledRuleCount} 条`}
                                />
                            </div>

                            <div className="space-y-4 rounded-lg border p-4">
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        新手保护期
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        用于保护新手服务人员，满足条件时优先命中固定抽成比例。
                                    </p>
                                </div>

                                <form.Field name="beginnerProtection.isEnabled">
                                    {(field) => (
                                        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-foreground">
                                                    启用保护期
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    关闭后将直接按动态规则或固定抽成计算。
                                                </p>
                                            </div>
                                            <Switch
                                                checked={field.state.value}
                                                onCheckedChange={(checked) =>
                                                    field.handleChange(
                                                        Boolean(checked),
                                                    )
                                                }
                                                disabled={isBusy}
                                            />
                                        </div>
                                    )}
                                </form.Field>

                                <div className="grid gap-4 md:grid-cols-3">
                                    <form.Field
                                        name="beginnerProtection.protectionDays"
                                        validators={{
                                            onChange:
                                                AdminCommissionStrategyBeginnerProtectionSchema
                                                    .shape.protectionDays,
                                        }}
                                    >
                                        {(field) => (
                                            <div className="space-y-2">
                                                <Label>保护期天数</Label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    step="1"
                                                    value={String(
                                                        field.state.value,
                                                    )}
                                                    onChange={(event) =>
                                                        field.handleChange(
                                                            parseIntegerInput(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    onBlur={field.handleBlur}
                                                    disabled={isBusy}
                                                />
                                                <FieldError field={field} />
                                            </div>
                                        )}
                                    </form.Field>

                                    <form.Field
                                        name="beginnerProtection.monthlyIncomeThreshold"
                                        validators={{
                                            onChange:
                                                AdminCommissionStrategyBeginnerProtectionSchema
                                                    .shape
                                                    .monthlyIncomeThreshold,
                                        }}
                                    >
                                        {(field) => (
                                            <div className="space-y-2">
                                                <Label>保护期收益门槛</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
                                                    value={String(
                                                        field.state.value,
                                                    )}
                                                    onChange={(event) =>
                                                        field.handleChange(
                                                            parseDecimalInput(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    onBlur={field.handleBlur}
                                                    disabled={isBusy}
                                                />
                                                <FieldError field={field} />
                                            </div>
                                        )}
                                    </form.Field>

                                    <form.Field
                                        name="beginnerProtection.fixedCommissionRate"
                                        validators={{
                                            onChange:
                                                AdminCommissionStrategyBeginnerProtectionSchema
                                                    .shape.fixedCommissionRate,
                                        }}
                                    >
                                        {(field) => (
                                            <div className="space-y-2">
                                                <Label>保护期固定抽成</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step="1"
                                                    value={String(
                                                        field.state.value,
                                                    )}
                                                    onChange={(event) =>
                                                        field.handleChange(
                                                            parseIntegerInput(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    onBlur={field.handleBlur}
                                                    disabled={isBusy}
                                                />
                                                <FieldError field={field} />
                                            </div>
                                        )}
                                    </form.Field>
                                </div>
                            </div>

                            <form.Field name="rules">
                                {(field) => (
                                    <CommissionStrategyRuleTable
                                        value={field.state.value}
                                        onChange={field.handleChange}
                                        disabled={isBusy}
                                    />
                                )}
                            </form.Field>

                            <form.Field
                                name="publishReason"
                                validators={{
                                    onChange: z
                                        .string()
                                        .max(500, "发布说明不能超过 500 字"),
                                }}
                            >
                                {(field) => (
                                    <div className="space-y-2">
                                        <Label>发布说明（可选）</Label>
                                        <Textarea
                                            rows={3}
                                            placeholder="例如：按 2026 年 4 月运营策略调整抽成梯度"
                                            value={field.state.value}
                                            onChange={(event) =>
                                                field.handleChange(
                                                    event.target.value,
                                                )
                                            }
                                            onBlur={field.handleBlur}
                                            disabled={isBusy}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            发布说明会随本次发布一起提交，便于后续追溯。
                                        </p>
                                        <FieldError field={field} />
                                    </div>
                                )}
                            </form.Field>
                        </CardContent>
                        <CardFooter className="flex flex-wrap justify-end gap-2 border-t pt-6">
                            <form.Subscribe
                                selector={(state) => [
                                    state.canSubmit,
                                    state.isSubmitting,
                                ]}
                            >
                                {([canSubmit, isSubmitting]) => (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={
                                                !canSubmit ||
                                                isSubmitting ||
                                                isBusy
                                            }
                                            onClick={() =>
                                                void form.handleSubmit()
                                            }
                                        >
                                            <Save className="size-4" />
                                            {isSaving
                                                ? "保存中..."
                                                : "保存草稿"}
                                        </Button>
                                        <Button
                                            type="button"
                                            disabled={
                                                !canSubmit ||
                                                isSubmitting ||
                                                isBusy
                                            }
                                            onClick={() => void handlePublish()}
                                        >
                                            <Send className="size-4" />
                                            {isPublishing
                                                ? "发布中..."
                                                : "发布策略"}
                                        </Button>
                                    </>
                                )}
                            </form.Subscribe>
                        </CardFooter>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>版本概览</CardTitle>
                            <CardDescription>
                                线上结算只读取已发布版本，未发布的编辑内容仅保留在草稿中。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <VersionBlock
                                title="当前草稿"
                                versionNo={data.draftVersion?.versionNo}
                                status={data.draftVersion?.status}
                                publishedAt={
                                    data.draftVersion?.publishedAt ?? null
                                }
                            />
                            <VersionBlock
                                title="当前已发布"
                                versionNo={
                                    data.currentPublishedVersion?.versionNo
                                }
                                status={data.currentPublishedVersion?.status}
                                publishedAt={
                                    data.currentPublishedVersion?.publishedAt ??
                                    null
                                }
                            />
                        </CardContent>
                    </Card>

                    <CommissionStrategySimulator
                        categoryId={categoryId}
                        fixedCommissionRate={data.fixedCommissionRate}
                    />
                </div>
            </div>
        </div>
    );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
        </div>
    );
}

function VersionBlock({
    title,
    versionNo,
    status,
    publishedAt,
}: {
    title: string;
    versionNo?: number;
    status?: string | null;
    publishedAt?: string | null;
}) {
    return (
        <div className="space-y-2 rounded-lg border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{title}</p>
                <Badge
                    variant={status === "published" ? "default" : "secondary"}
                >
                    {getVersionStatusLabel(status)}
                </Badge>
            </div>
            <p className="text-sm text-foreground">
                {versionNo ? `v${versionNo}` : "暂无版本"}
            </p>
            <p className="text-xs text-muted-foreground">
                {publishedAt
                    ? `发布时间：${formatDateTime(publishedAt)}`
                    : "尚未发布"}
            </p>
        </div>
    );
}

function buildEditorValues(
    detail: AdminCommissionStrategyDetail,
): CommissionStrategyEditorValues {
    const sourceVersion = detail.draftVersion ?? detail.currentPublishedVersion;
    const beginnerProtection = sourceVersion?.beginnerProtection ?? {
        isEnabled: false,
        protectionDays: DEFAULT_PROTECTION_DAYS,
        monthlyIncomeThreshold: 0,
        fixedCommissionRate: detail.fixedCommissionRate,
    };

    const rules =
        sourceVersion?.rules.length && sourceVersion.rules.length > 0
            ? normalizeRules(sourceVersion.rules)
            : [createDefaultRule()];

    return {
        categoryId: detail.categoryId,
        beginnerProtection: {
            isEnabled: beginnerProtection.isEnabled,
            protectionDays: beginnerProtection.protectionDays,
            monthlyIncomeThreshold: beginnerProtection.monthlyIncomeThreshold,
            fixedCommissionRate: beginnerProtection.fixedCommissionRate,
        },
        rules,
        publishReason: "",
    };
}

function buildDraftPayload(
    values: CommissionStrategyEditorValues,
): SaveAdminCommissionStrategyDraftInput {
    return SaveAdminCommissionStrategyDraftSchema.parse({
        categoryId: values.categoryId,
        beginnerProtection: {
            isEnabled: values.beginnerProtection.isEnabled,
            protectionDays: values.beginnerProtection.protectionDays,
            monthlyIncomeThreshold:
                values.beginnerProtection.monthlyIncomeThreshold,
            fixedCommissionRate: values.beginnerProtection.fixedCommissionRate,
        },
        rules: normalizeRules(values.rules),
    });
}

function normalizeRules(rules: AdminCommissionStrategyRule[]) {
    return rules.map((rule, index) =>
        AdminCommissionStrategyRuleSchema.parse({
            ...rule,
            threshold: parseDecimalInput(String(rule.threshold)),
            commissionRate: parseIntegerInput(String(rule.commissionRate)),
            sortOrder: index,
        }),
    );
}

function createDefaultRule(): AdminCommissionStrategyRule {
    return {
        id:
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        threshold: 0,
        commissionRate: 0,
        isEnabled: true,
        sortOrder: 0,
    };
}

function normalizeMutationError(error: unknown, fallbackMessage: string) {
    if (error instanceof ApiClientError) {
        toast.error(error.message);
        return error;
    }

    if (error instanceof Error) {
        toast.error(error.message);
        return error;
    }

    const nextError = new Error(fallbackMessage);
    toast.error(nextError.message);
    return nextError;
}

function getStrategyStatusLabel(
    status: AdminCommissionStrategyDetail["status"],
) {
    if (status === "published") {
        return "已发布";
    }

    if (status === "draft") {
        return "草稿中";
    }

    if (status === "archived") {
        return "已归档";
    }

    return "未创建";
}

function getVersionStatusLabel(status?: string | null) {
    if (status === "published") {
        return "已发布";
    }

    if (status === "draft") {
        return "草稿";
    }

    if (status === "archived") {
        return "已归档";
    }

    return "暂无";
}

function parseDecimalInput(value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }
    return Math.round(parsed * 100) / 100;
}

function parseIntegerInput(value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }
    return Math.round(parsed);
}

function formatDateTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function FieldError({ field }: { field: AnyFieldApi }) {
    const message = field.state.meta.errors[0]?.message;
    if (!message) {
        return null;
    }

    return <p className="text-xs text-destructive">{String(message)}</p>;
}
