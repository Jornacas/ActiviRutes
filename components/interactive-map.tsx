"use client"
import { useEffect, useRef, useState } from "react"

export interface RouteItem {
  id: string
  name: string
  address: string
  activities: string[]
  day?: string
  turn?: string
  startTime?: string
  totalStudents?: number
  price?: number
  monitor?: string
  type: "delivery" | "pickup"
  originalIndex?: number
}

interface InteractiveMapProps {
  items: RouteItem[]
  onItemClick?: (item: RouteItem) => void
  startLocation?: string
  endLocation?: string
}

declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

export function InteractiveMap({ items, onItemClick, startLocation, endLocation }: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [startMarker, setStartMarker] = useState<any>(null)
  const [endMarker, setEndMarker] = useState<any>(null)

  // Función para mejorar las direcciones de Barcelona
  const improveAddress = (name: string, address: string): string => {
    let improvedAddress = address
    
    // Si no contiene Barcelona, añadirlo
    if (!improvedAddress.toLowerCase().includes('barcelona')) {
      improvedAddress += ', Barcelona, España'
    }
    
    return improvedAddress
  }

  // Cargar Google Maps API
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.google) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=geometry,places&callback=initMap`
      script.async = true
      script.defer = true
      
      window.initMap = () => {
        setIsLoaded(true)
      }
      
      document.head.appendChild(script)
      
      return () => {
        document.head.removeChild(script)
        delete window.initMap
      }
    } else if (window.google) {
      setIsLoaded(true)
    }
  }, [])

  // Inicializar mapa cuando Google Maps esté disponible
  useEffect(() => {
    if (isLoaded && mapRef.current && window.google && !map) {
      const googleMap = new window.google.maps.Map(mapRef.current, {
        center: { lat: 41.3851, lng: 2.1734 }, // Centro de Barcelona
        zoom: 11,
        mapTypeId: 'roadmap',
      })
      setMap(googleMap)
    }
  }, [isLoaded, map])

  // Actualizar marcadores cuando cambien los items
  useEffect(() => {
    if (map && items.length > 0) {
      // Limpiar marcadores existentes
      markers.forEach(marker => marker.setMap(null))
      
      const geocodePromises = items.map((item, index) => {
        const improvedAddress = improveAddress(item.name, item.address)
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(improvedAddress)}`
        
        

        return fetch(url)
          .then(response => response.json())
          .then(data => {
            if (data && data.length > 0) {
              const position = {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
              }
              return { item, index, position, improvedAddress }
            } else {
              console.warn(`Geocoding falló para ${item.name}: No se encontraron resultados de OpenStreetMap`)
              console.log('Dirección intentada:', improvedAddress)
              return null
            }
          })
          .catch(error => {
            console.error(`Error en Geocoding para ${item.name}:`, error)
            return null
          })
      })

      Promise.all(geocodePromises).then(results => {
        const newMarkers: any[] = []
        const bounds = new window.google.maps.LatLngBounds()
        
        results.forEach(result => {
          if (result) {
            const { item, index, position, improvedAddress } = result
            bounds.extend(position)
            
            const dayColors: { [key: string]: string } = {
              'lunes': '#FF6B6B', 'martes': '#4ECDC4', 'miércoles': '#45B7D1',
              'jueves': '#96CEB4', 'viernes': '#FFEAA7'
            }
            const color = item.day ? dayColors[item.day.toLowerCase()] || '#9013FE' : '#9013FE'
            
            const marker = new window.google.maps.Marker({
              position,
              map,
              title: `${item.name === "Academia" ? "Academia" : `Escola ${item.name}`}\n${improvedAddress}`,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: color, fillOpacity: 1, strokeColor: '#ffffff',
                strokeWeight: 2, scale: 12,
              },
              label: {
                text: (index + 1).toString(), color: 'white',
                fontSize: '12px', fontWeight: 'bold'
              }
            })
            
            const infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div style="padding: 10px; max-width: 300px;">
                  <h3 style="margin: 0 0 8px 0; color: #333; font-size: 18px; font-weight: bold;">
                    ${item.name === "Academia" ? "Academia" : `Escola ${item.name}`}
                  </h3>
                  <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">📍 ${improvedAddress}</p>
                  ${item.day ? `<p style="margin: 0 0 5px 0; color: #666;">📅 ${item.day}</p>` : ''}
                  ${item.totalStudents ? `<p style="margin: 0 0 5px 0; color: #666;">👥 ${item.totalStudents} estudiantes</p>` : ''}
                  ${item.activities && item.activities.length > 0 ? `<p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">🎯 ${item.activities.join(', ')}</p>` : ''}
                  <div style="margin-top: 10px;">
                    <button 
                      onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(improvedAddress)}', '_blank')"
                      style="padding: 5px 10px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;"
                    >
                      🧭 Navegar aquí
                    </button>
                  </div>
                </div>
              `
            })
            
            marker.addListener('click', () => {
              infoWindow.open(map, marker)
              if (onItemClick) onItemClick(item)
            })
            
            newMarkers.push(marker)
          }
        })
        
        setMarkers(newMarkers)
        
        if (newMarkers.length > 1) {
          map.fitBounds(bounds)
        } else if (newMarkers.length === 1) {
          map.setCenter(bounds.getCenter())
          map.setZoom(15)
        }
      })
    }
  }, [map, items, onItemClick])

  // Actualizar marcadores de inicio/fin cuando cambien las ubicaciones
  useEffect(() => {
    if (!map) return;

    // Limpiar marcadores existentes
    if (startMarker) startMarker.setMap(null);
    if (endMarker) endMarker.setMap(null);

    const geocodeLocation = async (location: string, type: 'start' | 'end') => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}, Barcelona, España`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.length > 0) {
          const position = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          };
          const marker = new window.google.maps.Marker({
            position,
            map,
            title: type === 'start' ? 'Punto de Inicio' : 'Punto de Destino',
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: type === 'start' ? '#4CAF50' : '#F44336', // Green for start, Red for end
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 12,
            },
            label: {
              text: type === 'start' ? 'A' : 'B',
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold',
            },
          });
          if (type === 'start') setStartMarker(marker);
          else setEndMarker(marker);
          return position;
        } else {
          console.warn(`Geocoding falló para ${location} (${type}): No se encontraron resultados de OpenStreetMap`);
          return null;
        }
      } catch (error) {
        console.error(`Error en Geocoding para ${location} (${type}):`, error);
        return null;
      }
    };

    const updateBounds = (positions: any[]) => {
      if (positions.length === 0) return;
      const newBounds = new window.google.maps.LatLngBounds();
      positions.forEach(pos => newBounds.extend(pos));
      map.fitBounds(newBounds);
    };

    const processLocations = async () => {
      const allPositions: any[] = [];
      if (startLocation) {
        const pos = await geocodeLocation(startLocation, 'start');
        if (pos) allPositions.push(pos);
      }
      if (endLocation) {
        const pos = await geocodeLocation(endLocation, 'end');
        if (pos) allPositions.push(pos);
      }
      updateBounds(allPositions);
    };

    processLocations();

  }, [map, startLocation, endLocation]);

  return (
    <div className="w-full h-full relative">
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Cargando mapa...</p>
          </div>
        </div>
      )}
      
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg"
        style={{ minHeight: '400px' }}
      />
      
      {items.length > 0 && (
        <div className="absolute top-2 right-2 bg-white rounded-lg shadow-lg p-3 max-w-xs">
          <div className="text-xs text-gray-600 mb-2">Leyenda:</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <span>Lunes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-teal-400"></div>
              <span>Martes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-400"></div>
              <span>Miércoles</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <span>Jueves</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-300"></div>
              <span>Viernes</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}