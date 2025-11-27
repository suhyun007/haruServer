import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const SUPPORTED_LANGS = new Set(['kr', 'jp', 'zh', 'us', 'au', 'ca', 'fr'])

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

  const storageLang = lang === 'us' ? 'en' : lang
  const folderPath = `chunks/${storageLang}`

  try {
    // 모든 버킷 목록
    const { data: buckets } = await supabase.storage.listBuckets()
    
    // 루트 폴더 확인
    const { data: rootFiles } = await supabase.storage
      .from('food-json')
      .list('', { limit: 100 })
    
    // chunks 폴더 확인
    const { data: chunksFolder } = await supabase.storage
      .from('food-json')
      .list('chunks', { limit: 100 })
    
    // lang 폴더 확인
    const { data: langFolder } = await supabase.storage
      .from('food-json')
      .list(storageLang, { limit: 100 })
    
    // chunks/lang 폴더 확인
    const { data: chunksLangFolder, error: listError } = await supabase.storage
      .from('food-json')
      .list(folderPath, { limit: 100 })

    return NextResponse.json({
      lang,
      storageLang,
      folderPath,
      buckets: buckets?.map(b => ({ name: b.name, public: b.public })) || [],
      rootFiles: rootFiles?.map(f => ({ name: f.name, size: f.metadata?.size })) || [],
      chunksFolder: chunksFolder?.map(f => ({ name: f.name, size: f.metadata?.size })) || [],
      langFolder: langFolder?.map(f => ({ name: f.name, size: f.metadata?.size })) || [],
      chunksLangFolder: chunksLangFolder?.map(f => ({ 
        name: f.name, 
        size: f.metadata?.size,
        updatedAt: f.updated_at,
        createdAt: f.created_at,
      })) || [],
      listError: listError ? {
        message: listError.message,
        statusCode: listError.statusCode,
      } : null,
    }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to list files',
      details: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}

