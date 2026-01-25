import { cn } from "@/lib/cn";

export function Card({
    className,
    children,
}: {
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div
            className={cn(
                "rounded-[var(--radius)] border border-border bg-card text-card-foreground shadow-sm",
                className,
            )}
        >
            {children}
        </div>
    );
}
