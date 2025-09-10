import { NextRequest, NextResponse } from 'next/server'

// Cache simple en memoria para evitar requests duplicados
const geocodeCache = new Map<string, any>()
const lastRequestTime = new Map<string, number>()

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

    // Rate limiting simple: mínimo 500ms entre requests del mismo cliente
    const clientId = request.headers.get('x-forwarded-for') || 'unknown'
    const now = Date.now()
    const lastRequest = lastRequestTime.get(clientId) || 0
    
    if (now - lastRequest < 500) {
      await new Promise(resolve => setTimeout(resolve, 500 - (now - lastRequest)))
    }
    
    lastRequestTime.set(clientId, Date.now())

    // Hacer el request a OpenStreetMap desde el servidor (sin CORS)
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'ActiviRutes/1.0 (https://activirutes.app; contact@activirutes.app)'
      }
    })

    if (!response.ok) {
      // Si falla OpenStreetMap, devolver coordenadas aproximadas de Barcelona
      const barcelonaFallback = [{
        lat: (41.3851 + (Math.random() - 0.5) * 0.1).toString(),
        lon: (2.1734 + (Math.random() - 0.5) * 0.1).toString(),
        display_name: `${query} (ubicación aproximada - Barcelona)`
      }]
      
      geocodeCache.set(query, barcelonaFallback)
      return NextResponse.json(barcelonaFallback)
    }

    const data = await response.json()
    
    // Si no hay resultados, usar fallback
    if (!data || data.length === 0) {
      const barcelonaFallback = [{
        lat: (41.3851 + (Math.random() - 0.5) * 0.05).toString(),
        lon: (2.1734 + (Math.random() - 0.5) * 0.05).toString(),
        display_name: `${query} (ubicación aproximada - Barcelona)`
      }]
      
      geocodeCache.set(query, barcelonaFallback)
      return NextResponse.json(barcelonaFallback)
    }

    // Cache por 1 hora
    geocodeCache.set(query, data)
    setTimeout(() => {
      geocodeCache.delete(query)
    }, 60 * 60 * 1000)

    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Error en geocoding API:', error)
    
    // Fallback en caso de error
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || 'Barcelona'
    
    const fallbackData = [{
      lat: (41.3851 + (Math.random() - 0.5) * 0.1).toString(),
      lon: (2.1734 + (Math.random() - 0.5) * 0.1).toString(),
      display_name: `${query} (ubicación aproximada por error de red)`
    }]
    
    return NextResponse.json(fallbackData)
  }
}