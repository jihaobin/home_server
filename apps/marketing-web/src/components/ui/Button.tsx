import Link from "next/link";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

function baseClasses(variant: ButtonVariant) {
    const common =
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50";
    const focus =
        "focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2";

    switch (variant) {
        case "primary":
            return cn(
                common,
                focus,
                "bg-primary text-primary-foreground hover:bg-primary/90",
            );
        case "secondary":
            return cn(
                common,
                focus,
                "bg-muted text-foreground hover:bg-muted/80",
            );
        case "ghost":
            return cn(
                common,
                focus,
                "bg-transparent text-foreground hover:bg-muted",
            );
    }
}

function sizeClasses(size: ButtonSize) {
    switch (size) {
        case "sm":
            return "h-9 px-4 text-sm";
        case "md":
            return "h-11 px-5 text-sm";
        case "lg":
            return "h-12 px-6 text-base";
    }
}

export function Button({
    variant = "primary",
    size = "md",
    className,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
}) {
    return (
        <button
            className={cn(baseClasses(variant), sizeClasses(size), className)}
            {...props}
        />
    );
}

export function ButtonLink({
    href,
    variant = "primary",
    size = "md",
    className,
    children,
    ...props
}: {
    href: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
    children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className">) {
    const isExternal = /^https?:\/\//i.test(href);

    const anchorProps: React.AnchorHTMLAttributes<HTMLAnchorElement> = {
        ...(isExternal ? { target: "_blank", rel: "noreferrer" } : undefined),
        ...props,
    };

    const classes = cn(baseClasses(variant), sizeClasses(size), className);

    if (isExternal) {
        return (
            <a href={href} className={classes} {...anchorProps}>
                {children}
            </a>
        );
    }

    return (
        <Link href={href} className={classes} {...anchorProps}>
            {children}
        </Link>
    );
}
