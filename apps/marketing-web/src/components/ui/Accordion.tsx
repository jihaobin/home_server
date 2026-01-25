"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/cn";

export type AccordionItem = {
    title: string;
    content: React.ReactNode;
};

export function Accordion({
    items,
    className,
    defaultIndex = 0,
}: {
    items: AccordionItem[];
    className?: string;
    defaultIndex?: number | null;
}) {
    const baseId = useId();
    const initial = defaultIndex === null ? null : defaultIndex;
    const [openIndex, setOpenIndex] = useState<number | null>(initial);

    const resolved = useMemo(
        () =>
            items.map((item, index) => {
                const buttonId = `${baseId}-btn-${index}`;
                const panelId = `${baseId}-panel-${index}`;
                return { ...item, buttonId, panelId };
            }),
        [baseId, items],
    );

    return (
        <div
            className={cn(
                "divide-y divide-border overflow-hidden rounded-[var(--radius)] border border-border bg-card",
                className,
            )}
        >
            {resolved.map((item, index) => {
                const isOpen = openIndex === index;
                return (
                    <div key={item.buttonId}>
                        <button
                            id={item.buttonId}
                            type="button"
                            className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-base font-semibold hover:bg-muted/60"
                            aria-expanded={isOpen}
                            aria-controls={item.panelId}
                            onClick={() => setOpenIndex(isOpen ? null : index)}
                        >
                            <span>{item.title}</span>
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "text-muted-foreground transition-transform",
                                    isOpen ? "rotate-180" : "rotate-0",
                                )}
                            >
                                ▾
                            </span>
                        </button>
                        <div
                            id={item.panelId}
                            role="region"
                            aria-labelledby={item.buttonId}
                            className={cn(
                                "px-4 pb-4 text-sm text-muted-foreground",
                                isOpen ? "block" : "hidden",
                            )}
                        >
                            {item.content}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
