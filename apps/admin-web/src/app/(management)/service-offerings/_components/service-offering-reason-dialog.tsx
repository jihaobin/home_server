"use client"

import { useEffect, useState } from "react"
import { Button } from "@repo/web-ui/components/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@repo/web-ui/components/dialog"
import { Textarea } from "@repo/web-ui/components/textarea"

type ServiceOfferingReasonDialogProps = {
    open: boolean
    title: string
    description: string
    confirmLabel: string
    isPending?: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (reason: string) => Promise<void> | void
}

export function ServiceOfferingReasonDialog({
    open,
    title,
    description,
    confirmLabel,
    isPending,
    onOpenChange,
    onConfirm,
}: ServiceOfferingReasonDialogProps) {
    const [reason, setReason] = useState("")
    const trimmedReason = reason.trim()

    useEffect(() => {
        if (!open) {
            setReason("")
        }
    }, [open])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                        原因
                    </label>
                    <Textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="请输入原因，最多 500 个字符"
                        maxLength={500}
                        rows={5}
                    />
                    <p className="text-xs text-muted-foreground">
                        {trimmedReason.length}/500
                    </p>
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => onOpenChange(false)}
                    >
                        取消
                    </Button>
                    <Button
                        type="button"
                        disabled={!trimmedReason || isPending}
                        onClick={async () => {
                            await onConfirm(trimmedReason)
                        }}
                    >
                        {isPending ? "处理中..." : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
