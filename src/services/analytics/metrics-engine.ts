
export type MetricContext = {
    source: 'ads' | 'organic' | 'blended'
    report_type: 'overview' | 'ads'
    confidence: 'low' | 'medium' | 'high'
}

type Granularity = string

type KPIDefinition = {
    name: string
    requires: string[]
    validate: (ctx: MetricContext, granularity: Granularity) => boolean
    compute: (metrics: Record<string, number>) => number | null
}

export const KPI_REGISTRY: Record<string, KPIDefinition> = {
    ROAS: {
        name: 'ROAS',
        requires: ['revenue', 'spend'],
        validate: (ctx, gran) => {
            // Logic: ROAS only makes sense for Ads data
            return ctx.source === 'ads' || ctx.report_type === 'ads'
        },
        compute: (m) => {
            if (!m.spend || m.spend <= 0) return null
            // Safety: Return null if infinite? or 0? 
            // ROAS = Revenue / Spend
            return m.revenue / m.spend
        }
    },
    CVR: {
        name: 'CVR',
        requires: ['conversions', 'clicks'],
        validate: (ctx, gran) => {
            return ctx.source === 'ads' // CVR usually associated with Ad clicks
        },
        compute: (m) => {
            if (!m.clicks || m.clicks <= 0) return null
            return m.conversions / m.clicks
        }
    },
    CTR: {
        name: 'CTR',
        requires: ['clicks', 'impressions'],
        validate: (ctx) => ctx.source === 'ads',
        compute: (m) => {
            if (!m.impressions || m.impressions <= 0) return null
            return m.clicks / m.impressions
        }
    },
    AOV: {
        name: 'AOV',
        requires: ['revenue', 'orders'],
        validate: (ctx) => true, // Average Order Value valid for both Ads and Organic
        compute: (m) => {
            if (!m.orders || m.orders <= 0) return null
            return m.revenue / m.orders
        }
    }
}

export class MetricsEngine {

    canCompute(kpiName: string, metrics: Record<string, number>, ctx: MetricContext, granularity: Granularity): boolean {
        const kpi = KPI_REGISTRY[kpiName]
        if (!kpi) return false

        // 1. Check Preconditions
        if (!kpi.validate(ctx, granularity)) return false

        // 2. Check Data Availability
        const hasRequired = kpi.requires.every(req => {
            const val = metrics[req]
            return val !== undefined && val !== null
        })
        if (!hasRequired) return false

        return true
    }

    computeKPI(kpiName: string, metrics: Record<string, number>, ctx: MetricContext, granularity: Granularity): number | null {
        if (!this.canCompute(kpiName, metrics, ctx, granularity)) {
            return null
        }

        const val = KPI_REGISTRY[kpiName].compute(metrics)
        // Final Output Safety
        if (val === null || !isFinite(val) || isNaN(val)) return null

        return val
    }
}
