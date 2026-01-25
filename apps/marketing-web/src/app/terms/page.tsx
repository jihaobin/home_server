import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
    title: "用户协议",
    description: `${SITE_NAME} 用户协议（占位版本，可按实际业务完善）。`,
    alternates: {
        canonical: absoluteUrl("/terms"),
    },
};

export default function TermsPage() {
    return (
        <Container className="py-14">
            <div className="max-w-3xl">
                <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                    用户协议
                </h1>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    生效日期：2026-01-24（占位）｜本页面为示例占位内容，请结合实际业务、产品功能与合规要求进行完善。
                </p>

                <Card className="mt-8 p-8">
                    <div className="space-y-6 text-sm leading-7 text-foreground/90">
                        <section>
                            <h2 className="text-lg font-extrabold">
                                一、协议说明
                            </h2>
                            <p className="mt-2">
                                本协议是你与 {SITE_NAME}{" "}
                                之间关于使用本服务的约定。使用本服务即表示你已阅读并同意本协议内容。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                二、服务内容
                            </h2>
                            <p className="mt-2">
                                {SITE_NAME}{" "}
                                为你提供家庭服务预约与订单管理能力，包括服务浏览、选择服务人员、下单、进度查看、评价与售后等。
                                具体服务范围以 App 内展示为准。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                三、账号与安全
                            </h2>
                            <ul className="mt-3 list-disc space-y-2 pl-6">
                                <li>
                                    你应确保账号信息真实、准确，并妥善保管登录凭证。
                                </li>
                                <li>
                                    如发现账号异常，请及时通过 App 内入口反馈。
                                </li>
                                <li>你应对在账号下进行的行为承担相应责任。</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                四、订单与交易（占位）
                            </h2>
                            <p className="mt-2">
                                订单的价格、服务范围、支付方式、取消/退款规则等以
                                App 内页面展示与提示为准。
                                若发生争议，双方应优先友好协商并通过售后流程处理。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                五、用户行为规范
                            </h2>
                            <ul className="mt-3 list-disc space-y-2 pl-6">
                                <li>不得发布违法、侵权、骚扰或不当内容。</li>
                                <li>不得恶意下单、刷单、干扰平台正常运行。</li>
                                <li>不得以任何方式攻击、逆向、破坏本服务。</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                六、知识产权
                            </h2>
                            <p className="mt-2">
                                {SITE_NAME}{" "}
                                的商标、产品界面、文案与相关内容归权利人所有。未经许可不得擅自使用。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                七、免责声明（占位）
                            </h2>
                            <p className="mt-2">
                                我们会尽力保障服务稳定与信息准确，但因网络、设备、第三方服务等不可控因素导致的异常，可能会影响使用体验。
                                对于你与服务提供方之间因服务履约产生的争议，我们将提供必要的协助与处理通道。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                八、协议变更与终止
                            </h2>
                            <p className="mt-2">
                                我们可能适时更新本协议。更新后将在本页面展示，并在必要时通过适当方式提示你。
                                如你不同意更新内容，应停止使用本服务。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                九、争议解决（占位）
                            </h2>
                            <p className="mt-2">
                                如发生争议，双方应先协商解决；协商不成的，可向有管辖权的人民法院提起诉讼。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                十、联系我们
                            </h2>
                            <p className="mt-2">
                                如对本协议有疑问，请通过 App
                                内“官方客服”或“投诉/售后”入口与我们联系。
                            </p>
                        </section>
                    </div>
                </Card>
            </div>
        </Container>
    );
}
