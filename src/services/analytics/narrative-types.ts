/**
 * Narrative DTO Types — Shared Contract
 *
 * These types define the ONLY interface between the upstream
 * data preparer and the downstream narrative renderer.
 *
 * No Prisma. No snapshots. No analytics imports.
 */

export type NarrativeInput = {
    period: string

    executive: {
        revenue: number
        spend: number
        orders: number
        roas: number | null
        confidence: 'HIGH' | 'MEDIUM' | 'LOW'

        previous?: {
            revenue: number
            spend: number
            orders: number
            roas: number | null
        }
    }

    channels: Array<{
        platform: 'SHOPEE' | 'LAZADA' | 'TIKTOK'
        revenue: number
        spend: number
        orders: number
        roas: number | null
    }>

    insights: Array<{
        insight_type: string
        metric: string
        change: {
            direction: 'up' | 'down' | 'flat'
            absolute: number
            percentage: number | null
        }
        likely_cause: string
        confidence: 'high' | 'medium' | 'low'
        recommended_action?: string
    }>
}

export type NarrativeOutput = {
    locale: 'id-ID'
    period: string
    executive_summary: string
    insight_details: string[]
    data_confidence_note?: string
}
