"use client"

import { Button } from "@/components/ui/button"
import { signOut, useSession } from "next-auth/react"

export function TopNav() {
    const { data: session } = useSession()

    return (
        <header className="flex h-16 items-center justify-between border-b bg-background px-6">
            <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
            <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                    {session?.user?.email}
                </span>
                <Button variant="outline" size="sm" onClick={() => signOut()}>
                    Logout
                </Button>
            </div>
        </header>
    )
}
