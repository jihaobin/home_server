import { Text } from "@repo/mobile-ui/components/ui/text";
import { Button } from "@repo/mobile-ui/components/ui/button";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@repo/mobile-ui/components/ui/alert-dialog";
import { useCallback, useMemo, useRef, useState } from "react";

export type ConfirmDialogOptions = {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: "default" | "destructive";
};

const DEFAULT_OPTIONS: ConfirmDialogOptions = {
    title: "请确认",
    description: "",
    confirmText: "确认",
    cancelText: "取消",
    confirmVariant: "default",
};

export function useConfirmDialog(defaultOptions?: Partial<ConfirmDialogOptions>) {
    const [options, setOptions] = useState<ConfirmDialogOptions>({
        ...DEFAULT_OPTIONS,
        ...defaultOptions,
    });
    const [open, setOpen] = useState(false);
    const resolverRef = useRef<((value: boolean) => void) | null>(null);

    const resolveDialog = useCallback((value: boolean) => {
        const resolver = resolverRef.current;
        resolverRef.current = null;
        setOpen(false);
        resolver?.(value);
    }, []);

    const confirm = useCallback(
        (nextOptions?: Partial<ConfirmDialogOptions>) => {
            return new Promise<boolean>((resolve) => {
                resolverRef.current = resolve;
                setOptions({
                    ...DEFAULT_OPTIONS,
                    ...defaultOptions,
                    ...nextOptions,
                });
                setOpen(true);
            });
        },
        [defaultOptions],
    );

    const handleOpenChange = useCallback(
        (nextOpen: boolean) => {
            if (nextOpen) {
                setOpen(true);
                return;
            }

            if (resolverRef.current) {
                resolveDialog(false);
                return;
            }

            setOpen(false);
        },
        [resolveDialog],
    );

    const dialog = useMemo(
        () => (
            <AlertDialog open={open} onOpenChange={handleOpenChange}>
                <AlertDialogContent className="w-[84%] max-w-sm rounded-2xl border border-border bg-card px-5 py-5 shadow-xl shadow-black/10">
                    <AlertDialogHeader className="gap-2">
                        <AlertDialogTitle className="text-center text-lg font-puhui-medium text-foreground">
                            {options.title}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-center text-sm leading-6 text-muted-foreground">
                            {options.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-2 flex-row gap-3">
                        <Button
                            variant="outline"
                            className="flex-1 rounded-xl border-border bg-background"
                            onPress={() => resolveDialog(false)}
                        >
                            <Text className="text-foreground">
                                {options.cancelText}
                            </Text>
                        </Button>
                        <Button
                            variant={options.confirmVariant}
                            className="flex-1 rounded-xl"
                            onPress={() => resolveDialog(true)}
                        >
                            <Text
                                className={
                                    options.confirmVariant === "destructive"
                                        ? "text-destructive-foreground"
                                        : "text-primary-foreground"
                                }
                            >
                                {options.confirmText}
                            </Text>
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        ),
        [handleOpenChange, open, options, resolveDialog],
    );

    return {
        confirm,
        confirmDialog: dialog,
    };
}
