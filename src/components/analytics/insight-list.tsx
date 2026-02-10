"use client"

import { useEffect, useState } from "react"
import { DateRange } from "react-day-picker"
import { Insight } from "@/services/analytics/insight-engine"
import { ConfidenceBadge } from "./confidence-badge"
import { AlertTriangle, TrendingDown, TrendingUp, Lightbulb, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface InsightListProps {
    dateRange: DateRange | undefined
    workspaceId?: string // Optional if we want to override auto-resolution
}

export function InsightList({ dateRange, workspaceId }: InsightListProps) {
    const [insights, setInsights] = useState<Insight[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)

    useEffect(() => {
        if (!dateRange?.from || !dateRange?.to) return

        async function fetchInsights() {
            setLoading(true)
            setError(false)
            try {
                const params = new URLSearchParams()
                if (workspaceId) params.append('workspaceId', workspaceId)
                if (dateRange?.from) params.append('startDate', dateRange.from.toISOString())
                if (dateRange?.to) params.append('endDate', dateRange.to.toISOString())

                const res = await fetch(`/api/analytics/insights?${params.toString()}`)
                if (res.ok) {
                    const data = await res.json()
                    setInsights(data.insights)
                } else {
                    setError(true)
                }
            } catch (e) {
                setError(true)
            } finally {
                setLoading(false)
            }
        }

        fetchInsights()
    }, [dateRange, workspaceId])

    if (loading) return <div className="h-40 rounded-lg bg-muted/30 animate-pulse" />

    if (insights.length === 0 && !error) {
        return (
            <div className="h-40 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground text-sm">
                No significant performance anomalies detected for this period.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold tracking-tight">Diagnostic Insights</h3>
            <div className="grid gap-4">
                {insights.map((insight, idx) => (
                    <InsightCard key={idx} insight={insight} />
                ))}
            </div>
        </div>
    )
}

function InsightCard({ insight }: { insight: Insight }) {
    const typeConfig = {
        performance: { icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/10", title: "Performance Drop" },
        efficiency: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10", title: "Efficiency Issue" },
        risk: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10", title: "Risk Detected" },
        opportunity: { icon: Lightbulb, color: "text-blue-500", bg: "bg-blue-500/10", title: "Opportunity" },
    }

    const cfg = typeConfig[insight.insight_type] || typeConfig.performance
    const Icon = cfg.icon

    return (
        <Card className="overflow-hidden border-l-4" style={{ borderLeftColor: 'currentColor' }}>
            <div className="p-4 flex flex-col md:flex-row gap-4 items-start">
                <div className={`p-2 rounded-full ${cfg.bg} ${cfg.color} shrink-0`}>
                    <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm text-foreground">{cfg.title}: {insight.likely_cause}</h4>
                        <ConfidenceBadge level={insight.confidence} showLabel={false} />
                    </div>

                    <div className="text-sm text-muted-foreground">
                        <ul className="list-disc pl-4 space-y-1">
                            {insight.evidence.map((line, i) => (
                                <li key={i}>{line}</li>
                            ))}
                        </ul>
                    </div>

                    {insight.recommended_action && (
                        <div className="pt-2 flex items-start gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>Recommendation: {insight.recommended_action}</span>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    )
}
