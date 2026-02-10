import { prisma } from "@/lib/prisma"
import { ExecutiveSnapshot, ChannelPerformanceSnapshot } from "@prisma/client"

export type InsightType = 'performance' | 'efficiency' | 'risk' | 'opportunity'
export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface Insight {
    insight_type: InsightType
    metric: 'revenue' | 'roas' | 'cvr' | 'spend' | 'orders'
    change: {
        direction: 'up' | 'down' | 'flat'
        absolute: number
        percentage: number | null
    }
    likely_cause: string
    evidence: string[]
    confidence: ConfidenceLevel
    recommended_action?: string
}

const THRESHOLDS = {
    REVENUE_CHANGE: 0.10, // 10%
    ROAS_CHANGE: 0.15,    // 15%
    SIGNIFICANT_CHANNEL_DROP: 0.50 // 50% of total delta explained by one channel
}

export class InsightEngine {

    async generateInsights(workspaceId: string, currentStart: Date, currentEnd: Date): Promise<Insight[]> {
        // 1. Fetch Current Data
        const currentExecutive = await this.getAggregatedExecutive(workspaceId, currentStart, currentEnd)
        if (!currentExecutive || currentExecutive.revenue === 0) return [] // No data to analyze

        // 2. Fetch Previous Data (Compare same duration)
        const duration = currentEnd.getTime() - currentStart.getTime()
        const prevEnd = new Date(currentStart.getTime())
        const prevStart = new Date(prevEnd.getTime() - duration)

        const prevExecutive = await this.getAggregatedExecutive(workspaceId, prevStart, prevEnd)

        // If no previous data, we can't generate change insights (maybe only static anomalies, but for now return empty)
        if (!prevExecutive || prevExecutive.revenue === 0) return []

        const insights: Insight[] = []

        // 3. Analyze Executive Metric Changes
        const revenueChange = this.calculateChange(currentExecutive.revenue, prevExecutive.revenue)
        const spendChange = this.calculateChange(currentExecutive.spend, prevExecutive.spend)
        const roasChange = this.calculateChange(currentExecutive.roas || 0, prevExecutive.roas || 0)

        // Base Confidence on input data confidence
        const confidence = this.deriveConfidence(currentExecutive.confidence, prevExecutive.confidence)

        // Rule A: Inefficient Spend (Rev Down, Spend Up, ROAS Down)
        if (revenueChange.pct < -THRESHOLDS.REVENUE_CHANGE && spendChange.pct > 0.05 && roasChange.pct < -THRESHOLDS.ROAS_CHANGE) {
            insights.push({
                insight_type: 'efficiency',
                metric: 'revenue',
                change: { direction: 'down', absolute: revenueChange.abs, percentage: revenueChange.pct },
                likely_cause: "Increased spend on low-efficiency channels or campaigns",
                evidence: [
                    `Spend increased by ${this.formatPct(spendChange.pct)}`,
                    `ROAS dropped by ${this.formatPct(roasChange.pct)}`
                ],
                confidence,
                recommended_action: "Audit recent campaign scaling or broad targeting changes."
            })
        }

        // Rule B: Demand Drop (Rev Down, Spend Down, ROAS Stable/Flat)
        // "Stable" defined as within +/- 10%?
        if (revenueChange.pct < -THRESHOLDS.REVENUE_CHANGE && spendChange.pct < -0.05 && Math.abs(roasChange.pct) < 0.10) {
            insights.push({
                insight_type: 'risk',
                metric: 'revenue',
                change: { direction: 'down', absolute: revenueChange.abs, percentage: revenueChange.pct },
                likely_cause: "Lower demand or traffic volume (ROAS remained stable)",
                evidence: [
                    `Spend decreased aligned with revenue`,
                    `ROAS remained stable (${this.formatPct(roasChange.pct)})`
                ],
                confidence,
                recommended_action: "Check inventory availability or seasonal demand trends."
            })
        }

        // Rule C: Opportunity Signal (ROAS Up, Spend Flat/Down)
        if (roasChange.pct > THRESHOLDS.ROAS_CHANGE && spendChange.pct <= 0.05) {
            insights.push({
                insight_type: 'opportunity',
                metric: 'roas',
                change: { direction: 'up', absolute: roasChange.abs, percentage: roasChange.pct },
                likely_cause: "High efficiency with potential for scaling",
                evidence: [
                    `ROAS improved by ${this.formatPct(roasChange.pct)}`,
                    `Spend did not increase significantly`
                ],
                confidence,
                recommended_action: "Consider increasing budget on top-performing campaigns."
            })
        }

        // Rule D: Channel Specific Regression
        // If Revenue Down, check if one channel is the main culprit
        if (revenueChange.pct < -THRESHOLDS.REVENUE_CHANGE) {
            const channelInsight = await this.analyzeChannelRegression(workspaceId, currentStart, currentEnd, prevStart, prevEnd, revenueChange.abs)
            if (channelInsight) {
                // Adjust confidence based on overall
                channelInsight.confidence = confidence === 'low' ? 'low' : channelInsight.confidence
                insights.push(channelInsight)
            }
        }

        return insights
    }

    private async analyzeChannelRegression(
        workspaceId: string,
        cStart: Date, cEnd: Date,
        pStart: Date, pEnd: Date,
        totalRevDelta: number
    ): Promise<Insight | null> {
        const currentChannels = await this.getAggregatedChannels(workspaceId, cStart, cEnd)
        const prevChannels = await this.getAggregatedChannels(workspaceId, pStart, pEnd)

        let majorCulprit: string | null = null
        let culpritDelta = 0

        const evidence: string[] = []

        // Compare
        for (const [platform, curr] of Object.entries(currentChannels)) {
            const prev = prevChannels[platform] || { revenue: 0 }
            const delta = curr.revenue - prev.revenue

            if (delta < 0) {
                // Is this delta contributing > 50% of the total drop?
                // totalRevDelta is negative
                if (delta / totalRevDelta > THRESHOLDS.SIGNIFICANT_CHANNEL_DROP) {
                    majorCulprit = platform
                    culpritDelta = delta
                    evidence.push(`${platform} revenue dropped by ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Math.abs(delta))}`)
                }
            }
        }

        if (majorCulprit) {
            return {
                insight_type: 'performance',
                metric: 'revenue',
                change: { direction: 'down', absolute: totalRevDelta, percentage: null },
                likely_cause: `Performance regression isolated primarily to ${majorCulprit}`,
                evidence,
                confidence: 'high', // Channel data usually specific
                recommended_action: `Deep dive into ${majorCulprit} campaign performance.`
            }
        }

        return null
    }

    private async getAggregatedExecutive(workspaceId: string, start: Date, end: Date) {
        const snaps = await prisma.executiveSnapshot.findMany({
            where: { workspaceId, date: { gte: start, lte: end } }
        })
        if (snaps.length === 0) return null

        const agg = snaps.reduce((acc, curr) => ({
            revenue: acc.revenue + Number(curr.revenue),
            spend: acc.spend + Number(curr.spend),
            confidence: curr.confidence // rough fallback to last? Or logic?
        }), { revenue: 0, spend: 0, confidence: 'high' as string })

        const roas = agg.spend > 0 ? agg.revenue / agg.spend : 0

        // Confidence Logic: If any low => low
        let confidence: ConfidenceLevel = 'high'
        if (snaps.some(s => s.confidence.toLowerCase() === 'low')) confidence = 'low'
        else if (snaps.some(s => s.confidence.toLowerCase() === 'medium')) confidence = 'medium'

        return { ...agg, roas, confidence }
    }

    private async getAggregatedChannels(workspaceId: string, start: Date, end: Date) {
        const snaps = await prisma.channelPerformanceSnapshot.findMany({
            where: { workspaceId, date: { gte: start, lte: end } }
        })

        const byPlatform: Record<string, { revenue: number }> = {}
        snaps.forEach(s => {
            if (!byPlatform[s.platform]) byPlatform[s.platform] = { revenue: 0 }
            byPlatform[s.platform].revenue += Number(s.revenue)
        })
        return byPlatform
    }

    private calculateChange(curr: number, prev: number) {
        const abs = curr - prev
        const pct = prev !== 0 ? abs / prev : 0
        return { abs, pct }
    }

    private formatPct(val: number) {
        return `${(val * 100).toFixed(1)}%`
    }

    private deriveConfidence(c1: string, c2: string): ConfidenceLevel {
        const s1 = c1.toLowerCase()
        const s2 = c2.toLowerCase()
        if (s1 === 'low' || s2 === 'low') return 'low'
        if (s1 === 'medium' || s2 === 'medium') return 'medium'
        return 'high'
    }
}
