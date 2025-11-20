import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type FoodSearchResult = {
  id: string
  name: string
  brand?: string
  servingSize?: string
  servingQuantity?: number
  caloriesPerServing?: number
  caloriesPer100g?: number
  carbsPerServing?: number
  proteinPerServing?: number
  fatPerServing?: number
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const query = (searchParams.get('query') ?? searchParams.get('q') ?? '').trim()
  const limitParam = searchParams.get('limit') ?? searchParams.get('page_size') ?? '50'
  const limit = Math.min(Math.max(Number.parseInt(limitParam, 10) || 50, 1), 100)
  const offsetParam = searchParams.get('offset') ?? '0'
  const offset = Math.max(Number.parseInt(offsetParam, 10) || 0, 0)

  if (query.length < 2) {
    return NextResponse.json({ items: [], total: 0 })
  }

  try {
    const escapedQuery = query.replace(/'/g, "''")
    const selectColumns = [
      'id',
      'name_kor',
      'brand',
      'serving_size',
      'serving_unit',
      'calories',
      'carbs',
      'protein',
      'fat',
      `name_similarity:similarity(name_kor,'${escapedQuery}')`,
      `brand_similarity:similarity(brand,'${escapedQuery}')`,
    ].join(',')

    const { data, error } = await supabase.rpc('search_food_items', {
      q: query,
      p_limit: limit,
      p_offset: offset,
    })

    if (error) {
      console.error('❌ Supabase food_items search error:', error)
      return NextResponse.json(
        { error: 'Failed to search foods from database.', items: [], total: 0 },
        { status: 200 }
      )
    }

    const items: FoodSearchResult[] =
      (data ?? []).map((row: any) => {
        const servingSizeLabel =
          row.serving_size != null && row.serving_unit
            ? `${row.serving_size}${row.serving_unit}`
            : undefined

        return {
          id: row.id as string,
          name: (row.name_kor as string) ?? '',
          brand: (row.brand as string) ?? undefined,
          servingSize: servingSizeLabel,
          servingQuantity: row.serving_size ?? undefined,
          caloriesPerServing: row.calories ?? undefined,
          caloriesPer100g: row.calories ?? undefined,
          carbsPerServing: row.carbs ?? undefined,
          proteinPerServing: row.protein ?? undefined,
          fatPerServing: row.fat ?? undefined,
        }
      }) ?? []

    return NextResponse.json({
      items,
      total: items.length,
    })
  } catch (error) {
    console.error('❌ Unexpected food search error:', error)
    return NextResponse.json(
      { error: 'Unexpected error while searching foods.', items: [], total: 0 },
      { status: 200 }
    )
  }
}

