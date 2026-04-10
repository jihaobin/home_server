"use client";

import { useMemo, useState } from "react";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import {
    AdminCommissionStrategySimulationInputSchema,
    type AdminCommissionStrategySimulationResult,
} from "@repo/types";
import { Badge } from "@repo/web-ui/components/badge";
import { Button } from "@repo/web-ui/components/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@repo/web-ui/components/card";
import { Input } from "@repo/web-ui/components/input";
import { Label } from "@repo/web-ui/components/label";
import { Switch } from "@repo/web-ui/components/switch";
import { useSimulateAdminServiceCategoryCommissionStrategy } from "@repo/hooks/api/ssr";
import { ApiClientError } from "@repo/utils/api-client";
import { toast } from "sonner";

type CommissionStrategySimulatorProps = {
    categoryId: string;
    fixedCommissionRate: number;
};

type SimulatorFormValues = {
    workerId: string;
    settlementDateLocal: string;
    monthlyIncomeBeforeSettlement: number;
    isWithinBeginnerProtection: boolean;
};

export function CommissionStrategySimulator({
    categoryId,
    fixedCommissionRate,
}: CommissionStrategySimulatorProps) {
    const simulateMutation =
        useSimulateAdminServiceCategoryCommissionStrategy();
    const [result, setResult] =
        useState<AdminCommissionStrategySimulationResult | null>(null);

    const defaultValues = useMemo<SimulatorFormValues>(
        () => ({
            workerId: "",
            settlementDateLocal: toLocalDatetimeInputValue(new Date()),
            monthlyIncomeBeforeSettlement: 0,
            isWithinBeginnerProtection: false,
        }),
        [],
    );

    const form = useForm({
        defaultValues,
        onSubmit: async ({ value }) => {
            try {
                const payload =
                    AdminCommissionStrategySimulationInputSchema.parse({
                        categoryId,
                        workerId: value.workerId.trim(),
                        settlementDate: new Date(
                            value.settlementDateLocal,
                        ).toISOString(),
                        monthlyIncomeBeforeSettlement:
                            value.monthlyIncomeBeforeSettlement,
                        isWithinBeginnerProtection:
                            value.isWithinBeginnerProtection,
                    });

                const nextResult = await simulateMutation.mutateAsync({
                    categoryId,
                    payload,
                });

                setResult(nextResult);
                toast.success("试算完成");
            } catch (error) {
                if (error instanceof ApiClientError) {
                    toast.error(error.message);
                    return;
                }

                if (error instanceof Error) {
                    toast.error(error.message);
                    return;
                }

                toast.error("试算失败，请稍后重试");
            }
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>策略试算</CardTitle>
                <CardDescription>
                    输入服务人员与结算条件，快速核验当前已发布策略的命中结果。
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void form.handleSubmit();
                    }}
                >
                    <form.Field
                        name="workerId"
                        validators={{
                            onChange:
                                AdminCommissionStrategySimulationInputSchema
                                    .shape.workerId,
                        }}
                    >
                        {(field) => (
                            <div className="space-y-2">
                                <Label>服务人员 ID</Label>
                                <Input
                                    placeholder="请输入服务人员 ID"
                                    value={field.state.value}
                                    onChange={(event) =>
                                        field.handleChange(event.target.value)
                                    }
                                    onBlur={field.handleBlur}
                                    disabled={simulateMutation.isPending}
                                />
                                <FieldError field={field} />
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="settlementDateLocal">
                        {(field) => (
                            <div className="space-y-2">
                                <Label>结算时间</Label>
                                <Input
                                    type="datetime-local"
                                    value={field.state.value}
                                    onChange={(event) =>
                                        field.handleChange(event.target.value)
                                    }
                                    onBlur={field.handleBlur}
                                    disabled={simulateMutation.isPending}
                                />
                            </div>
                        )}
                    </form.Field>

                    <form.Field
                        name="monthlyIncomeBeforeSettlement"
                        validators={{
                            onChange:
                                AdminCommissionStrategySimulationInputSchema
                                    .shape.monthlyIncomeBeforeSettlement,
                        }}
                    >
                        {(field) => (
                            <div className="space-y-2">
                                <Label>结算前当月已入账收益</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={String(field.state.value)}
                                    onChange={(event) =>
                                        field.handleChange(
                                            parseDecimalInput(
                                                event.target.value,
                                            ),
                                        )
                                    }
                                    onBlur={field.handleBlur}
                                    disabled={simulateMutation.isPending}
                                />
                                <FieldError field={field} />
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="isWithinBeginnerProtection">
                        {(field) => (
                            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-foreground">
                                        处于新手保护期
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        仅用于运营模拟判定，不会修改正式数据。
                                    </p>
                                </div>
                                <Switch
                                    checked={field.state.value}
                                    onCheckedChange={(checked) =>
                                        field.handleChange(Boolean(checked))
                                    }
                                    disabled={simulateMutation.isPending}
                                />
                            </div>
                        )}
                    </form.Field>

                    <div className="flex justify-end">
                        <form.Subscribe
                            selector={(state) => [
                                state.canSubmit,
                                state.isSubmitting,
                            ]}
                        >
                            {([canSubmit, isSubmitting]) => (
                                <Button
                                    type="submit"
                                    disabled={
                                        !canSubmit ||
                                        isSubmitting ||
                                        simulateMutation.isPending
                                    }
                                >
                                    {simulateMutation.isPending
                                        ? "试算中..."
                                        : "开始试算"}
                                </Button>
                            )}
                        </form.Subscribe>
                    </div>
                </form>

                <div className="rounded-lg border bg-muted/20 p-4">
                    {result ? (
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge>
                                    {getRuleTypeLabel(result.ruleType)}
                                </Badge>
                                <span className="text-sm font-medium text-foreground">
                                    最终抽成 {result.commissionRate}%
                                </span>
                            </div>
                            <dl className="grid gap-3 text-sm sm:grid-cols-2">
                                <ResultItem
                                    label="命中版本"
                                    value={
                                        result.strategyVersionId ??
                                        "未命中已发布版本"
                                    }
                                />
                                <ResultItem
                                    label="命中门槛"
                                    value={
                                        result.matchedThreshold === null
                                            ? "—"
                                            : `${result.matchedThreshold}`
                                    }
                                />
                                <ResultItem
                                    label="命中规则 ID"
                                    value={result.matchedRuleId ?? "—"}
                                />
                                <ResultItem
                                    label="分类固定抽成"
                                    value={`${result.fixedCommissionRate}%`}
                                />
                            </dl>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                                暂无试算结果
                            </p>
                            <p className="text-xs text-muted-foreground">
                                若未发布动态策略，系统会回退到分类固定抽成{" "}
                                {fixedCommissionRate}% 作为安全网。
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function ResultItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="space-y-1 rounded-md border bg-background px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium text-foreground">{value}</dd>
        </div>
    );
}

function getRuleTypeLabel(
    ruleType: AdminCommissionStrategySimulationResult["ruleType"],
) {
    if (ruleType === "beginner-protection") {
        return "新手保护期";
    }

    if (ruleType === "dynamic") {
        return "动态规则";
    }

    return "固定抽成";
}

function toLocalDatetimeInputValue(date: Date) {
    const offset = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function parseDecimalInput(value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }
    return Math.round(parsed * 100) / 100;
}

function FieldError({ field }: { field: AnyFieldApi }) {
    const message = field.state.meta.errors[0]?.message;
    if (!message) {
        return null;
    }

    return <p className="text-xs text-destructive">{String(message)}</p>;
}
