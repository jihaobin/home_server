import { cn } from "@repo/web-ui/lib/utils"

type PageContainerProps = React.HTMLAttributes<HTMLDivElement>

export function PageContainer({ className, ...props }: PageContainerProps) {
    return (
        <div
            className={cn(
                "flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10",
                "bg-muted/20",
                className,
            )}
            {...props}
        />
    )
}
