export function normalizeHeader(header: string): string {
    if (!header) return ''
    return header
        .toLowerCase()
        .trim()
        .replace(/[\s\W_]+/g, '_') // Replace spaces and symbols with single underscore
        .replace(/^_+|_+$/g, '')   // Trim leading/trailing underscores
}

export function normalizeValue(value: any, isDate: boolean = false): number | Date | null {
    if (value === null || value === undefined || value === '') return null

    if (isDate) {
        // Simple date parsing wrapper - can expand with date-fns if needed
        const date = new Date(value)
        return isNaN(date.getTime()) ? null : date
    }

    if (typeof value === 'number') return value

    if (typeof value === 'string') {
        // Clean string: remove currency symbols, spaces
        // Handle decimals: 
        // ID: 1.000,00 -> 1000.00
        // EN: 1,000.00 -> 1000.00

        let clean = value.replace(/[^0-9,.-]/g, '')

        // Heuristic: Last separator is decimal?
        // If comma is the last separator and looks like decimal (ID locale or simple comma decimal)
        // Checks for pattern like 123.456,78

        if (clean.includes(',') && clean.includes('.')) {
            const lastDot = clean.lastIndexOf('.')
            const lastComma = clean.lastIndexOf(',')

            if (lastComma > lastDot) {
                // Likely ID/European: 1.234,56 -> replace dots with nothing, replace comma with dot
                clean = clean.replace(/\./g, '').replace(/,/g, '.')
            } else {
                // Likely EN: 1,234.56 -> replace commas with nothing
                clean = clean.replace(/,/g, '')
            }
        } else if (clean.includes(',')) {
            // Only commas? 1,234 (EN) or 1,23 (ID) ?
            // Ambiguous without more context, but usually:
            // If 3 decimals after comma, likely thousands separator? (1,000)
            // If 2 decimals, likely decimal separator? (10,99)
            // For safety in MVP, we might treat comma as decimal if no dots available and it looks like a decimal part?
            // OR, strict "replace all non-numeric-dot"?

            // Let's assume EN default for simple ambiguous cases unless detected otherwise OR standard JS parseFloat behavior
            // Actually, many Marketplace exports in Indonesia use ID format.
            // Safety: Replace comma with dot if it seems to be a decimal separator?
            // Better: If we see 1,000 -> 1000. If 1,5 -> 1.5
            clean = clean.replace(/,/g, '.')
        }

        const num = parseFloat(clean)
        return isNaN(num) ? null : num
    }

    return null
}
