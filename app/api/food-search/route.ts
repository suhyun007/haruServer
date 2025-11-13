import { NextRequest, NextResponse } from 'next/server'

const OPEN_FOOD_FACTS_ENDPOINT = 'https://world.openfoodfacts.org/cgi/search.pl'

type Nutriments = Record<string, unknown>

type OpenFoodFactsProduct = {
  id?: string
  _id?: string
  product_name?: string
  generic_name?: string
  brands?: string
  serving_size?: string
  serving_quantity?: number
  nutriments?: Nutriments
}

type FoodSearchResult = {
  id: string
  name: string
  brand?: string
  servingSize?: string
  servingQuantity?: number
  caloriesPerServing?: number
  caloriesPer100g?: number
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const query = (searchParams.get('query') ?? searchParams.get('q') ?? '').trim()
  const language = (searchParams.get('language') ?? searchParams.get('lc') ?? '').trim()
  const limitParam = searchParams.get('limit') ?? searchParams.get('page_size') ?? '10'
  const limit = Math.min(Math.max(Number.parseInt(limitParam, 10) || 10, 1), 25)

  if (query.length < 2) {
    return NextResponse.json({ items: [], total: 0 })
  }

  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: limit.toString(),
    fields: 'id,product_name,generic_name,brands,serving_size,serving_quantity,nutriments',
  })

  if (language) {
    params.set('lc', language)
  }

  const url = `${OPEN_FOOD_FACTS_ENDPOINT}?${params.toString()}`

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HaruFit/1.0',
      },
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      console.error(
        'OpenFoodFacts request failed:',
        response.status,
        await response.text()
      )
      return NextResponse.json(
        { error: 'Failed to fetch food data from upstream service.' },
        { status: 502 }
      )
    }

    const data = (await response.json()) as { products?: OpenFoodFactsProduct[] }
    const products = data.products ?? []

    const items = products
      .map((product) => mapProduct(product))
      .filter((item): item is FoodSearchResult => Boolean(item))

    return NextResponse.json({
      items,
      total: items.length,
    })
  } catch (error) {
    console.error('OpenFoodFacts request error:', error)
    return NextResponse.json(
      { error: 'Unexpected error while fetching food data.' },
      { status: 500 }
    )
  }
}

function mapProduct(product: OpenFoodFactsProduct): FoodSearchResult | null {
  const id = product.id ?? product._id
  const rawName = product.product_name ?? product.generic_name ?? ''
  if (!id || !rawName) {
    return null
  }

  const brand = extractPrimaryBrand(product.brands)
  const nutriments = product.nutriments ?? {}

  const caloriesPerServing =
    extractNumber(nutriments, ['energy-kcal_serving', 'energy-kcal_value', 'energy_serving', 'energy_value']) ??
    convertKjToKcal(extractNumber(nutriments, ['energy_serving']))

  const caloriesPer100g =
    extractNumber(nutriments, ['energy-kcal_100g', 'energy_100g']) ??
    convertKjToKcal(extractNumber(nutriments, ['energy_100g']))

  return {
    id,
    name: rawName,
    brand: brand ?? undefined,
    servingSize: product.serving_size ?? undefined,
    servingQuantity: product.serving_quantity ?? undefined,
    caloriesPerServing: caloriesPerServing ?? undefined,
    caloriesPer100g: caloriesPer100g ?? undefined,
  }
}

function extractPrimaryBrand(brands?: string | null): string | null {
  if (!brands) return null
  return (
    brands
      .split(',')
      .map((entry) => entry.trim())
      .find((entry) => entry.length > 0) ?? null
  )
}

function extractNumber(nutriments: Nutriments, keys: string[]): number | null {
  for (const key of keys) {
    const value = nutriments[key]
    if (typeof value === 'number') {
      return value
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value)
      if (!Number.isNaN(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function convertKjToKcal(value: number | null): number | null {
  if (!value) return null
  return value / 4.184
}

