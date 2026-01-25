import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
    title: "隐私政策",
    description: `${SITE_NAME} 隐私政策（占位版本，可按实际业务完善）。`,
    alternates: {
        canonical: absoluteUrl("/privacy"),
    },
    robots: {
        index: true,
        follow: true,
    },
};

export default function PrivacyPage() {
    return (
        <Container className="py-14">
            <div className="max-w-3xl">
                <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                    隐私政策
                </h1>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    生效日期：2026-01-24（占位）｜本页面为示例占位内容，请结合实际业务、产品功能与合规要求进行完善。
                </p>

                <Card className="mt-8 p-8">
                    <div className="space-y-6 text-sm leading-7 text-foreground/90">
                        <section>
                            <h2 className="text-lg font-extrabold">
                                一、我们收集哪些信息
                            </h2>
                            <p className="mt-2">
                                为了向你提供服务、保障交易安全并改善体验，我们可能收集以下类型信息（具体以你实际使用的功能为准）：
                            </p>
                            <ul className="mt-3 list-disc space-y-2 pl-6">
                                <li>
                                    账号与身份信息：手机号、验证码登录信息、昵称/头像等（你自愿提供）。
                                </li>
                                <li>
                                    位置信息：用于推荐附近服务、地址定位与上门服务（你可在系统设置中关闭权限）。
                                </li>
                                <li>
                                    地址信息：服务地址、门牌信息、联系人信息（用于完成服务履约）。
                                </li>
                                <li>
                                    订单与服务信息：下单记录、服务状态、评价/售后/投诉信息。
                                </li>
                                <li>
                                    设备与日志信息：设备型号、系统版本、网络信息、崩溃日志（用于安全与稳定性）。
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                二、我们如何使用信息
                            </h2>
                            <ul className="mt-3 list-disc space-y-2 pl-6">
                                <li>
                                    提供核心功能：浏览服务、选择人员、下单、进度查看等。
                                </li>
                                <li>
                                    履约与售后：联系你、安排上门、处理投诉/售后。
                                </li>
                                <li>
                                    安全保障：风控、反欺诈、账号安全与异常检测。
                                </li>
                                <li>
                                    改善体验：分析使用情况，优化功能与性能。
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                三、我们如何共享、转让、公开披露
                            </h2>
                            <p className="mt-2">
                                我们不会出售你的个人信息。为实现服务目的，我们可能在必要范围内与以下对象共享信息：
                            </p>
                            <ul className="mt-3 list-disc space-y-2 pl-6">
                                <li>
                                    服务提供方：为完成上门服务所必需的信息（例如地址、联系方式、订单要点）。
                                </li>
                                <li>
                                    支付/风控相关服务：在必要范围内进行交易处理与风险控制。
                                </li>
                                <li>法律要求：在法律法规或监管要求下提供。</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                四、你的权利
                            </h2>
                            <ul className="mt-3 list-disc space-y-2 pl-6">
                                <li>
                                    访问与更正：你可以查看并修改账号信息、地址等。
                                </li>
                                <li>
                                    删除与注销：你可以申请删除部分信息或注销账号（以产品实际能力为准）。
                                </li>
                                <li>
                                    权限管理：你可以在系统设置中管理定位等权限，拒绝后可能影响部分功能使用。
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                五、信息存储与保护
                            </h2>
                            <p className="mt-2">
                                我们会采取合理的安全措施保护信息安全，包括访问控制、加密传输、日志审计等。
                                但互联网环境并非绝对安全，请你妥善保管账号与验证码信息。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                六、未成年人保护
                            </h2>
                            <p className="mt-2">
                                我们建议未成年人在监护人指导下使用本服务。若你是未成年人，请在使用前征得监护人同意。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                七、政策更新
                            </h2>
                            <p className="mt-2">
                                我们可能适时更新本政策。更新后将在本页面展示，并在必要时通过适当方式提示你。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-extrabold">
                                八、联系我们
                            </h2>
                            <p className="mt-2">
                                如对本政策有疑问，你可以通过 App
                                内“官方客服”或“投诉/售后”入口联系我们。
                            </p>
                        </section>
                    </div>
                </Card>
            </div>
        </Container>
    );
}
