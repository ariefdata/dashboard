"use client"

import { cn } from "@/lib/utils"
import { BarChart3, CloudUpload, Home, LayoutDashboard, LogOut, Settings } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navigation = [
    { name: "Overview", href: "/dashboard", icon: Home },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Uploads", href: "/uploads", icon: CloudUpload },
    { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
    const pathname = usePathname()

    return (
        <div className="flex h-full w-64 flex-col border-r bg-card text-card-foreground">
            <div className="flex h-16 items-center border-b px-6">
                <LayoutDashboard className="mr-2 h-6 w-6 text-primary" />
                <span className="text-lg font-bold tracking-tight text-primary">Wicara</span>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
                <nav className="space-y-1 px-3">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon className="mr-3 h-5 w-5" />
                                {item.name}
                            </Link>
                        )
                    })}
                </nav>
            </div>
            <div className="border-t p-4">
                <div className="flex items-center">
                    {/* User profile could go here */}
                </div>
            </div>
        </div>
    )
}
