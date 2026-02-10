import { prisma } from "@/lib/prisma"
import { MetricsEngine, MetricContext, KPI_REGISTRY } from "@/services/analytics/metrics-engine"
import { UnifiedMetric } from "@prisma/client"

export class SnapshotBuilder {
    private engine: MetricsEngine

    constructor() {
        this.engine = new MetricsEngine()
    }

    async buildSnapshotsForWorkspace(workspaceId: string, inputDate?: Date) {
        // 1. Build Executive Snapshot
        await this.buildExecutiveSnapshot(workspaceId, inputDate)

        // 2. Build Channel Performance Snapshot
        await this.buildChannelSnapshot(workspaceId, inputDate)
    }

    private async buildExecutiveSnapshot(workspaceId: string, targetDate?: Date) {
        // Aggregate all metrics for the workspace (optionally formatted by day)
        // Logic: Group by Date.
        // For MVP: Rebuild ALL or just specific day? 
        // Better to rebuild specific day if provided, or "last 30 days".
        // Let's implement rebuild for "Date" if provided, otherwise all distinct dates in UnifiedMetric that don't have snapshots?
        // Simplicity: Rebuild for the dates present in recent uploads.

        // Let's assume we are triggered post-normalization for a set of dates found in the Upload.
        // Finding relevant dates:
        const metrics = await prisma.unifiedMetric.findMany({
            where: { workspaceId, ...(targetDate ? { date: targetDate } : {}) },
            select: { date: true, metrics: true, metricContext: true }
        })

        if (metrics.length === 0) return

        // Group by Date
        const groupedByDate = new Map<string, typeof metrics>()
        metrics.forEach(m => {
            const dKey = m.date.toISOString().split('T')[0]
            if (!groupedByDate.has(dKey)) groupedByDate.set(dKey, [])
            groupedByDate.get(dKey)?.push(m)
        })

        for (const [dateStr, dailyMetrics] of groupedByDate.entries()) {
            // Aggregate
            const agg = this.aggregateMetrics(dailyMetrics)

            // Validate context for KPI
            const aggCtx: MetricContext = {
                source: 'blended', // Executive view mixes everything
                report_type: 'overview',
                confidence: this.deriveConfidence(dailyMetrics)
            }

            // Compute KPIs
            const roas = this.engine.computeKPI('ROAS', agg, { ...aggCtx, source: 'ads' }, 'DAILY')
            // Note: ROAS computed on blended data might be wrong if we mix organic revenue?
            // Executive Dashboard usually wants "Total Blended ROAS" (Total Rev / Total Spend) or "Ad ROAS"?
            // Usually "Ad ROAS". If we have organic revenue, we shouldn't mix it into ROAS unless it's "MER" (Marketing Efficiency Ratio).
            // Let's stick to strict ROAS: We need to sum ONLY Ads Revenue for ROAS numerator? 
            // Or use the aggregate. If the aggregate includes organic revenue, standard ROAS logic fails.
            // Strict approach: Calculate metrics separately for Ads context vs Organic context.

            // For MVP simplicity: Calculate 'raw' derived values if valid.
            // If we have spend, we assume the revenue associated is relevant? 
            // Let's rely on the engine. If we pass blended context, ROAS returns null (per defined rules).
            // But Executive Snapshot field is `roas`. 
            // We should filter metrics for 'ads' sourcing to compute ROAS?

            const adsMetrics = dailyMetrics.filter(m => {
                const c = JSON.parse(m.metricContext) as MetricContext
                return c.source === 'ads'
            })
            const adsAgg = this.aggregateMetrics(adsMetrics)
            const strictRoas = this.engine.computeKPI('ROAS', adsAgg, { ...aggCtx, source: 'ads' }, 'DAILY')

            await prisma.executiveSnapshot.upsert({
                where: {
                    workspaceId_date: {
                        workspaceId,
                        date: new Date(dateStr)
                    }
                },
                update: {
                    revenue: agg.revenue || 0,
                    spend: agg.spend || 0,
                    orders: agg.orders || 0,
                    roas: strictRoas ?? undefined,
                    confidence: aggCtx.confidence
                },
                create: {
                    workspaceId,
                    date: new Date(dateStr),
                    revenue: agg.revenue || 0,
                    spend: agg.spend || 0,
                    orders: agg.orders || 0,
                    roas: strictRoas ?? undefined,
                    confidence: aggCtx.confidence
                }
            })
        }
    }

    private async buildChannelSnapshot(workspaceId: string, targetDate?: Date) {
        const metrics = await prisma.unifiedMetric.findMany({
            where: { workspaceId, ...(targetDate ? { date: targetDate } : {}) },
            select: { date: true, platform: true, metrics: true, metricContext: true }
        })

        // Group by Date + Platform
        const grouped = new Map<string, typeof metrics>()
        metrics.forEach(m => {
            const key = `${m.date.toISOString().split('T')[0]}::${m.platform}`
            if (!grouped.has(key)) grouped.set(key, [])
            grouped.get(key)?.push(m)
        })

        for (const [key, platformMetrics] of grouped.entries()) {
            const [dateStr, platform] = key.split('::')
            const agg = this.aggregateMetrics(platformMetrics)

            // Derivations
            // For Channel Perf, usually implies Ads logic for ROAS/CVR/CTR?
            // Or Total Store logic?
            // Safe bet: Compute strict ads metrics for ROAS/CVR/CTR.
            const adsMetrics = platformMetrics.filter(m => {
                const c = JSON.parse(m.metricContext) as MetricContext
                return c.source === 'ads'
            })
            const adsAgg = this.aggregateMetrics(adsMetrics)

            const dummyCtx: MetricContext = { source: 'ads', report_type: 'ads', confidence: 'high' }

            const roas = this.engine.computeKPI('ROAS', adsAgg, dummyCtx, 'DAILY')
            const cvr = this.engine.computeKPI('CVR', adsAgg, dummyCtx, 'DAILY')
            const ctr = this.engine.computeKPI('CTR', adsAgg, dummyCtx, 'DAILY')

            await prisma.channelPerformanceSnapshot.upsert({
                where: {
                    workspaceId_date_platform: {
                        workspaceId,
                        date: new Date(dateStr),
                        platform
                    }
                },
                update: {
                    revenue: agg.revenue || 0,
                    spend: agg.spend || 0,
                    orders: agg.orders || 0,
                    impressions: agg.impressions || 0,
                    clicks: agg.clicks || 0,
                    roas: roas ?? undefined,
                    cvr: cvr ?? undefined,
                    ctr: ctr ?? undefined
                },
                create: {
                    workspaceId,
                    date: new Date(dateStr),
                    platform,
                    revenue: agg.revenue || 0,
                    spend: agg.spend || 0,
                    orders: agg.orders || 0,
                    impressions: agg.impressions || 0,
                    clicks: agg.clicks || 0,
                    roas: roas ?? undefined,
                    cvr: cvr ?? undefined,
                    ctr: ctr ?? undefined
                }
            })
        }
    }

    private aggregateMetrics(metrics: { metrics: string }[]): Record<string, number> {
        const result: Record<string, number> = {}

        metrics.forEach(m => {
            const parsed = JSON.parse(m.metrics) as Record<string, number>
            Object.entries(parsed).forEach(([key, val]) => {
                result[key] = (result[key] || 0) + val
            })
        })

        return result
    }

    private deriveConfidence(metrics: { metricContext: string }[]): 'high' | 'medium' | 'low' {
        // Fallback rule: If ANY low confidence, result is low.
        let lowCount = 0
        let mediumCount = 0
        let count = 0

        metrics.forEach(m => {
            const ctx = JSON.parse(m.metricContext) as MetricContext
            if (ctx.confidence === 'low') lowCount++
            if (ctx.confidence === 'medium') mediumCount++
            count++
        })

        if (lowCount > 0) return 'low'
        if (mediumCount / count > 0.5) return 'medium'
        return 'high'
    }
}
