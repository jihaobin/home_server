import Link from "next/link"

export function AppLogo() {
    return (
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
            <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg font-bold">
                管
            </div>
            <div className="flex flex-col">
                <span className="text-lg font-semibold leading-tight">平台运营中心</span>
                <span className="text-xs text-muted-foreground leading-tight">Admin Console</span>
            </div>
        </Link>
    )
}
