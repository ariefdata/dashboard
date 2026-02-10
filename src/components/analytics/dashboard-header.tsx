"use client"

import { Button } from "@/components/ui/button"
import { CalendarDateRangePicker } from "@/components/date-range-picker"
import { RefreshCw } from "lucide-react"
import { DateRange } from "react-day-picker"
import { NarrativeModal } from "./narrative-modal"

interface DashboardHeaderProps {
    dateRange: DateRange | undefined
    setDateRange: (range: DateRange | undefined) => void
    onRefresh: () => void
    isRefreshing: boolean
}

export function DashboardHeader({ dateRange, setDateRange, onRefresh, isRefreshing }: DashboardHeaderProps) {
    return (
        <div className="flex items-center justify-between space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-primary-900 font-serif">Executive Dashboard</h2>
            <div className="flex items-center space-x-2">
                <CalendarDateRangePicker date={dateRange} setDate={setDateRange} />
                <Button variant="outline" size="icon" onClick={onRefresh} disabled={isRefreshing}>
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                </Button>
                <NarrativeModal dateRange={dateRange} />
                <Button>Download</Button>
            </div>
        </div>
    )
}
