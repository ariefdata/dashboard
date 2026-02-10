export type MappingDictionary = {
    [platform: string]: {
        [reportType: string]: {
            [canonicalMetric: string]: string[]
        }
    }
}

export const COLUMN_MAPPINGS: MappingDictionary = {
    SHOPEE: {
        OVERVIEW: {
            orders: ['pesanan', 'total pesanan', 'orders', 'total orders'],
            revenue: ['total nilai pesanan', 'gmv', 'sales', 'total sales', 'pendapatan', 'omset'],
            visitors: ['pengunjung', 'visitors', 'total visitors'],
            views: ['halaman dilihat', 'page views', 'views']
        },
        ADS: {
            spend: ['biaya iklan', 'expense', 'cost', 'spend'],
            impressions: ['dilihat', 'impressions', 'impresi'],
            clicks: ['jumlah klik', 'clicks', 'klik'],
            conversions: ['pesanan', 'conversions', 'konversi', 'jumlah pesanan'],
            revenue: ['gmv', 'sales', 'omset', 'pendapatan', 'total nilai pesanan'],
            solds: ['produk terjual', 'items sold']
        }
    },
    LAZADA: {
        OVERVIEW: {
            revenue: ['revenue', 'total revenue', 'pendapatan'],
            orders: ['orders', 'items sold', 'pesanan'],
            visitors: ['visitors', 'unique visitors']
        },
        ADS: {
            spend: ['spend', 'cost', 'biaya'],
            impressions: ['impressions', 'impresi'],
            clicks: ['clicks', 'klik'],
            store_roi: ['store roi', 'roi toko'],
            revenue: ['revenue', 'pendapatan']
        }
    },
    TIKTOK: {
        OVERVIEW: {
            revenue: ['gmv', 'gross revenue'],
            orders: ['orders', 'total orders']
        },
        ADS: {
            spend: ['cost', 'spend', 'biaya'],
            impressions: ['impressions'],
            clicks: ['clicks'],
            conversions: ['conversions', 'konversi', 'results'],
            video_views: ['video views', 'play views']
        }
    }
}
