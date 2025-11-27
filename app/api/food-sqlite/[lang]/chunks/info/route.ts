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

  // 스토리지 경로 확인: 실제 파일은 루트에 있음
  // chunks_info.json은 루트에 있음
  const storageLang = lang === 'us' ? 'en' : lang
  const folderPath = `chunks/${storageLang}` // 폴더 경로 (있을 수도)
  const infoPathRoot = `chunks_info.json` // 루트 경로
  const infoPathInFolder = `${folderPath}/chunks_info.json` // 폴더 내 경로

  console.log('🔍 Looking for chunks_info.json:', {
    lang,
    storageLang,
    folderPath,
    infoPathRoot,
    infoPathInFolder,
    bucket: 'food-json',
  })

  try {
    // 먼저 루트 폴더 확인
    const { data: rootFiles } = await supabase.storage
      .from('food-json')
      .list('', { limit: 100 })
    console.log('📂 Root folder contents:', rootFiles?.map(f => f.name) || 'none')
    
    // chunks 폴더 확인
    const { data: chunksFolder } = await supabase.storage
      .from('food-json')
      .list('chunks', { limit: 100 })
    console.log('📁 chunks folder contents:', chunksFolder?.map(f => f.name) || 'none')
    
    // lang별 폴더 확인 (여러 가능성 시도)
    // 실제 파일 구조: chunks_info.json이 루트에 있음
    const possiblePaths = [
      infoPathRoot, // 루트: chunks_info.json (실제 위치!)
      infoPathInFolder, // chunks/en/chunks_info.json
      `${storageLang}/chunks_info.json`, // en/chunks_info.json
      `${storageLang}/chunks/chunks_info.json`, // en/chunks/chunks_info.json
    ]
    
    // 각 lang 폴더도 확인
    if (storageLang) {
      const { data: langFolder } = await supabase.storage
        .from('food-json')
        .list(storageLang, { limit: 100 })
      console.log(`📂 ${storageLang} folder contents:`, langFolder?.map(f => f.name) || 'none')
      
      const { data: chunksInLangFolder } = await supabase.storage
        .from('food-json')
        .list(`${storageLang}/chunks`, { limit: 100 })
      console.log(`📁 ${storageLang}/chunks folder contents:`, chunksInLangFolder?.map(f => f.name) || 'none')
    }

    // Supabase Storage에서 chunks_info.json 다운로드 (여러 경로 시도)
    // 실제 파일은 루트에 있으므로 루트 경로를 먼저 시도
    let infoFile: Blob | null = null
    let downloadError: any = null
    let actualPath = infoPathRoot
    
    // 경로 시도 순서 (en/ 폴더가 실제 위치이므로 먼저 시도)
    const pathsToTry = [
      `${storageLang}/chunks_info.json`, // en/chunks_info.json (실제 위치!)
      infoPathRoot, // 루트: chunks_info.json
      infoPathInFolder, // chunks/en/chunks_info.json
      `${storageLang}/chunks/chunks_info.json`, // en/chunks/chunks_info.json
    ]
    
    for (const path of pathsToTry) {
      console.log(`🔍 Trying path: ${path}`)
      const { data, error } = await supabase.storage
        .from('food-json')
        .download(path)
      
      if (!error && data) {
        infoFile = data
        actualPath = path
        console.log(`✅ Found chunks_info.json at: ${path}`)
        break
      } else {
        console.log(`   ❌ Not found at: ${path}, error: ${error?.message || 'unknown'}`)
      }
    }

    if (downloadError || !infoFile) {
      console.error('❌ Failed to download chunks_info.json from all paths')
      console.error('   Tried paths:', possiblePaths)
      console.error('   Bucket: food-json')
      
      // 버킷이 존재하는지 확인
      const { data: buckets } = await supabase.storage.listBuckets()
      console.log('📦 Available buckets:', buckets?.map(b => b.name) || 'none')
      
      return NextResponse.json(
        { error: 'Chunks info not found', exists: false },
        { status: 404 }
      )
    }

    // JSON 파일 파싱
    const arrayBuffer = await infoFile.arrayBuffer()
    const text = new TextDecoder('utf-8').decode(arrayBuffer)
    const info = JSON.parse(text)

    console.log('📋 chunks_info.json loaded:', {
      originalSize: info.originalSize,
      createdAt: info.createdAt,
      chunksCount: info.chunks?.length || 0,
    })

    // 각 청크 파일의 메타데이터 가져오기 (스토리지에서)
    // 실제 파일은 루트에 있으므로 루트에서 조회
    const chunksWithMeta = await Promise.all(
      info.chunks.map(async (chunk: any) => {
        const chunkFileName = `foods_${lang}_chunk${chunk.part}.part.gz`
        
        try {
          // 스토리지에서 파일 메타데이터 조회 (루트에서 찾기)
          const { data: fileInfoRoot } = await supabase.storage
            .from('food-json')
            .list('', {
              search: chunkFileName
            })
          
          // 폴더에서도 찾기 (혹시 모를 경우를 위해)
          const { data: fileInfoFolder } = await supabase.storage
            .from('food-json')
            .list(folderPath, {
              search: chunkFileName
            })

          const fileInfo = fileInfoRoot || fileInfoFolder
          if (fileInfo && fileInfo.length > 0) {
            const file = fileInfo[0]
            const updatedAt = file.updated_at || file.created_at
            return {
              ...chunk,
              modifiedTimestamp: updatedAt ? new Date(updatedAt).getTime() : null,
              modifiedAt: updatedAt || null,
            }
          }
          return chunk
        } catch (error) {
          console.error(`Error getting metadata for chunk ${chunk.part}:`, error)
          return chunk
        }
      })
    )

    const response = {
      exists: true,
      originalSize: info.originalSize,
      createdAt: info.createdAt,
      ...info,
      chunks: chunksWithMeta,
    }

    console.log('✅ Returning chunks info:', {
      exists: response.exists,
      originalSize: response.originalSize,
      createdAt: response.createdAt,
      chunksCount: response.chunks?.length || 0,
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ Error processing chunks info:', error)
    return NextResponse.json(
      { error: 'Chunks info not found', exists: false },
      { status: 404 }
    )
  }
}

