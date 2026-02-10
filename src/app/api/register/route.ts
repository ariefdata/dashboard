import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { NextResponse } from "next/server"
import { z } from "zod"

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2),
    workspaceName: z.string().min(2)
})

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { email, password, name, workspaceName } = registerSchema.parse(body)

        const existingUser = await prisma.user.findUnique({
            where: { email }
        })

        if (existingUser) {
            return NextResponse.json({ user: null, message: "User already exists" }, { status: 409 })
        }

        const hashedPassword = await hash(password, 10)

        // Create User and Workspace Transactionally
        const result = await prisma.$transaction(async (tx: any) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name
                }
            })

            const workspace = await tx.workspace.create({
                data: {
                    name: workspaceName,
                    slug: workspaceName.toLowerCase().replace(/\s+/g, '-'),
                    members: {
                        create: {
                            userId: user.id,
                            role: 'OWNER'
                        }
                    }
                }
            })

            return { user, workspace }
        })

        return NextResponse.json({ user: result.user, message: "User created successfully" }, { status: 201 })
    } catch (error) {
        console.error(error)
        return NextResponse.json({ user: null, message: "Something went wrong" }, { status: 500 })
    }
}
