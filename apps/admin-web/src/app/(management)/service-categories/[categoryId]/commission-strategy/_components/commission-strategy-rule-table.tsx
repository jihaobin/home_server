"use client";

import { ChevronDown, ChevronUp, PlusCircle, Trash2 } from "lucide-react";
import {
    type AdminCommissionStrategyRule,
    AdminCommissionStrategyRuleSchema,
} from "@repo/types";
import { Badge } from "@repo/web-ui/components/badge";
import { Button } from "@repo/web-ui/components/button";
import { Input } from "@repo/web-ui/components/input";
import { Switch } from "@repo/web-ui/components/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@repo/web-ui/components/table";

type CommissionStrategyRuleTableProps = {
    value: AdminCommissionStrategyRule[];
    onChange: (value: AdminCommissionStrategyRule[]) => void;
    disabled?: boolean;
};

export function CommissionStrategyRuleTable({
    value,
    onChange,
    disabled = false,
}: CommissionStrategyRuleTableProps) {
    const rules = value.length > 0 ? value : [createRule(0)];

    const updateRules = (nextRules: AdminCommissionStrategyRule[]) => {
        onChange(normalizeRules(nextRules));
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-sm font-medium text-foreground">
                        动态规则
                    </p>
                    <p className="text-xs text-muted-foreground">
                        规则按列表顺序生效，建议从高门槛排到低门槛。
                    </p>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={disabled}
                    onClick={() =>
                        updateRules([...rules, createRule(rules.length)])
                    }
                >
                    <PlusCircle className="size-4" />
                    新增规则
                </Button>
            </div>

            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-20">顺序</TableHead>
                            <TableHead className="min-w-[180px]">
                                月收入门槛
                            </TableHead>
                            <TableHead className="min-w-[160px]">
                                抽成比例
                            </TableHead>
                            <TableHead className="w-28">状态</TableHead>
                            <TableHead className="min-w-[180px]">
                                操作
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rules.map((rule, index) => {
                            const thresholdResult =
                                AdminCommissionStrategyRuleSchema.shape.threshold.safeParse(
                                    rule.threshold,
                                );
                            const rateResult =
                                AdminCommissionStrategyRuleSchema.shape.commissionRate.safeParse(
                                    rule.commissionRate,
                                );

                            return (
                                <TableRow key={rule.id}>
                                    <TableCell>
                                        <span className="text-sm font-medium text-foreground">
                                            #{index + 1}
                                        </span>
                                    </TableCell>
                                    <TableCell className="space-y-2">
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={String(rule.threshold)}
                                            disabled={disabled}
                                            onChange={(event) => {
                                                updateRules(
                                                    rules.map(
                                                        (item, itemIndex) =>
                                                            itemIndex === index
                                                                ? {
                                                                      ...item,
                                                                      threshold:
                                                                          parseDecimalInput(
                                                                              event
                                                                                  .target
                                                                                  .value,
                                                                          ),
                                                                  }
                                                                : item,
                                                    ),
                                                );
                                            }}
                                        />
                                        {!thresholdResult.success ? (
                                            <p className="text-xs text-destructive">
                                                {
                                                    thresholdResult.error
                                                        .issues[0]?.message
                                                }
                                            </p>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className="space-y-2">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step="1"
                                            value={String(rule.commissionRate)}
                                            disabled={disabled}
                                            onChange={(event) => {
                                                updateRules(
                                                    rules.map(
                                                        (item, itemIndex) =>
                                                            itemIndex === index
                                                                ? {
                                                                      ...item,
                                                                      commissionRate:
                                                                          parseIntegerInput(
                                                                              event
                                                                                  .target
                                                                                  .value,
                                                                          ),
                                                                  }
                                                                : item,
                                                    ),
                                                );
                                            }}
                                        />
                                        {!rateResult.success ? (
                                            <p className="text-xs text-destructive">
                                                {
                                                    rateResult.error.issues[0]
                                                        ?.message
                                                }
                                            </p>
                                        ) : null}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={rule.isEnabled}
                                                disabled={disabled}
                                                onCheckedChange={(checked) => {
                                                    updateRules(
                                                        rules.map(
                                                            (
                                                                item,
                                                                itemIndex,
                                                            ) =>
                                                                itemIndex ===
                                                                index
                                                                    ? {
                                                                          ...item,
                                                                          isEnabled:
                                                                              Boolean(
                                                                                  checked,
                                                                              ),
                                                                      }
                                                                    : item,
                                                        ),
                                                    );
                                                }}
                                            />
                                            <Badge
                                                variant={
                                                    rule.isEnabled
                                                        ? "default"
                                                        : "secondary"
                                                }
                                            >
                                                {rule.isEnabled
                                                    ? "启用"
                                                    : "停用"}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={
                                                    disabled || index === 0
                                                }
                                                onClick={() =>
                                                    updateRules(
                                                        moveRule(
                                                            rules,
                                                            index,
                                                            -1,
                                                        ),
                                                    )
                                                }
                                            >
                                                <ChevronUp className="mr-1.5 size-4" />
                                                上移
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={
                                                    disabled ||
                                                    index === rules.length - 1
                                                }
                                                onClick={() =>
                                                    updateRules(
                                                        moveRule(
                                                            rules,
                                                            index,
                                                            1,
                                                        ),
                                                    )
                                                }
                                            >
                                                <ChevronDown className="mr-1.5 size-4" />
                                                下移
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive hover:text-destructive"
                                                disabled={
                                                    disabled ||
                                                    rules.length === 1
                                                }
                                                onClick={() => {
                                                    updateRules(
                                                        rules.filter(
                                                            (
                                                                _item,
                                                                itemIndex,
                                                            ) =>
                                                                itemIndex !==
                                                                index,
                                                        ),
                                                    );
                                                }}
                                            >
                                                <Trash2 className="mr-1.5 size-4" />
                                                删除
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function createRule(index: number): AdminCommissionStrategyRule {
    return {
        id: buildRuleId(index),
        threshold: 0,
        commissionRate: 0,
        isEnabled: true,
        sortOrder: index,
    };
}

function buildRuleId(index: number) {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return `rule-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function moveRule(
    rules: AdminCommissionStrategyRule[],
    index: number,
    offset: -1 | 1,
) {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= rules.length) {
        return rules;
    }

    const nextRules = [...rules];
    const [currentRule] = nextRules.splice(index, 1);
    if (!currentRule) {
        return rules;
    }
    nextRules.splice(nextIndex, 0, currentRule);
    return nextRules;
}

function normalizeRules(rules: AdminCommissionStrategyRule[]) {
    return rules.map((rule, index) => ({
        ...rule,
        threshold: parseDecimalInput(String(rule.threshold)),
        commissionRate: parseIntegerInput(String(rule.commissionRate)),
        isEnabled: Boolean(rule.isEnabled),
        sortOrder: index,
    }));
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
