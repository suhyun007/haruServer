import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: dietMethods, error } = await supabase
      .from('haru_diet_methods')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json(dietMethods)
  } catch (error) {
    console.error('Error fetching diet methods:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
