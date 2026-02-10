import { cn } from "@/lib/utils"
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react"

type ConfidenceLevel = 'high' | 'medium' | 'low' | 'HIGH' | 'MEDIUM' | 'LOW'

interface ConfidenceBadgeProps {
    level: ConfidenceLevel
    className?: string
    showLabel?: boolean
}

export function ConfidenceBadge({ level, className, showLabel = true }: ConfidenceBadgeProps) {
    const normalizedLevel = level.toLowerCase() as 'high' | 'medium' | 'low'

    const config = {
        high: {
            icon: ShieldCheck,
            color: "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30",
            label: "High Confidence"
        },
        medium: {
            icon: ShieldAlert,
            color: "text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30",
            label: "Medium Confidence"
        },
        low: {
            icon: ShieldX,
            color: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30",
            label: "Low Confidence"
        }
    }

    const { icon: Icon, color, label } = config[normalizedLevel] || config.low

    return (
        <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-transparent", color, className)} title={label}>
            <Icon className="w-3 h-3" />
            {showLabel && <span>{normalizedLevel.toUpperCase()}</span>}
        </div>
    )
}
