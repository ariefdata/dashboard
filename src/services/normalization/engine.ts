import { prisma } from "@/lib/prisma"
import { iterateCsvRows, iterateXlsxRows, readCsvHeaders, readXlsxHeaders } from "@/lib/ingestion/readers"
import { COLUMN_MAPPINGS } from "@/lib/normalization/mappings"
import { normalizeHeader, normalizeValue } from "@/lib/normalization/utils"
import { FileContextGuess } from "@/services/ingestion/heuristics"
import { SnapshotBuilder } from "@/services/analytics/snapshot-builder"
import { ValidationEngine, ValidationWarning, ValidationResult } from "@/services/ingestion/validation-engine"


type NormalizationSummary = {
    totalRows: number
    mappedMetrics: number
    suppressedMetrics: number
    avgConfidence: number
    validationResult?: ValidationResult
}

export class NormalizationEngine {

    async normalizeUpload(uploadId: string): Promise<NormalizationSummary> {
        const upload = await prisma.upload.findUnique({
            where: { id: uploadId },
            include: { workspace: true }
        })

        if (!upload) throw new Error("Upload not found")
        if (!upload.ingestionContext) throw new Error("Missing ingestion context")

        // Parse Context
        const context = JSON.parse(upload.ingestionContext) as FileContextGuess
        const { platform, report_type: reportType, granularity } = context

        if (platform === 'UNKNOWN' || reportType === 'UNKNOWN') {
            throw new Error("Cannot normalize unknown platform or report type")
        }

        // Get Mapping Rules
        const mappingRules = COLUMN_MAPPINGS[platform]?.[reportType]
        if (!mappingRules) {
            throw new Error(`No mapping rules found for ${platform} ${reportType}`)
        }

        // Setup Reader
        let rowIterator: AsyncGenerator<any[], void, unknown>
        let headers: string[] = []

        if (upload.fileType === 'CSV') {
            headers = await readCsvHeaders(upload.storagePath)
            rowIterator = iterateCsvRows(upload.storagePath)
        } else {
            headers = await readXlsxHeaders(upload.storagePath)
            rowIterator = iterateXlsxRows(upload.storagePath)
        }

        // Step 1: Header Normalization & Index Mapping
        const normalizedHeaders = headers.map(normalizeHeader)
        const headerIndexMap = new Map<string, number>()
        normalizedHeaders.forEach((h, i) => headerIndexMap.set(h, i))

        // Pre-calculate Column Mapping Indices
        // canonical_metric -> columnIndex
        const metricIndices = new Map<string, number>()

        for (const [canonical, possibleHeaders] of Object.entries(mappingRules)) {
            // Find best match
            for (const possible of possibleHeaders) {
                const normalizedPossible = normalizeHeader(possible)
                const index = headerIndexMap.get(normalizedPossible)
                if (index !== undefined) {
                    metricIndices.set(canonical, index)
                    break // First exact match wins
                }
            }
        }

        const dimensionIndices = new Map<string, number>()
        // Required dimensions based on Granularity
        // This part effectively acts as "Granularity Enforcement" for dimensions finding
        if (granularity === 'SKU') {
            // Look for SKU/Product ID columns
            const skuCandidates = ['sku', 'product_id', 'nomor_referensi_sku', 'seller_sku']
            // Determine later inside loop or pre-calc? Pre-calc safer.
            // We can extend mapping rules to include dimensions too, but for now heuristic find:
            // TODO: Add dimensions to Mappings Dictionary to be strict. 
            // For MVP, simple fuzzy search for dimensions:
            for (const cand of skuCandidates) {
                const idx = headerIndexMap.get(cand) || normalizedHeaders.findIndex(h => h.includes(cand))
                if (idx !== -1 && idx !== undefined) {
                    dimensionIndices.set('sku', idx)
                    break
                }
            }
        }
        // Date Column
        // Mappings should ideally have 'date' too.
        const dateCandidates = ['date', 'tanggal', 'waktu', 'time', 'day']
        let dateIndex = -1
        for (const cand of dateCandidates) {
            const idx = headerIndexMap.get(cand) || normalizedHeaders.findIndex(h => h.includes(cand))
            if (idx !== -1 && idx !== undefined) {
                dateIndex = idx
                break
            }
        }

        // Initialize Validation
        const validationEngine = new ValidationEngine()
        const allWarnings: ValidationWarning[] = []

        // Step 2: Temporal Check (Pre-loop on headers/first few rows if needed, but here we do it per-row or batch)
        // For simplicity in MVP, we track dates during processing.
        // Actually, ValidationEngine.checkTemporal currently expects all rows. 
        // Let's modify the loop to collect temporal data.
        const dateValues: any[] = []

        let totalRows = 0
        let mappedCount = 0
        let suppressedCount = 0

        const unifiedMetricsData: any[] = []

        // Batch processing size
        const BATCH_SIZE = 500

        for await (const row of rowIterator) {
            totalRows++

            // Granularity Enforcement: Date check
            // If DAILY, date is required.
            let rowDate: Date | null = new Date() // Default to now (upload time) if AGGREGATE? 
            // Or if DATE required, null -> skip/error

            if (dateIndex !== -1) {
                const rawDate = row[dateIndex]
                dateValues.push(rawDate)
                rowDate = normalizeValue(rawDate, true) as Date | null
            }

            if (granularity === 'DAILY' && !rowDate) {
                suppressedCount++ // Missing critical dimension
                continue
            }

            // If AGGREGATE and no date, user upload date or context date range?
            // Fallback to upload created date for now for AGGREGATE.
            if (!rowDate) rowDate = upload.createdAt

            // Extract Dimensions
            const dimensions: Record<string, any> = {}
            dimensionIndices.forEach((idx, key) => {
                dimensions[key] = row[idx]
            })

            // Extract Metrics
            const metrics: Record<string, number> = {}
            metricIndices.forEach((idx, key) => {
                const raw = row[idx]
                const val = normalizeValue(raw)
                if (val !== null && typeof val === 'number') {
                    metrics[key] = val
                    mappedCount++
                }
            })

            // Per-row Schema Validation
            const rowWarnings = validationEngine.checkSchema(metrics, dimensions, granularity)
            allWarnings.push(...rowWarnings)

            if (Object.keys(metrics).length === 0) {
                suppressedCount++ // Empty row?
                continue
            }

            // Construct UnifiedMetric Payload
            // metricContext
            let rowConfidence = context.report_type_confidence > 0.8 ? 'high' : 'medium'
            if (rowWarnings.some(w => w.severity === 'HIGH')) rowConfidence = 'low'
            else if (rowWarnings.some(w => w.severity === 'MEDIUM')) rowConfidence = 'medium'

            const metricContext = {
                source: reportType === 'ADS' ? 'ads' : 'blended',
                report_type: reportType.toLowerCase(),
                confidence: rowConfidence
            }

            unifiedMetricsData.push({
                workspaceId: upload.workspaceId,
                uploadId: upload.id,
                date: rowDate,
                platform,
                granularity,
                metricContext: JSON.stringify(metricContext),
                metrics: JSON.stringify(metrics),
                dimensions: JSON.stringify(dimensions)
            })

            if (unifiedMetricsData.length >= BATCH_SIZE) {
                await prisma.unifiedMetric.createMany({
                    data: unifiedMetricsData
                })
                unifiedMetricsData.length = 0
            }
        }

        // Flush remaining
        if (unifiedMetricsData.length > 0) {
            await prisma.unifiedMetric.createMany({
                data: unifiedMetricsData
            })
        }

        // Step 3: Finalize Validation
        // Check temporal consistency on gathered dates (MVP: only if daily)
        const temporalWarnings = validationEngine.checkTemporal(granularity, dateValues.map(d => [d]), 0)
        allWarnings.push(...temporalWarnings)

        const validationResult = ValidationEngine.createResult(allWarnings)

        // Update Upload Status & Validation Result
        await prisma.upload.update({
            where: { id: uploadId },
            data: {
                status: validationResult.is_valid ? 'PROCESSED' : 'PROCESSED', // Still processed but flagged
                validationResult: JSON.stringify(validationResult),
                rowCount: totalRows,
                processedAt: new Date()
            }
        })

        // Trigger Snapshot Rebuild (Async or Await? Await for now to ensure consistency)
        try {
            const builder = new SnapshotBuilder()
            // Optimization: Only rebuild for range of dates in upload?
            // For MVP: Rebuild all found dates? 
            // The builder handles "find relevant dates" if no date passed, but we pass undefined here which means "All for workspace" or "re-query".
            // Ideally we pass the dates we just touched. But for MVP safety:
            await builder.buildSnapshotsForWorkspace(upload.workspaceId)
        } catch (e) {
            console.error("Auto-snapshot failed", e)
            // Non-blocking error?
        }

        return {
            totalRows,
            mappedMetrics: mappedCount,
            suppressedMetrics: suppressedCount,
            avgConfidence: context.report_type_confidence, // Simplified
            validationResult
        }
    }
}
