import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { SnapshotBuilder } from "@/services/analytics/snapshot-builder"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { workspaceId, date } = await req.json()
        if (!workspaceId) {
            return NextResponse.json({ message: "Workspace ID required" }, { status: 400 })
        }

        const builder = new SnapshotBuilder()
        const targetDate = date ? new Date(date) : undefined

        await builder.buildSnapshotsForWorkspace(workspaceId, targetDate)

        return NextResponse.json({ success: true, message: "Snapshots rebuilt" })
    } catch (error: any) {
        console.error("Snapshot build failed:", error)
        return NextResponse.json({ message: error.message || "Snapshot failed" }, { status: 500 })
    }
}
