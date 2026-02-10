import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
    log: ['info']
})

async function main() {
    console.log('Connecting...')
    await prisma.$connect()
    console.log('Connected successfully!')
    await prisma.$disconnect()
}

main().catch((e) => {
    console.error('Connection failed:', e)
    process.exit(1)
})
