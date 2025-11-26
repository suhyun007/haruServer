import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const SUPPORTED_LANGS = new Set(['kr', 'jp', 'zh', 'us', 'au', 'ca', 'fr'])
const DATA_DIR = path.join(process.cwd(), 'data', 'foodData')

export async function GET(
  _request: NextRequest,
  context: { params: { lang: string } }
) {
  let lang = context.params.lang?.toLowerCase()

  if (lang === 'en') {
    lang = 'us'
  }

  if (!lang || !SUPPORTED_LANGS.has(lang)) {
    return NextResponse.json(
      { error: 'Unsupported language' },
      { status: 400 }
    )
  }

  const filePath = path.join(DATA_DIR, `foods_${lang}.sqlite`)

  try {
    const stats = await fs.stat(filePath)
    return NextResponse.json({
      exists: true,
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      modifiedTimestamp: stats.mtime.getTime(),
    })
  } catch (error) {
    return NextResponse.json(
      { exists: false, error: 'File not found' },
      { status: 404 }
    )
  }
}

