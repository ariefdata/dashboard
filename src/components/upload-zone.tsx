"use client"

import { useState } from "react"

export default function UploadZone() {
    const [loading, setLoading] = useState(false)

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files?.length) return

        const formData = new FormData()
        Array.from(e.target.files).forEach(file => {
            formData.append("files", file)
        })

        setLoading(true)

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            if (!res.ok) throw new Error("Upload failed")

            const data = await res.json()

            // Sequential trigger for Normalization (Required for pipeline)
            for (const record of data.uploads) {
                await fetch('/api/ingest/normalize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uploadId: record.id })
                })
            }

            alert("Upload selesai. Cek hasil di dashboard.")
        } catch (err) {
            console.error(err)
            alert("Upload gagal. Silakan coba lagi.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="border border-dashed rounded-lg p-6 bg-card">
            <p className="mb-2 font-medium">Upload File Marketplace</p>
            <input
                type="file"
                multiple
                className="text-sm text-slate-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-violet-50 file:text-violet-700
          hover:file:bg-violet-100 cursor-pointer"
                accept=".csv,.xlsx,.xls"
                onChange={handleUpload}
            />
            {loading && <p className="text-sm mt-3 animate-pulse text-violet-600 font-medium">Memproses data... Mohon tunggu.</p>}
        </div>
    )
}
