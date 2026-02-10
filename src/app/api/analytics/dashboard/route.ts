import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    let workspaceId = searchParams.get("workspaceId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    if (!workspaceId) {
        // MVP: Find first workspace for user
        const user = session?.user
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }
        const member = await prisma.workspaceMember.findFirst({
            where: { userId: (user as any).id },
            select: { workspaceId: true }
        })
        if (member) {
            workspaceId = member.workspaceId
        } else {
            return NextResponse.json({ message: "No workspace found" }, { status: 404 })
        }
    }

    try {
        const dateFilter: any = {}
        if (startDate) dateFilter.gte = new Date(startDate)
        if (endDate) dateFilter.lte = new Date(endDate)

        const [executive, channels] = await Promise.all([
            prisma.executiveSnapshot.findMany({
                where: {
                    workspaceId,
                    date: dateFilter
                },
                orderBy: { date: 'asc' }
            }),
            prisma.channelPerformanceSnapshot.findMany({
                where: {
                    workspaceId,
                    date: dateFilter
                },
                orderBy: { date: 'asc' }
            })
        ])

        return NextResponse.json({
            executive,
            channels
        })
    } catch (error: any) {
        console.error("Dashboard API error:", error)
        return NextResponse.json({ message: "Failed to fetch dashboard data" }, { status: 500 })
    }
}
