import { authOptions } from "@/lib/auth"
import { detectFileContext } from "@/services/ingestion/heuristics"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!(session?.user as any)?.id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Get user workspace (Assuming first workspace for MVP)
    const sessionId = (session?.user as any)?.id
    const user = await prisma.user.findUnique({
        where: { id: sessionId },
        include: { workspaces: true }
    })

    const workspaceId = user?.workspaces[0]?.workspaceId

    if (!workspaceId) {
        return NextResponse.json({ message: "No workspace found" }, { status: 400 })
    }

    const formData = await req.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
        return NextResponse.json({ message: "No files provided" }, { status: 400 })
    }

    const uploadResults = []

    // Ensure storage directory exists
    const dateStr = new Date().toISOString().split('T')[0]
    const uploadDir = join(process.cwd(), "storage", "raw", workspaceId, dateStr)
    await mkdir(uploadDir, { recursive: true })

    for (const file of files) {
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Generate unique name or use original if safe? Use timestamp prefix
        const timestamp = Date.now()
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
        const fileName = `${timestamp}-${safeName}`
        const filePath = join(uploadDir, fileName)

        await writeFile(filePath, buffer)

        const fileType = file.name.endsWith('.csv') ? 'CSV' : 'XLSX'
        const context = await detectFileContext(filePath, fileType)

        // Create DB Record
        const uploadRecord = await prisma.upload.create({
            data: {
                workspaceId,
                originalName: file.name,
                storagePath: filePath,
                fileType,
                platform: context.platform,
                reportType: context.report_type,
                // Store full context for transparency & debugging
                ingestionContext: JSON.stringify(context),
                status: 'PENDING',
                rowCount: 0
            }
        })

        uploadResults.push(uploadRecord)
    }

    return NextResponse.json({ count: uploadResults.length, uploads: uploadResults })
}
