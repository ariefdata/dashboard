"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { UploadCloud, X, CheckCircle2, AlertCircle } from "lucide-react"
import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"

type FileContextGuess = {
    platform: string
    platform_confidence: number
    report_type: string
    report_type_confidence: number
}

type UploadRecord = {
    id: string
    originalName: string
    status: string
    ingestionContext: string | null
}

export function UploadZone() {
    const [files, setFiles] = useState<File[]>([])
    const [uploading, setUploading] = useState(false)
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
    const [uploadedRecords, setUploadedRecords] = useState<UploadRecord[]>([])

    const onDrop = useCallback((acceptedFiles: File[]) => {
        setFiles(prev => [...prev, ...acceptedFiles])
        setStatus(null)
        setUploadedRecords([])
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        }
    })

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index))
    }

    const handleUpload = async () => {
        if (files.length === 0) return

        setUploading(true)
        setStatus(null)
        setUploadedRecords([])

        const formData = new FormData()
        files.forEach(file => {
            formData.append('files', file)
        })

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })

            if (!res.ok) throw new Error('Upload failed')

            const data = await res.json()
            setStatus({ type: 'success', message: `Uploaded ${data.count} files successfully.` })
            setUploadedRecords(data.uploads)
            setFiles([])

            // Trigger Normalization
            for (const record of data.uploads) {
                await fetch('/api/ingest/normalize', {
                    method: 'POST',
                    body: JSON.stringify({ uploadId: record.id })
                })
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Failed to upload files. Please try again.' })
        } finally {
            setUploading(false)
        }
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Ingest Market Data</CardTitle>
            </CardHeader>
            <CardContent>
                <div
                    {...getRootProps()}
                    className={cn(
                        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer",
                        isDragActive ? "border-primary bg-muted/50" : "border-muted-foreground/25 hover:border-primary/50"
                    )}
                >
                    <input {...getInputProps()} />
                    <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground text-center">
                        Drag & drop files here, or click to select files
                        <br />
                        <span className="text-xs">(CSV, Excel supported)</span>
                    </p>
                </div>

                {files.length > 0 && (
                    <div className="mt-6 space-y-2">
                        <h4 className="text-sm font-medium">Selected Files ({files.length})</h4>
                        <ul className="space-y-2">
                            {files.map((file, index) => (
                                <li key={index} className="flex items-center justify-between rounded-md border bg-card p-2 text-sm">
                                    <span className="truncate max-w-[300px]">{file.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                                        <Button variant="ghost" size="icon" onClick={() => removeFile(index)} className="h-6 w-6">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className="pt-4">
                            <Button onClick={handleUpload} disabled={uploading} className="w-full">
                                {uploading ? "Uploading..." : "Start Ingestion"}
                            </Button>
                        </div>
                    </div>
                )}

                {status && (
                    <div className={cn("mt-4 text-sm font-medium p-2 rounded flex items-center gap-2",
                        status.type === 'success' ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                    )}>
                        {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        {status.message}
                    </div>
                )}

                {uploadedRecords.length > 0 && (
                    <div className="mt-6 space-y-3">
                        <h4 className="text-sm font-medium border-b pb-2">Heuristic Detection Results</h4>
                        <ul className="space-y-3">
                            {uploadedRecords.map((record) => {
                                let context: FileContextGuess | null = null
                                try {
                                    context = record.ingestionContext ? JSON.parse(record.ingestionContext) : null
                                } catch (e) {
                                    console.error("Failed to parse context", e)
                                }

                                return (
                                    <li key={record.id} className="rounded-md border p-3 text-sm bg-muted/40">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-semibold">{record.originalName}</span>
                                            <span className="text-xs text-muted-foreground">{record.status}</span>
                                        </div>

                                        {context ? (
                                            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                                                <div className="flex flex-col">
                                                    <span className="text-muted-foreground">Detected Platform</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-medium">{context.platform}</span>
                                                        <span className={cn("px-1.5 py-0.5 rounded-full text-[10px]",
                                                            context.platform_confidence > 0.8 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                                                        )}>
                                                            {Math.round(context.platform_confidence * 100)}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-muted-foreground">Report Type</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-medium">{context.report_type}</span>
                                                        <span className={cn("px-1.5 py-0.5 rounded-full text-[10px]",
                                                            context.report_type_confidence > 0.8 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                                                        )}>
                                                            {Math.round(context.report_type_confidence * 100)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">No heuristic context available</span>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                )}

            </CardContent>
        </Card>
    )
}
