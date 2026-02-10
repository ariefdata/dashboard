
export type ValidationWarning = {
    code: string
    message: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
}

export type ValidationResult = {
    is_valid: boolean
    warnings: ValidationWarning[]
}

export class ValidationEngine {

    /**
     * Temporal Consistency Checks
     */
    checkTemporal(
        granularity: string,
        rows: any[],
        dateIndex: number
    ): ValidationWarning[] {
        const warnings: ValidationWarning[] = []
        const seenDates = new Set<string>()
        let missingDates = 0

        rows.forEach(row => {
            const rawDate = row[dateIndex]
            if (!rawDate) {
                missingDates++
                return
            }

            const dateStr = String(rawDate).trim()
            if (seenDates.has(dateStr)) {
                if (granularity === 'DAILY') {
                    // Daily granularity shouldn't have duplicate dates unless it's segmented by another dimension
                    // We flag it as MEDIUM because it might be valid if segmented, but risky.
                    if (!warnings.some(w => w.code === 'DUP_DATE')) {
                        warnings.push({
                            code: 'DUP_DATE',
                            message: "Duplicate date rows detected in DAILY granularity.",
                            severity: 'MEDIUM'
                        })
                    }
                }
            }
            seenDates.add(dateStr)
        })

        if (missingDates > 0 && granularity === 'DAILY') {
            warnings.push({
                code: 'MISSING_DATE',
                message: `${missingDates} rows are missing dates in a DAILY report.`,
                severity: 'HIGH'
            })
        }

        return warnings
    }

    /**
     * Schema Consistency Checks
     */
    checkSchema(
        metrics: Record<string, number>,
        dimensions: Record<string, any>,
        granularity: string
    ): ValidationWarning[] {
        const warnings: ValidationWarning[] = []

        if (Object.keys(metrics).length === 0) {
            warnings.push({
                code: 'EMPTY_METRICS',
                message: "Row contains no valid metrics after normalization.",
                severity: 'MEDIUM'
            })
        }

        if (granularity === 'SKU' && !dimensions.sku) {
            warnings.push({
                code: 'MISSING_SKU',
                message: "SKU granularity report row missing SKU dimension.",
                severity: 'MEDIUM'
            })
        }

        if (granularity === 'CAMPAIGN' && !dimensions.campaign_id && !dimensions.ad_group) {
            warnings.push({
                code: 'MISSING_CAMPAIGN_DIM',
                message: "CAMPAIGN granularity report row missing campaign dimension.",
                severity: 'MEDIUM'
            })
        }

        return warnings
    }

    /**
     * Aggregate Result
     */
    static createResult(warnings: ValidationWarning[]): ValidationResult {
        return {
            is_valid: !warnings.some(w => w.severity === 'HIGH'),
            warnings
        }
    }
}
