import { readCsvHeaders, readXlsxHeaders } from "@/lib/ingestion/readers"

export type FileContextGuess = {
    platform: 'SHOPEE' | 'LAZADA' | 'TIKTOK' | 'UNKNOWN'
    platform_confidence: number

    report_type: 'ADS' | 'OVERVIEW' | 'UNKNOWN'
    report_type_confidence: number

    granularity:
    | 'AGGREGATE_PERIOD'
    | 'DAILY'
    | 'SKU'
    | 'CAMPAIGN'
    | 'CREATIVE'
    | 'UNKNOWN'
    granularity_confidence: number

    signals: string[]
}

type ObservationSurface = {
    headers: string[]
    columnCount: number
    hasDateLikeColumn: boolean
    hasSpendLikeColumn: boolean
    hasCampaignLikeColumn: boolean
    languageHint: 'ID' | 'EN' | 'MIXED'
}

const PLATFORM_SIGNALS = {
    SHOPEE: ['order sn', 'no. pesanan', 'produk', 'pesanan dibatalkan', 'shopee'],
    TIKTOK: ['ad group', 'video id', 'roi', 'conversion rate', 'tiktok'],
    LAZADA: ['lazada', 'toko', 'imbal hasil', 'pendapatan', 'roi toko', 'seller sku']
}

export async function detectFileContext(filePath: string, fileType: 'CSV' | 'XLSX'): Promise<FileContextGuess> {
    let rawHeaders: string[] = []

    try {
        if (fileType === 'CSV') {
            rawHeaders = await readCsvHeaders(filePath)
        } else {
            rawHeaders = await readXlsxHeaders(filePath)
        }

        if (!rawHeaders || rawHeaders.length === 0) {
            return createUnknownGuess(['No headers found'])
        }

        // 1. Construct Observation Surface
        const obs = createObservationSurface(rawHeaders)

        // 2. Platform Detection
        const { platform, platform_confidence, platform_signals } = detectPlatform(obs)

        // 3. Report Type Detection
        const { report_type, report_type_confidence, report_signals } = detectReportType(obs)

        // 4. Granularity Detection
        const { granularity, granularity_confidence, granularity_signals } = detectGranularity(obs)

        const allSignals = [
            `Headers found: ${obs.headers.length}`,
            ...platform_signals,
            ...report_signals,
            ...granularity_signals
        ]

        return {
            platform,
            platform_confidence,
            report_type,
            report_type_confidence,
            granularity,
            granularity_confidence,
            signals: allSignals
        }

    } catch (error: any) {
        return createUnknownGuess([`Error: ${error.message}`])
    }
}

function createObservationSurface(rawHeaders: string[]): ObservationSurface {
    const normalized = rawHeaders.map(h => String(h).toLowerCase().trim())

    const hasDate = normalized.some(h =>
        h.includes('date') || h.includes('tanggal') || h.includes('day') || h.includes('waktu') || h.includes('time')
    )

    const hasSpend = normalized.some(h =>
        h.includes('spend') || h.includes('cost') || h.includes('budget') || h.includes('biaya')
    )

    const hasCampaign = normalized.some(h =>
        h.includes('campaign') || h.includes('ad group') || h.includes('kampanye')
    )

    // Simple language heuristic
    const idKeywords = ['pesanan', 'tanggal', 'biaya', 'produk']
    const enKeywords = ['order', 'date', 'cost', 'product']

    let idCount = 0
    let enCount = 0

    normalized.forEach(h => {
        if (idKeywords.some(k => h.includes(k))) idCount++
        if (enKeywords.some(k => h.includes(k))) enCount++
    })

    let languageHint: 'ID' | 'EN' | 'MIXED' = 'MIXED'
    if (idCount > enCount && idCount > 0) languageHint = 'ID'
    if (enCount > idCount && enCount > 0) languageHint = 'EN'

    return {
        headers: normalized,
        columnCount: normalized.length,
        hasDateLikeColumn: hasDate,
        hasSpendLikeColumn: hasSpend,
        hasCampaignLikeColumn: hasCampaign,
        languageHint
    }
}

function detectPlatform(obs: ObservationSurface) {
    let highestScore = 0
    let detected: FileContextGuess['platform'] = 'UNKNOWN'
    const signals: string[] = []

    for (const [key, keywords] of Object.entries(PLATFORM_SIGNALS)) {
        let score = 0
        keywords.forEach(k => {
            if (obs.headers.some(h => h.includes(k))) {
                score += 1
            }
        })

        if (score > 0) {
            signals.push(`Platform signal ${key}: ${score} matches`)
        }

        if (score > highestScore) {
            highestScore = score
            detected = key as FileContextGuess['platform']
        }
    }

    // Confidence calc
    // If we have > 2 matches, we are pretty confident. 
    // 1 match is low confidence (0.5). 2 matches is 0.8. 3+ is 0.95.
    let confidence = 0
    if (highestScore === 0) confidence = 0
    else if (highestScore === 1) confidence = 0.5
    else if (highestScore === 2) confidence = 0.8
    else confidence = 0.95

    return { platform: detected, platform_confidence: confidence, platform_signals: signals }
}

function detectReportType(obs: ObservationSurface) {
    const signals: string[] = []
    let type: FileContextGuess['report_type'] = 'OVERVIEW'
    let confidence = 0.5

    if (obs.hasSpendLikeColumn) {
        type = 'ADS'
        confidence = 0.9
        signals.push('Strong Signal: Spend/Cost column detected -> ADS')
    } else if (obs.hasCampaignLikeColumn) {
        type = 'ADS'
        confidence = 0.6
        signals.push('Weak Signal: Campaign column detected -> ADS')
    } else {
        type = 'OVERVIEW'
        confidence = 0.8
        signals.push('Default Signal: No Ad columns -> OVERVIEW')
    }

    return { report_type: type, report_type_confidence: confidence, report_signals: signals }
}

function detectGranularity(obs: ObservationSurface) {
    const signals: string[] = []
    let granularity: FileContextGuess['granularity'] = 'AGGREGATE_PERIOD'
    let confidence = 0.6

    const headers = obs.headers

    // Priority 1: CREATIVE
    if (headers.some(h => h.includes('creative_id') || h.includes('video_id') || h.includes('iklan'))) {
        granularity = 'CREATIVE'
        confidence = 0.9
        signals.push('Priority Signal: Creative/Video columns detected -> CREATIVE')
    }
    // Priority 2: CAMPAIGN
    else if (headers.some(h => h.includes('campaign_id') || h.includes('ad_group') || h.includes('kampanye'))) {
        granularity = 'CAMPAIGN'
        confidence = 0.85
        signals.push('Priority Signal: Campaign/Ad Group columns detected -> CAMPAIGN')
    }
    // Priority 3: SKU
    else if (headers.some(h => h.includes('sku') || h.includes('product_id') || h.includes('nomor_referensi_sku'))) {
        granularity = 'SKU'
        confidence = 0.85
        signals.push('Priority Signal: SKU/Product ID columns detected -> SKU')
    }
    // Priority 4: DAILY
    else if (obs.hasDateLikeColumn) {
        granularity = 'DAILY'
        confidence = 0.75
        signals.push('Signal: Date column detected -> DAILY')
    }
    // Fallback: AGGREGATE
    else {
        granularity = 'AGGREGATE_PERIOD'
        confidence = 0.6
        signals.push('Default: No granular keys found -> AGGREGATE_PERIOD')
    }

    // Advanced Refinement for low confidence
    if (confidence < 0.7) {
        // Mixed SKU + date -> SKU
        const hasSku = headers.some(h => h.includes('sku'))
        if (hasSku && obs.hasDateLikeColumn) {
            granularity = 'SKU'
            confidence = 0.75
            signals.push('Advanced Refinement: Mixed SKU + Date detected -> SKU')
        }

        // Campaign + spend + no date -> CAMPAIGN (mapping AGGREGATE_CAMPAIGN)
        const hasCampaign = headers.some(h => h.includes('campaign'))
        if (hasCampaign && obs.hasSpendLikeColumn && !obs.hasDateLikeColumn) {
            granularity = 'CAMPAIGN'
            confidence = 0.75
            signals.push('Advanced Refinement: Campaign + Spend + No Date -> CAMPAIGN')
        }
    }

    return { granularity, granularity_confidence: confidence, granularity_signals: signals }
}

function createUnknownGuess(signals: string[] = []): FileContextGuess {
    return {
        platform: 'UNKNOWN',
        platform_confidence: 0,
        report_type: 'UNKNOWN',
        report_type_confidence: 0,
        granularity: 'UNKNOWN',
        granularity_confidence: 0,
        signals
    }
}


