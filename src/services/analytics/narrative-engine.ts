import { NarrativeInput, NarrativeOutput } from "./narrative-types"

/**
 * NarrativeEngine — Pure String Renderer
 *
 * This module is a FORMATTER, not a thinker.
 *
 * It MUST NOT:
 *   - import Prisma
 *   - import snapshots or dashboard services
 *   - use reduce, map, or filter for math
 *   - compute deltas, sums, or percentages
 *   - compare channels numerically
 *   - infer missing fields
 *
 * It ONLY:
 *   - reads fields from NarrativeInput
 *   - composes Bahasa Indonesia sentences
 *   - applies conditional phrasing based on confidence and field presence
 */
export function generateNarrative(data: NarrativeInput): NarrativeOutput {
    return {
        locale: 'id-ID',
        period: data.period,
        executive_summary: buildExecutiveSummary(data),
        insight_details: buildInsightDetails(data.insights),
        data_confidence_note: buildConfidenceNote(data.executive.confidence)
    }
}

// ─── Executive Summary ───────────────────────────────────────────

function buildExecutiveSummary(data: NarrativeInput): string {
    const { executive, channels, insights } = data
    const lines: string[] = []

    // Period
    lines.push(`Periode: ${data.period}.`)

    // Current values
    lines.push(
        `Total pendapatan tercatat sebesar ${fmtCurrency(executive.revenue)}`
        + ` dengan total belanja iklan ${fmtCurrency(executive.spend)}`
        + ` dan ${executive.orders.toLocaleString('id-ID')} pesanan.`
    )

    // ROAS (only if present)
    if (executive.roas !== null) {
        lines.push(`ROAS blended: ${executive.roas.toFixed(2)}.`)
    }

    // Period comparison — direction only, no percentage computation
    if (executive.previous) {
        if (executive.revenue > executive.previous.revenue) {
            lines.push(`Pendapatan naik dibanding periode sebelumnya.`)
        } else if (executive.revenue < executive.previous.revenue) {
            lines.push(`Pendapatan turun dibanding periode sebelumnya.`)
        } else {
            lines.push(`Pendapatan relatif stabil dibanding periode sebelumnya.`)
        }

        if (executive.spend > executive.previous.spend) {
            lines.push(`Belanja iklan naik dibanding periode sebelumnya.`)
        } else if (executive.spend < executive.previous.spend) {
            lines.push(`Belanja iklan turun dibanding periode sebelumnya.`)
        }
    }

    // Channel listing — no sorting, no numeric comparison
    if (channels.length > 0) {
        const names = channels.map(c => c.platform).join(', ')
        lines.push(`Channel aktif: ${names}.`)
    }

    // Top insight pointer — only if present
    if (insights.length > 0) {
        const top = insights[0]
        lines.push(`Faktor utama yang teridentifikasi: ${translateCause(top.likely_cause, top.confidence)}.`)
    } else {
        lines.push(`Tidak ditemukan anomali signifikan pada periode ini.`)
    }

    return lines.join(' ')
}

// ─── Insight Details ─────────────────────────────────────────────

function buildInsightDetails(
    insights: NarrativeInput['insights']
): string[] {
    if (insights.length === 0) {
        return ['Periode ini menunjukkan stabilitas. Tidak ada perubahan signifikan yang terdeteksi.']
    }

    return insights.map((insight, idx) => {
        const parts: string[] = []
        const typeLabel = translateType(insight.insight_type)
        const dir = translateDirection(insight.change.direction)

        parts.push(`${idx + 1}. [${typeLabel}] ${insight.metric.toUpperCase()} ${dir}.`)

        // Percentage — ONLY if provided in input
        if (insight.change.percentage !== null) {
            parts.push(`Perubahan: ${formatPct(insight.change.percentage)}.`)
        }

        // Cause — confidence-aware phrasing
        parts.push(translateCause(insight.likely_cause, insight.confidence) + '.')

        // Recommendation — only if present
        if (insight.recommended_action) {
            parts.push(`Rekomendasi: ${translateAction(insight.recommended_action)}.`)
        }

        return parts.join(' ')
    })
}

// ─── Confidence Note ─────────────────────────────────────────────

function buildConfidenceNote(
    confidence: 'HIGH' | 'MEDIUM' | 'LOW'
): string | undefined {
    if (confidence === 'HIGH') return undefined

    if (confidence === 'MEDIUM') {
        return (
            'Catatan: Sebagian data pada periode ini memiliki tingkat kepercayaan sedang. '
            + 'Beberapa metrik mungkin belum sepenuhnya terverifikasi. '
            + 'Perlu dicermati lebih lanjut sebelum mengambil keputusan besar.'
        )
    }

    return (
        'Peringatan: Data pada periode ini memiliki tingkat kepercayaan rendah. '
        + 'Sumber data mungkin tidak lengkap atau ambigu. '
        + 'Belum dapat disimpulkan dengan tingkat kepercayaan tinggi. '
        + 'Disarankan untuk memverifikasi langsung dari platform terkait sebelum mengambil tindakan.'
    )
}

// ─── Translation Helpers (String Only) ───────────────────────────

function translateType(type: string): string {
    const map: Record<string, string> = {
        'performance': 'Performa',
        'efficiency': 'Efisiensi',
        'risk': 'Risiko',
        'opportunity': 'Peluang'
    }
    return map[type] || type
}

function translateDirection(dir: string): string {
    const map: Record<string, string> = {
        'up': 'mengalami kenaikan',
        'down': 'mengalami penurunan',
        'flat': 'relatif stabil'
    }
    return map[dir] || dir
}

function translateCause(cause: string, confidence: string): string {
    const causeMap: Record<string, string> = {
        'Increased spend on low-efficiency channels or campaigns':
            'peningkatan belanja pada channel atau kampanye dengan efisiensi rendah',
        'Lower demand or traffic volume (ROAS remained stable)':
            'penurunan permintaan atau volume trafik, sementara efisiensi tetap stabil',
        'High efficiency with potential for scaling':
            'efisiensi tinggi dengan potensi untuk ditingkatkan skalanya',
    }

    // Resolve translation
    let translated = cause
    for (const [eng, ind] of Object.entries(causeMap)) {
        if (cause.includes(eng)) {
            const extra = cause.replace(eng, '').trim()
            translated = extra ? `${ind} (${extra})` : ind
            break
        }
    }

    // Channel regression pattern
    if (cause.startsWith('Performance regression isolated primarily to')) {
        const platform = cause.replace('Performance regression isolated primarily to ', '')
        translated = `regresi performa yang terisolasi pada ${platform}`
    }

    // Confidence-aware phrasing wrapper
    if (confidence === 'high') {
        return `Penyebab: ${translated}`
    } else if (confidence === 'medium') {
        return `Kemungkinan besar dipengaruhi oleh: ${translated}`
    } else {
        return `Menunjukkan indikasi: ${translated}. Namun, belum dapat disimpulkan dengan tingkat kepercayaan tinggi`
    }
}

function translateAction(action: string): string {
    const actionMap: Record<string, string> = {
        'Audit recent campaign scaling or broad targeting changes.':
            'Tinjau perubahan skalasi kampanye atau perubahan targeting yang terlalu luas',
        'Check inventory availability or seasonal demand trends.':
            'Periksa ketersediaan stok atau tren permintaan musiman',
        'Consider increasing budget on top-performing campaigns.':
            'Pertimbangkan untuk meningkatkan anggaran pada kampanye dengan performa terbaik',
    }

    for (const [eng, ind] of Object.entries(actionMap)) {
        if (action.includes(eng)) return ind
    }

    if (action.startsWith('Deep dive into')) {
        const platform = action.replace('Deep dive into ', '').replace(' campaign performance.', '')
        return `Lakukan analisis mendalam pada performa kampanye ${platform}`
    }

    return action
}

function fmtCurrency(val: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(val)
}

function formatPct(val: number): string {
    return `${(val * 100).toFixed(1)}%`
}
