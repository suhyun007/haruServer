import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: dietMethods, error } = await supabase
      .from('haru_diet_methods')
      .select('id, name, description, short_description, name_en, name_ja, name_zh, description_en, description_ja, description_zh, short_description_en, short_description_ja, short_description_zh')
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json(dietMethods)
  } catch (error) {
    console.error('Error fetching diet methods:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
