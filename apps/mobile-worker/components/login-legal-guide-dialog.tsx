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

                <View className="mt-2 overflow-hidden rounded-2xl border border-border/80 bg-muted/40">
                    <Pressable
                        className="flex-row items-center justify-between px-4 py-3.5"
                        onPress={() => onOpenLegalDoc("terms")}
                        hitSlop={8}
                    >
                        <Text className="text-sm font-medium text-foreground">
                            《用户协议》
                        </Text>
                        <ChevronRight size={16} className="text-muted-foreground" />
                    </Pressable>
                    <View className="h-px bg-border/80" />
                    <Pressable
                        className="flex-row items-center justify-between px-4 py-3.5"
                        onPress={() => onOpenLegalDoc("privacy")}
                        hitSlop={8}
                    >
                        <Text className="text-sm font-medium text-foreground">
                            《隐私政策》
                        </Text>
                        <ChevronRight size={16} className="text-muted-foreground" />
                    </Pressable>
                </View>

                <AlertDialogFooter className="mt-1">
                    <Button className="h-12 rounded-2xl bg-primary" onPress={onConfirm}>
                        <Text className="text-sm font-semibold text-primary-foreground">
                            确认并继续
                        </Text>
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
