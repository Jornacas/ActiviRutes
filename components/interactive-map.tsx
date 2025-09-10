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
    googleMapsLoading?: Promise<void>
    googleMapsLoaded?: boolean
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

  // Cargar Google Maps API (solo una vez globalmente)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.google) {
        setIsLoaded(true)
        return
      }
      
      // Si ya está cargando, esperar a que termine
      if (window.googleMapsLoading) {
        window.googleMapsLoading.then(() => setIsLoaded(true))
        return
      }
      
      // Si no existe ningún script de Google Maps, crearlo
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (!existingScript) {
        window.googleMapsLoading = new Promise((resolve) => {
          const script = document.createElement('script')
          script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=geometry,places&callback=initGlobalGoogleMaps`
          script.async = true
          script.defer = true
          
          // Callback global único
          ;(window as any).initGlobalGoogleMaps = () => {
            try {
              window.googleMapsLoaded = true
              delete (window as any).initGlobalGoogleMaps
              setIsLoaded(true)
              resolve()
            } catch (error) {
              console.warn('Error menor en Google Maps:', error)
              setIsLoaded(true)
              resolve()
            }
          }
          
          script.onerror = () => {
            console.error('Error cargando Google Maps API')
            delete window.googleMapsLoading
            resolve() // Resolver incluso en error para evitar colgarse
          }
          
          document.head.appendChild(script)
        })
      } else {
        // Si el script ya existe, esperar a que cargue
        const checkLoaded = () => {
          if (window.google) {
            setIsLoaded(true)
          } else {
            setTimeout(checkLoaded, 100)
          }
        }
        checkLoaded()
      }
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
        // Usar el endpoint interno de API para evitar CORS
        const apiUrl = `/api/geocode?q=${encodeURIComponent(improvedAddress)}`
        
        // Delay para evitar rate limiting
        const delay = index * 100 // Reducido a 100ms ya que el servidor gestiona el rate limiting
        
        return new Promise(resolve => {
          setTimeout(() => {
            fetch(apiUrl)
            .then(response => {
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
              }
              return response.json()
            })
            .then(data => {
              if (data && data.length > 0) {
                const position = {
                  lat: parseFloat(data[0].lat),
                  lng: parseFloat(data[0].lon),
                }
                resolve({ item, index, position, improvedAddress: data[0].display_name || improvedAddress })
              } else {
                console.warn(`Geocoding falló para ${item.name}: No se encontraron resultados`)
                console.log('Dirección intentada:', improvedAddress)
                resolve(null)
              }
            })
            .catch(error => {
              console.error(`Error en Geocoding para ${item.name}:`, error)
              // El endpoint ya maneja fallbacks, pero por si acaso
              const barcelonaApprox = {
                lat: 41.3851 + (Math.random() - 0.5) * 0.1,
                lng: 2.1734 + (Math.random() - 0.5) * 0.1,
              }
              console.log(`Usando coordenadas aproximadas para ${item.name}:`, barcelonaApprox)
              resolve({ item, index, position: barcelonaApprox, improvedAddress })
            })
          }, delay)
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
      const apiUrl = `/api/geocode?q=${encodeURIComponent(`${location}, Barcelona, España`)}`;
      try {
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
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
          // Fallback a coordenadas del centro de Barcelona
          const barcelonaCenter = { lat: 41.3851, lng: 2.1734 };
          const marker = new window.google.maps.Marker({
            position: barcelonaCenter,
            map,
            title: `${type === 'start' ? 'Punto de Inicio' : 'Punto de Destino'} (ubicación aproximada)`,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: type === 'start' ? '#4CAF50' : '#F44336',
              fillOpacity: 0.7, // Menos opacidad para indicar aproximación
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 10,
            },
            label: {
              text: type === 'start' ? '~A' : '~B',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
            },
          });
          if (type === 'start') setStartMarker(marker);
          else setEndMarker(marker);
          return barcelonaCenter;
        }
      } catch (error) {
        console.error(`Error en Geocoding para ${location} (${type}):`, error);
        // Fallback silencioso a coordenadas del centro de Barcelona
        const barcelonaCenter = { lat: 41.3851, lng: 2.1734 };
        const marker = new window.google.maps.Marker({
          position: barcelonaCenter,
          map,
          title: `${type === 'start' ? 'Punto de Inicio' : 'Punto de Destino'} (ubicación aproximada - error de red)`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#999999', // Color gris para indicar error
            fillOpacity: 0.5,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 8,
          },
          label: {
            text: '!',
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold',
          },
        });
        if (type === 'start') setStartMarker(marker);
        else setEndMarker(marker);
        return barcelonaCenter;
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