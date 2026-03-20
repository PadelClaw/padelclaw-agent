import { NextResponse } from 'next/server'
import packageJson from '@/package.json'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION ?? packageJson.version,
  })
}
