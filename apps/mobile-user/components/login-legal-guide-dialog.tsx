import { Button } from "@repo/mobile-ui/components/ui/button";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@repo/mobile-ui/components/ui/alert-dialog";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { ChevronRight } from "@repo/mobile-ui/lib/icons/ChevronRight";
import type { LegalDocKey } from "@/lib/legal-documents";
import { Pressable, View } from "react-native";

type LoginLegalGuideDialogProps = {
    open: boolean;
    onConfirm: () => void;
    onOpenLegalDoc: (doc: LegalDocKey) => void;
};

export function LoginLegalGuideDialog({
    open,
    onConfirm,
    onOpenLegalDoc,
}: LoginLegalGuideDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={() => undefined}>
            <AlertDialogContent className="w-[88%] max-w-sm rounded-3xl border border-border bg-card px-5 py-6 shadow-xl shadow-black/10">
                <AlertDialogHeader className="gap-3">
                    <AlertDialogTitle className="text-center text-lg font-puhui-medium text-foreground">
                        登录前请先阅读
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-center text-sm leading-6 text-muted-foreground">
                        为保障你的账号与个人信息安全，请在登录前阅读用户协议和隐私政策。
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <View className="gap-3">
                    <Pressable
                        onPress={() => onOpenLegalDoc("terms")}
                        className="rounded-2xl border border-primary/20 bg-background px-4 py-3"
                    >
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1 pr-3">
                                <Text className="text-sm font-puhui-medium text-primary">
                                    《用户协议》
                                </Text>
                                <Text className="mt-1 text-xs leading-5 text-muted-foreground">
                                    了解账号使用规则、服务说明与责任边界。
                                </Text>
                                <Text className="mt-2 text-xs font-puhui-medium text-primary">
                                    点击查看全文
                                </Text>
                            </View>
                            <ChevronRight
                                size={18}
                                className="text-primary"
                            />
                        </View>
                    </Pressable>

                    <Pressable
                        onPress={() => onOpenLegalDoc("privacy")}
                        className="rounded-2xl border border-primary/20 bg-background px-4 py-3"
                    >
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1 pr-3">
                                <Text className="text-sm font-puhui-medium text-primary">
                                    《隐私政策》
                                </Text>
                                <Text className="mt-1 text-xs leading-5 text-muted-foreground">
                                    了解我们如何收集、使用、存储和保护你的个人信息。
                                </Text>
                                <Text className="mt-2 text-xs font-puhui-medium text-primary">
                                    点击查看全文
                                </Text>
                            </View>
                            <ChevronRight
                                size={18}
                                className="text-primary"
                            />
                        </View>
                    </Pressable>
                </View>

                <AlertDialogFooter className="mt-1">
                    <Button className="w-full rounded-2xl" onPress={onConfirm}>
                        <Text className="text-primary-foreground">我已知晓</Text>
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
