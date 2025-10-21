import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabase
      .from('meal_records')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ message: 'Meal deleted successfully' })
  } catch (error) {
    console.error('Error deleting meal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
