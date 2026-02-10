"use client"

import { useState } from "react"
import { DateRange } from "react-day-picker"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileText, Copy, Check } from "lucide-react"

interface NarrativeModalProps {
    dateRange: DateRange | undefined
    workspaceId?: string // Optional override
}

export function NarrativeModal({ dateRange, workspaceId }: NarrativeModalProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [narrative, setNarrative] = useState<string>("")
    const [copied, setCopied] = useState(false)

    const handleGenerate = async () => {
        if (!dateRange?.from || !dateRange?.to) return

        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (workspaceId) params.append('workspaceId', workspaceId)
            params.append('startDate', dateRange.from.toISOString())
            params.append('endDate', dateRange.to.toISOString())

            const res = await fetch(`/api/analytics/narrative?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setNarrative(data.narrative)
            }
        } catch (e) {
            console.error(e)
            setNarrative("Failed to generate report.")
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(narrative)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const onOpenChange = (isOpen: boolean) => {
        setOpen(isOpen)
        if (isOpen && !narrative) {
            handleGenerate()
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <FileText className="h-4 w-4" />
                    AI Report
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Executive Narrative</DialogTitle>
                    <DialogDescription>
                        AI-generated summary based on current snapshots and strict heuristics.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto border rounded-md p-4 bg-muted/30 text-sm font-mono whitespace-pre-wrap">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 animate-pulse text-muted-foreground">
                            Analyzing data & generating narrative...
                        </div>
                    ) : narrative}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
                    <Button onClick={handleCopy} disabled={!narrative || loading} className="gap-2">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? "Copied" : "Copy to Clipboard"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
