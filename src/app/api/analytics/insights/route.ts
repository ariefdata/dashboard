import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { InsightEngine } from "@/services/analytics/insight-engine"

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    let workspaceId = searchParams.get("workspaceId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Auto-resolve workspace if missing (MVP convenience)
    if (!workspaceId) {
        const member = await prisma.workspaceMember.findFirst({
            where: { userId: (session.user as any).id },
            select: { workspaceId: true }
        })
        if (member) workspaceId = member.workspaceId
        else return NextResponse.json({ message: "No workspace found" }, { status: 404 })
    }

    if (!startDate || !endDate) {
        return NextResponse.json({ message: "Date range required" }, { status: 400 })
    }

    try {
        const engine = new InsightEngine()
        const insights = await engine.generateInsights(
            workspaceId,
            new Date(startDate),
            new Date(endDate)
        )

        return NextResponse.json({ insights })
    } catch (error: any) {
        console.error("Insight API error:", error)
        return NextResponse.json({ message: "Failed to generate insights" }, { status: 500 })
    }
}
