import { NextRequest, NextResponse } from 'next/server'

// Cache simple en memoria para evitar requests duplicados
const geocodeCache = new Map<string, any>()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query) {
      return NextResponse.json({ error: 'Query parameter required' }, { status: 400 })
    }

    // Verificar cache primero
    if (geocodeCache.has(query)) {
      return NextResponse.json(geocodeCache.get(query))
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json([{ error: 'API key no configurada' }], { status: 500 })
    }

    // Google Geocoding API
    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=es&language=ca&key=${apiKey}`

    const response = await fetch(googleUrl)
    const data = await response.json()

    if (data.status === 'OK' && data.results?.length > 0) {
      // Convertir formato Google a formato compatible con el frontend
      const results = data.results.map((r: any) => ({
        lat: r.geometry.location.lat.toString(),
        lon: r.geometry.location.lng.toString(),
        display_name: r.formatted_address,
      }))

      geocodeCache.set(query, results)
      setTimeout(() => geocodeCache.delete(query), 60 * 60 * 1000)
      return NextResponse.json(results)
    }

    // Fallback si no hay resultados
    const fallback = [{
      lat: '41.3851',
      lon: '2.1734',
      display_name: `${query} (sin resultados - centro Barcelona)`
    }]
    geocodeCache.set(query, fallback)
    return NextResponse.json(fallback)

  } catch (error) {
    console.error('Error en geocoding API:', error)
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || 'Barcelona'

    return NextResponse.json([{
      lat: '41.3851',
      lon: '2.1734',
      display_name: `${query} (error de red)`
    }])
  }
}
