import { prisma } from "@/lib/prisma"
import { Insight } from "./insight-engine"
import { NarrativeInput } from "./narrative-types"

/**
 * NarrativeDataPreparer — Upstream Aggregation
 *
 * This module IS allowed to:
 *   - read snapshots from Prisma
 *   - aggregate values
 *   - compute derived fields (ROAS)
 *   - determine confidence
 *
 * Its sole purpose is to produce a NarrativeInput DTO
 * that the Narrative Engine can render without further processing.
 *
 * The Narrative Engine never sees this module.
 */
export class NarrativeDataPreparer {

    async prepare(
        workspaceId: string,
        startDate: Date,
        endDate: Date,
        insights: Insight[]
    ): Promise<NarrativeInput | null> {

        const period = `${startDate.toLocaleDateString('id-ID')} – ${endDate.toLocaleDateString('id-ID')}`

        // ── Executive Aggregation ──
        const execSnaps = await prisma.executiveSnapshot.findMany({
            where: { workspaceId, date: { gte: startDate, lte: endDate } }
        })

        if (execSnaps.length === 0) return null

        let totalRevenue = 0
        let totalSpend = 0
        let totalOrders = 0
        let worstConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH'

        for (const s of execSnaps) {
            totalRevenue += Number(s.revenue)
            totalSpend += Number(s.spend)
            totalOrders += Number(s.orders)
            const c = s.confidence.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW'
            if (c === 'LOW') worstConfidence = 'LOW'
            else if (c === 'MEDIUM' && worstConfidence !== 'LOW') worstConfidence = 'MEDIUM'
        }

        const roas = totalSpend > 0 ? totalRevenue / totalSpend : null

        // ── Previous Period ──
        const duration = endDate.getTime() - startDate.getTime()
        const prevEnd = new Date(startDate.getTime())
        const prevStart = new Date(prevEnd.getTime() - duration)

        const prevSnaps = await prisma.executiveSnapshot.findMany({
            where: { workspaceId, date: { gte: prevStart, lte: prevEnd } }
        })

        let previous: NarrativeInput['executive']['previous'] | undefined
        if (prevSnaps.length > 0) {
            let pRev = 0, pSpend = 0, pOrders = 0
            for (const s of prevSnaps) {
                pRev += Number(s.revenue)
                pSpend += Number(s.spend)
                pOrders += Number(s.orders)
            }
            previous = {
                revenue: pRev,
                spend: pSpend,
                orders: pOrders,
                roas: pSpend > 0 ? pRev / pSpend : null
            }
        }

        // ── Channel Aggregation ──
        const chanSnaps = await prisma.channelPerformanceSnapshot.findMany({
            where: { workspaceId, date: { gte: startDate, lte: endDate } }
        })

        const chanMap = new Map<string, { revenue: number; spend: number; orders: number }>()
        for (const s of chanSnaps) {
            const exist = chanMap.get(s.platform) || { revenue: 0, spend: 0, orders: 0 }
            exist.revenue += Number(s.revenue)
            exist.spend += Number(s.spend)
            exist.orders += Number(s.orders)
            chanMap.set(s.platform, exist)
        }

        const channels: NarrativeInput['channels'] = Array.from(chanMap.entries()).map(([platform, d]) => ({
            platform: platform as 'SHOPEE' | 'LAZADA' | 'TIKTOK',
            revenue: d.revenue,
            spend: d.spend,
            orders: d.orders,
            roas: d.spend > 0 ? d.revenue / d.spend : null
        }))

        // ── Map Insights to DTO shape ──
        const mappedInsights: NarrativeInput['insights'] = insights.map(i => ({
            insight_type: i.insight_type,
            metric: i.metric,
            change: i.change,
            likely_cause: i.likely_cause,
            confidence: i.confidence,
            recommended_action: i.recommended_action
        }))

        return {
            period,
            executive: {
                revenue: totalRevenue,
                spend: totalSpend,
                orders: totalOrders,
                roas,
                confidence: worstConfidence,
                previous
            },
            channels,
            insights: mappedInsights
        }
    }
}
