import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { createGunzip } from 'zlib'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

const SUPPORTED_LANGS = new Set(['kr', 'jp', 'zh', 'us', 'au', 'ca', 'fr'])
const DATA_DIR = path.join(process.cwd(), 'data', 'foodData')
const JSON_DIR = path.join(DATA_DIR, 'json')

// 메모리 캐시 (파싱된 JSON 데이터)
const cache = new Map<string, any[]>()

type FoodRecord = {
  id: string
  food_code: string | null
  name_kor: string
  name_eng: string | null
  name_jpn: string | null
  name_zho: string | null
  brand: string | null
  category: string | null
  serving_size: number | null
  serving_unit: string | null
  serving_size_label: string | null
  weight: number | null
  calories: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  sugar: number | null
  fiber: number | null
  sodium: number | null
  [key: string]: any
}

async function loadJsonData(lang: string): Promise<FoodRecord[]> {
  // 캐시 확인
  if (cache.has(lang)) {
    return cache.get(lang)!
  }

  const allRecords: FoodRecord[] = []

  // JSON 파일 찾기 (단일 파일 또는 여러 파트)
  const jsonFiles: string[] = []
  const files = await fs.readdir(JSON_DIR)
  
  // 해당 언어의 모든 파트 파일 찾기
  const langFiles = files.filter(f => 
    f.startsWith(`${lang}.json.gz`) || 
    f.startsWith(`${lang}_part`) && f.endsWith('.json.gz')
  ).sort()

  if (langFiles.length === 0) {
    throw new Error(`No JSON files found for language: ${lang}`)
  }

  console.log(`📦 Loading ${langFiles.length} part(s) for ${lang}...`)

  // 각 파트 파일 로드
  for (const fileName of langFiles) {
    const filePath = path.join(JSON_DIR, fileName)
    console.log(`   Loading ${fileName}...`)

    // gzip 해제 및 JSON 파싱
    const compressedData = await fs.readFile(filePath)
    const gunzip = createGunzip()
    const chunks: Buffer[] = []

    await pipeline(
      Readable.from(compressedData),
      gunzip,
      async function* (source) {
        for await (const chunk of source) {
          chunks.push(chunk)
        }
      }
    )

    const jsonData = Buffer.concat(chunks).toString('utf8')
    const records = JSON.parse(jsonData) as FoodRecord[]
    allRecords.push(...records)

    console.log(`   ✅ Loaded ${records.length.toLocaleString()} records from ${fileName}`)
  }

  console.log(`✅ Total ${allRecords.length.toLocaleString()} records loaded for ${lang}`)

  // 캐시에 저장
  cache.set(lang, allRecords)

  return allRecords
}

function searchFoods(
  records: FoodRecord[],
  query: string,
  lang: string,
  limit: number = 30,
  offset: number = 0
): FoodRecord[] {
  const trimmed = query.trim().toLowerCase()
  if (trimmed.length < 2) {
    return []
  }

  // 검색 필드 결정
  const nameField = lang === 'kr' ? 'name_kor' : 'name_eng'

  // 검색 수행
  const results: { record: FoodRecord; score: number }[] = []

  for (const record of records) {
    let score = 0
    const name = (record[nameField] || '').toLowerCase()
    const brand = (record.brand || '').toLowerCase()

    // 정확한 일치 (가장 높은 점수)
    if (name === trimmed) {
      score = 1000
    } else if (brand === trimmed) {
      score = 900
    }
    // 시작 부분 일치
    else if (name.startsWith(trimmed)) {
      score = 800
    } else if (brand.startsWith(trimmed)) {
      score = 700
    }
    // 포함
    else if (name.includes(trimmed)) {
      score = 600
    } else if (brand.includes(trimmed)) {
      score = 500
    }

    if (score > 0) {
      results.push({ record, score })
    }
  }

  // 점수순 정렬 (높은 점수 → 낮은 점수)
  results.sort((a, b) => b.score - a.score)

  // 칼로리 정보가 있는 항목 우선 정렬
  results.sort((a, b) => {
    if (a.record.calories && !b.record.calories) return -1
    if (!a.record.calories && b.record.calories) return 1
    return 0
  })

  // 페이지네이션
  const paginated = results.slice(offset, offset + limit)
  return paginated.map(r => r.record)
}

export async function GET(
  request: NextRequest,
  context: { params: { lang: string } }
) {
  try {
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

    // 쿼리 파라미터
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '30', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // JSON 데이터 로드 (캐시 사용)
    const records = await loadJsonData(lang)

    // 검색 수행
    const results = searchFoods(records, query, lang, limit, offset)

    return NextResponse.json({
      results,
      total: results.length,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error('Food search error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

