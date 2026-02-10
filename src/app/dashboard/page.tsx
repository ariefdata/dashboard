
import UploadZone from "@/components/upload-zone"

export default function DashboardPage() {
    return (
        <div className="p-6 space-y-6">
            <h1 className="text-xl font-semibold">
                Wicara Mindworks Dashboard
            </h1>

            {/* ENTRY POINT KE PIPELINE */}
            <UploadZone />

            <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg bg-slate-50 opacity-50">
                    <h3 className="text-sm font-medium">Snapshots</h3>
                    <p className="text-xs text-muted-foreground mt-1 text-balance">Menunggu data di-ingest...</p>
                </div>
                <div className="p-4 border rounded-lg bg-slate-50 opacity-50">
                    <h3 className="text-sm font-medium">Insights</h3>
                    <p className="text-xs text-muted-foreground mt-1 text-balance">Analisis otomatis sedang dipersiapkan...</p>
                </div>
                <div className="p-4 border rounded-lg bg-slate-50 opacity-50">
                    <h3 className="text-sm font-medium">Narrative</h3>
                    <p className="text-xs text-muted-foreground mt-1 text-balance">Laporan naratif mingguan akan muncul di sini.</p>
                </div>
            </div>
        </div>
    )
}
