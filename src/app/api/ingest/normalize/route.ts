import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { NormalizationEngine } from "@/services/normalization/engine"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { uploadId } = await req.json()
        if (!uploadId) {
            return NextResponse.json({ message: "Upload ID required" }, { status: 400 })
        }

        const engine = new NormalizationEngine()
        const summary = await engine.normalizeUpload(uploadId)

        return NextResponse.json({ success: true, summary })
    } catch (error: any) {
        console.error("Normalization failed:", error)
        return NextResponse.json({ message: error.message || "Normalization failed" }, { status: 500 })
    }
}
