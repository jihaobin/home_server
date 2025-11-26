import { ShieldCheck, ShieldX } from "lucide-react"
import { Button } from "@repo/web-ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/web-ui/components/card"
import { Separator } from "@repo/web-ui/components/separator"
import { PageHeader, PageHeaderToolbar } from "@/components/common"

export default function WithdrawalsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="提现记录"
                description="查看并审核服务人员的提现申请，记录备注与审批历史。"
                breadcrumbItems={[
                    { label: "运营管理", href: "/withdrawals" },
                    { label: "提现记录" },
                ]}
                actions={
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="gap-1.5">
                            <ShieldCheck className="size-4" />
                            快速通过
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1.5">
                            <ShieldX className="size-4" />
                            批量驳回
                        </Button>
                    </div>
                }
            >
                <PageHeaderToolbar className="gap-3">
                    <span>审核流将在 Step 9 与后台接口打通</span>
                    <span>错误/加载状态沿用 Skeleton + Toast 的统一策略</span>
                </PageHeaderToolbar>
            </PageHeader>

            <Card>
                <CardHeader>
                    <CardTitle>即将实现的能力</CardTitle>
                    <CardDescription>docs/admin-web-plan.md 第 9 步</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div>
                        <p className="font-medium text-foreground">筛选条件</p>
                        <p>时间范围、服务人员姓名、金额区间及提现状态。</p>
                    </div>
                    <Separator />
                    <div>
                        <p className="font-medium text-foreground">审核流</p>
                        <p>通过/驳回操作配合确认对话框与备注。</p>
                    </div>
                    <Separator />
                    <div>
                        <p className="font-medium text-foreground">记录追踪</p>
                        <p>结合日志信息展示审批历史，方便财务追溯。</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
