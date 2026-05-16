"use client"

import { useState } from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@repo/web-ui/components/alert-dialog"
import { Button } from "@repo/web-ui/components/button"
import { Textarea } from "@repo/web-ui/components/textarea"
import { cn } from "@repo/web-ui/lib/utils"

type Variant = "destructive" | "default"

type ServiceOfferingReasonAlertProps = {
    open: boolean
    title: string
    description: string
    confirmLabel: string
    variant?: Variant
    isPending?: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (reason: string) => Promise<void> | void
}

export function ServiceOfferingReasonAlert({
    open,
    title,
    description,
    confirmLabel,
    variant = "destructive",
    isPending,
    onOpenChange,
    onConfirm,
}: ServiceOfferingReasonAlertProps) {
    const [reason, setReason] = useState("")
    const trimmedReason = reason.trim()

    return (
        <AlertDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    setReason("")
                }
                onOpenChange(next)
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                        原因 <span className="text-rose-500">*</span>
                    </label>
                    <Textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="请填写原因，将会通知服务人员"
                        maxLength={500}
                        rows={5}
                        autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                        {trimmedReason.length}/500
                    </p>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>取消</AlertDialogCancel>
                    <AlertDialogAction
                        className={cn(
                            variant === "destructive" &&
                                "bg-destructive text-white hover:bg-destructive/90",
                        )}
                        disabled={!trimmedReason || isPending}
                        onClick={async (event) => {
                            event.preventDefault()
                            await onConfirm(trimmedReason)
                            setReason("")
                        }}
                    >
                        {isPending ? "处理中..." : confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
