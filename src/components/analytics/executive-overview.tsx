"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfidenceBadge } from "./confidence-badge"
import { ArrowDown, ArrowUp, Minus, AlertCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export type ExecutiveSnapshotData = {
    id: string
    date: string
    revenue: number
    spend: number
    orders: number
    roas: number | null
    confidence: string
}

interface ExecutiveOverviewProps {
    data: ExecutiveSnapshotData[]
    loading: boolean
}

export function ExecutiveOverview({ data, loading }: ExecutiveOverviewProps) {
    // Aggregate Data for the Period
    const aggregated = data.reduce((acc, curr) => ({
        revenue: acc.revenue + Number(curr.revenue),
        spend: acc.spend + Number(curr.spend),
        orders: acc.orders + curr.orders,
        // ROAS logic: Derived or Averaged? 
        // Correct aggregate ROAS = Total Revenue / Total Spend. 
        // We cannot average daily ROAS.
        // However, if we only have daily snapshots, we sum Rev/Spend first.
    }), { revenue: 0, spend: 0, orders: 0 })

    const aggRoas = aggregated.spend > 0 ? aggregated.revenue / aggregated.spend : null

    // Confidence aggregation: If ANY day is LOW, period is LOW. 
    let periodConfidence = 'high'
    if (data.some(d => d.confidence.toLowerCase() === 'low')) periodConfidence = 'low'
    else if (data.some(d => d.confidence.toLowerCase() === 'medium')) periodConfidence = 'medium'

    if (loading) {
        return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 rounded-lg bg-muted/50 animate-pulse" />)}
        </div>
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">Aggregated Performance</h3>
                <ConfidenceBadge level={periodConfidence as any} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Total Revenue"
                    value={formatCurrency(aggregated.revenue)}
                    subtext="Gross sales across all channels"
                />
                <MetricCard
                    title="Total Spend"
                    value={formatCurrency(aggregated.spend)}
                    subtext="Ad spend across all channels"
                />
                <MetricCard
                    title="Total Orders"
                    value={aggregated.orders.toLocaleString()}
                    subtext="Completed orders"
                />
                <MetricCard
                    title="Blended ROAS"
                    value={aggRoas ? `${aggRoas.toFixed(2)}x` : '—'}
                    subtext="Revenue / Spend"
                    warning={!aggRoas && aggregated.spend > 0 ? "Spend exists but Revenue is 0" : undefined}
                    missing={!aggRoas && aggregated.spend === 0}
                />
            </div>
        </div>
    )
}

function MetricCard({ title, value, subtext, warning, missing }: { title: string, value: string, subtext?: string, warning?: string, missing?: boolean }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    {title}
                </CardTitle>
                {warning && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                            </TooltipTrigger>
                            <TooltipContent>{warning}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${missing ? 'text-muted-foreground/50' : ''}`}>{value}</div>
                {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
            </CardContent>
        </Card>
    )
}

function formatCurrency(val: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val)
}
