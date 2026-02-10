import { createReadStream } from 'fs'
import { parse } from 'csv-parse'
import { readFile } from 'fs/promises'
import { read, utils } from 'xlsx'

export async function readCsvHeaders(filePath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const parser = parse({ delimiter: ',', to: 1 })
        const stream = createReadStream(filePath)

        stream.pipe(parser)
            .on('data', (row: any) => {
                stream.destroy()
                resolve(row)
            })
            .on('error', (err) => {
                stream.destroy()
                reject(err)
            })
            .on('end', () => resolve([]))
    })
}

export async function readXlsxHeaders(filePath: string): Promise<string[]> {
    const buf = await readFile(filePath)
    const wb = read(buf, { type: 'buffer' })
    const sheetName = wb.SheetNames[0]
    const sheet = wb.Sheets[sheetName]
    const json = utils.sheet_to_json(sheet, { header: 1, range: 0 }) as any[][]
    return json[0] ? (json[0] as string[]) : []
}

// Iterator for processing rows memory-efficiently
export async function* iterateCsvRows(filePath: string): AsyncGenerator<string[], void, unknown> {
    const parser = parse({ delimiter: ',', from_line: 2 }) // Skip header
    const stream = createReadStream(filePath)
    const rowStream = stream.pipe(parser)

    for await (const row of rowStream) {
        yield row
    }
}

export async function* iterateXlsxRows(filePath: string): AsyncGenerator<any[], void, unknown> {
    const buf = await readFile(filePath)
    const wb = read(buf, { type: 'buffer' })
    const sheetName = wb.SheetNames[0]
    const sheet = wb.Sheets[sheetName]
    const rows = utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    // Skip header (index 0)
    for (let i = 1; i < rows.length; i++) {
        yield rows[i]
    }
}
