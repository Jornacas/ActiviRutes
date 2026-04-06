"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Route, RotateCcw } from "lucide-react"

export interface RouteMapItem {
  id: string
  name: string
  address: string
  activities: string[]
  day?: string
}

interface RouteMapPanelProps {
  items: RouteMapItem[]
  startLocation: string
  endLocation: string
  onOptimizedOrder?: (reorderedItems: RouteMapItem[]) => void
}

declare global {
  interface Window {
    google: any
    googleMapsLoading?: Promise<void>
    googleMapsLoaded?: boolean
  }
}

// Cache de geocoding en memoria (compartido entre instancias)
const geocodeCache = new Map<string, { lat: number; lng: number }>()

function improveAddress(name: string, address: string): string {
  let improved = address
  if (!improved.toLowerCase().includes('barcelona')) {
    improved += ', Barcelona, España'
  }
  return improved
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (geocodeCache.has(address)) return geocodeCache.get(address)!

  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data && data.length > 0) {
      const pos = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
      geocodeCache.set(address, pos)
      return pos
    }
  } catch {
    // ignore
  }
  return null
}

export function RouteMapPanel({ items, startLocation, endLocation, onOptimizedOrder }: RouteMapPanelProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const directionsRenderer = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Load Google Maps API (reuse existing global loading pattern)
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.google && window.google.maps) {
      setIsLoaded(true)
      return
    }

    if (window.googleMapsLoading) {
      window.googleMapsLoading.then(() => setIsLoaded(true))
      return
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    if (!existingScript) {
      window.googleMapsLoading = new Promise((resolve) => {
        const script = document.createElement('script')
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places&callback=initGlobalGoogleMaps&loading=async`
        script.async = true
        script.defer = true
        ;(window as any).initGlobalGoogleMaps = () => {
          window.googleMapsLoaded = true
          delete (window as any).initGlobalGoogleMaps
          setIsLoaded(true)
          resolve()
        }
        script.onerror = () => {
          delete window.googleMapsLoading
          setError('Error cargando Google Maps')
          resolve()
        }
        document.head.appendChild(script)
      })
    } else {
      const check = () => {
        if (window.google && window.google.maps) setIsLoaded(true)
        else setTimeout(check, 100)
      }
      check()
    }
  }, [])

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstance.current) return
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 41.3851, lng: 2.1734 },
      zoom: 12,
      mapTypeId: 'roadmap',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
    directionsRenderer.current = new window.google.maps.DirectionsRenderer({
      map: mapInstance.current,
      suppressMarkers: true, // We draw our own numbered markers
      polylineOptions: {
        strokeColor: '#2563eb',
        strokeWeight: 4,
        strokeOpacity: 0.8,
      },
    })
  }, [isLoaded])

  // Clear markers
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
  }, [])

  // Draw route when items change (debounced)
  useEffect(() => {
    if (!mapInstance.current || !isLoaded || items.length === 0) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      drawRoute(items, false)
    }, 600)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [items, isLoaded, startLocation, endLocation])

  const drawRoute = async (routeItems: RouteMapItem[], optimize: boolean) => {
    if (!mapInstance.current || !window.google) return

    const currentRequest = ++requestIdRef.current
    setError(null)

    // Geocode all items + start/end
    const addresses = routeItems.map(item => improveAddress(item.name, item.address))
    const startAddr = startLocation.toLowerCase().includes('barcelona')
      ? startLocation
      : `${startLocation}, Barcelona, España`
    const endAddr = endLocation.toLowerCase().includes('barcelona')
      ? endLocation
      : `${endLocation}, Barcelona, España`

    // Geocode with staggered requests
    const positions: ({ lat: number; lng: number } | null)[] = []
    for (let i = 0; i < addresses.length; i++) {
      if (currentRequest !== requestIdRef.current) return // cancelled
      const pos = await geocodeAddress(addresses[i])
      positions.push(pos)
      if (!geocodeCache.has(addresses[i])) {
        await new Promise(r => setTimeout(r, 100))
      }
    }

    const startPos = await geocodeAddress(startAddr)
    const endPos = await geocodeAddress(endAddr)

    if (currentRequest !== requestIdRef.current) return

    // Filter valid positions
    const validItems: { item: RouteMapItem; pos: { lat: number; lng: number }; index: number }[] = []
    routeItems.forEach((item, i) => {
      if (positions[i]) validItems.push({ item, pos: positions[i]!, index: i })
    })

    if (validItems.length === 0) {
      setError('No se pudieron geocodificar las direcciones')
      return
    }

    // Use Directions API
    const directionsService = new window.google.maps.DirectionsService()

    const origin = startPos || validItems[0].pos
    const destination = endPos || validItems[validItems.length - 1].pos
    const waypoints = validItems.map(v => ({
      location: new window.google.maps.LatLng(v.pos.lat, v.pos.lng),
      stopover: true,
    }))

    try {
      const result = await new Promise<any>((resolve, reject) => {
        directionsService.route(
          {
            origin: new window.google.maps.LatLng(origin.lat, origin.lng),
            destination: new window.google.maps.LatLng(destination.lat, destination.lng),
            waypoints,
            optimizeWaypoints: optimize,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (response: any, status: string) => {
            if (status === 'OK') resolve(response)
            else reject(new Error(`Directions API: ${status}`))
          }
        )
      })

      if (currentRequest !== requestIdRef.current) return

      // Draw the route
      directionsRenderer.current.setDirections(result)

      // Calculate total distance and duration
      const route = result.routes[0]
      let totalDistance = 0
      let totalDuration = 0
      route.legs.forEach((leg: any) => {
        totalDistance += leg.distance.value
        totalDuration += leg.duration.value
      })

      setRouteInfo({
        distance: `${(totalDistance / 1000).toFixed(1)} km`,
        duration: `${Math.round(totalDuration / 60)} min`,
      })

      // Draw numbered markers
      clearMarkers()
      const newMarkers: any[] = []

      // Start marker
      const startMarker = new window.google.maps.Marker({
        position: origin,
        map: mapInstance.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#16a34a',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          scale: 14,
        },
        label: { text: 'A', color: 'white', fontSize: '12px', fontWeight: 'bold' },
        title: 'Inicio: ' + startLocation,
        zIndex: 1000,
      })
      newMarkers.push(startMarker)

      // Waypoint markers — use optimized order if available
      const waypointOrder = optimize && route.waypoint_order
        ? route.waypoint_order
        : validItems.map((_: any, i: number) => i)

      waypointOrder.forEach((originalIndex: number, displayIndex: number) => {
        const v = validItems[originalIndex]
        if (!v) return
        const schoolName = v.item.name === "Academia" ? "Academia" : `Escola ${v.item.name}`

        const marker = new window.google.maps.Marker({
          position: v.pos,
          map: mapInstance.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#2563eb',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            scale: 13,
          },
          label: { text: String(displayIndex + 1), color: 'white', fontSize: '11px', fontWeight: 'bold' },
          title: `${displayIndex + 1}. ${schoolName}\n${v.item.address}`,
          zIndex: 500 + displayIndex,
        })

        const infoWindow = new window.google.maps.InfoWindow({
          content: `<div style="padding:8px;max-width:250px;">
            <strong>${displayIndex + 1}. ${schoolName}</strong><br/>
            <span style="color:#666;font-size:13px;">${v.item.address}</span>
            ${v.item.activities?.length ? `<br/><span style="color:#888;font-size:12px;">${v.item.activities.join(', ')}</span>` : ''}
          </div>`,
        })
        marker.addListener('click', () => infoWindow.open(mapInstance.current, marker))
        newMarkers.push(marker)
      })

      // End marker
      const endMarker = new window.google.maps.Marker({
        position: destination,
        map: mapInstance.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#dc2626',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          scale: 14,
        },
        label: { text: 'B', color: 'white', fontSize: '12px', fontWeight: 'bold' },
        title: 'Final: ' + endLocation,
        zIndex: 1000,
      })
      newMarkers.push(endMarker)
      markersRef.current = newMarkers

      // Return optimized order if requested
      if (optimize && route.waypoint_order && onOptimizedOrder) {
        const reordered = route.waypoint_order.map((i: number) => routeItems[i])
        onOptimizedOrder(reordered)
      }
    } catch (err: any) {
      if (currentRequest !== requestIdRef.current) return
      console.error('Error Directions API:', err)
      setError(err.message || 'Error calculando ruta')

      // Fallback: just show markers without route line
      clearMarkers()
      const bounds = new window.google.maps.LatLngBounds()
      validItems.forEach((v, i) => {
        bounds.extend(v.pos)
        const marker = new window.google.maps.Marker({
          position: v.pos,
          map: mapInstance.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#2563eb',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            scale: 13,
          },
          label: { text: String(i + 1), color: 'white', fontSize: '11px', fontWeight: 'bold' },
          title: `${i + 1}. ${v.item.name}`,
        })
        markersRef.current.push(marker)
      })
      mapInstance.current.fitBounds(bounds)
    }
  }

  const handleOptimize = async () => {
    if (items.length < 2) return
    setIsOptimizing(true)
    await drawRoute(items, true)
    setIsOptimizing(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-2 mb-2">
        <Button
          onClick={handleOptimize}
          disabled={isOptimizing || items.length < 2}
          size="sm"
          className="bg-green-600 hover:bg-green-700"
        >
          {isOptimizing ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Route className="h-4 w-4 mr-1" />
          )}
          Optimizar ruta
        </Button>
        {routeInfo && (
          <div className="text-xs text-gray-600 flex gap-3">
            <span>🛣️ {routeInfo.distance}</span>
            <span>⏱️ {routeInfo.duration} conducción</span>
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded mb-2">
          ⚠️ {error}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative rounded-lg overflow-hidden border">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-1 text-blue-600" />
              <p className="text-xs text-gray-500">Cargando mapa...</p>
            </div>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: '300px' }} />
      </div>
    </div>
  )
}
