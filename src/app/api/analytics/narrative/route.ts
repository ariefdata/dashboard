import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { InsightEngine } from "@/services/analytics/insight-engine"
import { NarrativeDataPreparer } from "@/services/analytics/narrative-data-preparer"
import { generateNarrative } from "@/services/analytics/narrative-engine"

/**
 * GET /api/analytics/narrative
 *
 * Thin wire:
 *   1. Generate insights (upstream)
 *   2. Prepare NarrativeInput (upstream aggregation)
 *   3. generateNarrative(input) → NarrativeOutput (pure string composition)
 *   4. Return JSON
 *
 * This route MUST NOT aggregate, reshape, or modify data.
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    let workspaceId = searchParams.get("workspaceId")
    const startDateStr = searchParams.get("startDate")
    const endDateStr = searchParams.get("endDate")

    // Auto-resolve workspace
    if (!workspaceId) {
        const user = session.user
        if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        const member = await prisma.workspaceMember.findFirst({
            where: { userId: (user as any).id },
            select: { workspaceId: true }
        })
        if (member) workspaceId = member.workspaceId
        else return NextResponse.json({ message: "Tidak ditemukan workspace" }, { status: 404 })
    }

    if (!startDateStr || !endDateStr) {
        return NextResponse.json({ message: "Rentang tanggal diperlukan" }, { status: 400 })
    }

    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)

    try {
        // Step 1: Generate insights (upstream)
        const insightEngine = new InsightEngine()
        const insights = await insightEngine.generateInsights(workspaceId, startDate, endDate)

        // Step 2: Prepare finalized NarrativeInput (upstream aggregation)
        const preparer = new NarrativeDataPreparer()
        const input = await preparer.prepare(workspaceId, startDate, endDate, insights)

        if (!input) {
            return NextResponse.json({
                locale: 'id-ID',
                period: `${startDate.toLocaleDateString('id-ID')} – ${endDate.toLocaleDateString('id-ID')}`,
                executive_summary: 'Tidak ada data yang tersedia untuk periode ini.',
                insight_details: [],
            })
        }

        // Step 3: Pure string composition
        const output = generateNarrative(input)

        return NextResponse.json(output)
    } catch (error: any) {
        console.error("Narrative API error:", error)
        return NextResponse.json({ message: "Gagal menghasilkan narasi" }, { status: 500 })
    }
}
