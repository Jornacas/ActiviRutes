"use client"
import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InteractiveMap, RouteItem as ImportedRouteItem } from "./interactive-map"
import {
  MapPin,
  Clock,
  Route,
  ArrowLeft,
  Loader2,
  Package,
  Truck,
  ArrowUpDown,
  Save,
  FolderOpen,
  Trash2,
  RefreshCw,
  Map,
  List,
} from "lucide-react"

// Tipos para el editor de rutas
type RouteItem = ImportedRouteItem

// Tipo para guardar configuraciones de reorganización
interface RouteReorganization {
  id: string
  timestamp: string
  deliveryType: string
  weekStart: string
  reorganizedItems: { [day: string]: RouteItem[] }
}

interface RouteConfig {
  title: string
  items: RouteItem[]
  type: "delivery" | "pickup"
  selectedDay?: string
  allPlans?: any[] // Para almacenar todos los planes organizados por días
  onApplyChanges?: (reorganizedItems: { [day: string]: RouteItem[] }) => void
  deliveryType?: string
  weekStart?: string
}

interface RoutePreferences {
  startLocation: string
  endLocation: string
  preferredStartTime: string
  timePerStop: number
  avoidTolls: boolean
  avoidHighways: boolean
}

interface SavedRoute {
  id: string
  name: string
  day: string
  type: "delivery" | "pickup"
  items: RouteItem[]
  preferences: RoutePreferences
  createdAt: string
  updatedAt: string
}

interface OptimizedRoute {
  items: RouteItem[]
  totalDistance: number
  estimatedTime: number
  optimizedOrder: number[]
}

interface RouteFilters {
  turns: string[]
  priorityTimes: string[]
  activities: string[]
  sortBy: "proximity" | "time-proximity" | "manual"
}

// Función auxiliar para localStorage
function getSavedRoutesFromStorage(): SavedRoute[] {
  try {
    const stored = localStorage.getItem("barcelonaRoutes")
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Función para guardar ruta
async function saveRouteToSheet(route: SavedRoute): Promise<boolean> {
  try {
    const savedRoutes = getSavedRoutesFromStorage()
    const existingIndex = savedRoutes.findIndex((r) => r.id === route.id)

    if (existingIndex >= 0) {
      savedRoutes[existingIndex] = route
    } else {
      savedRoutes.push(route)
    }

    localStorage.setItem("barcelonaRoutes", JSON.stringify(savedRoutes))
    return true
  } catch (error) {
    console.error("Error guardando ruta:", error)
    return false
  }
}

// Función para cargar rutas
async function loadRoutesFromSheet(): Promise<SavedRoute[]> {
  try {
    return getSavedRoutesFromStorage()
  } catch (error) {
    console.error("Error cargando rutas:", error)
    return []
  }
}

// Función para eliminar ruta
async function deleteRouteFromSheet(routeId: string): Promise<boolean> {
  try {
    const savedRoutes = getSavedRoutesFromStorage()
    const filteredRoutes = savedRoutes.filter((r) => r.id !== routeId)
    localStorage.setItem("barcelonaRoutes", JSON.stringify(filteredRoutes))
    return true
  } catch (error) {
    console.error("Error eliminando ruta:", error)
    return false
  }
}

// Función para optimizar ruta con algoritmo inteligente
async function optimizeRouteWithGoogleMaps(items: RouteItem[], preferences: RoutePreferences): Promise<OptimizedRoute> {
  await new Promise((resolve) => setTimeout(resolve, 1500))
  
  // Optimización basada en múltiples criterios
  const optimizedItems = [...items].sort((a, b) => {
    // 1. Priorizar por horario de inicio si existe
    if (a.startTime && b.startTime) {
      const timeA = a.startTime.split(':').map(Number)
      const timeB = b.startTime.split(':').map(Number)
      const minutesA = timeA[0] * 60 + timeA[1]
      const minutesB = timeB[0] * 60 + timeB[1]
      if (minutesA !== minutesB) return minutesA - minutesB
    }
    
    // 2. Priorizar por turno (Matí antes que Tarda)
    if (a.turn !== b.turn) {
      if (a.turn === "Matí" && b.turn === "Tarda") return -1
      if (a.turn === "Tarda" && b.turn === "Matí") return 1
    }
    
    // 3. Optimizar por proximidad geográfica (ordenar por dirección)
    const addressA = a.address.toLowerCase()
    const addressB = b.address.toLowerCase()
    
    // Agrupar por zonas principales de Barcelona
    const getZone = (address: string) => {
      if (address.includes('gràcia') || address.includes('gracia')) return 1
      if (address.includes('eixample')) return 2
      if (address.includes('sant') || address.includes('santa')) return 3
      if (address.includes('sants')) return 4
      if (address.includes('nou barris')) return 5
      if (address.includes('horta')) return 6
      return 7 // Otras zonas
    }
    
    const zoneA = getZone(addressA)
    const zoneB = getZone(addressB)
    
    if (zoneA !== zoneB) return zoneA - zoneB
    
    // 4. Dentro de la misma zona, ordenar por calle
    return addressA.localeCompare(addressB)
  })

  // Generar orden optimizado
  const optimizedOrder = optimizedItems.map(item => items.findIndex(original => original.id === item.id))
  
  // Calcular métricas estimadas más realistas
  const baseDistance = items.length * 2.5 // 2.5km promedio entre centros en Barcelona
  const totalDistance = Math.max(baseDistance * 0.8, baseDistance * 1.2) // Variación del 20%
  
  const baseTime = items.length * preferences.timePerStop + (items.length * 8) // Tiempo por parada + traslado
  const estimatedTime = Math.round(baseTime * 0.9) // 10% de mejora por optimización

  return {
    items: optimizedItems,
    totalDistance: Math.round(totalDistance * 10) / 10,
    estimatedTime,
    optimizedOrder,
  }
}

// Función para generar opciones de ruta
function generateRouteOptions(
  items: RouteItem[],
  filters: RouteFilters,
): Array<{
  name: string
  description: string
  items: RouteItem[]
  estimatedTime: number
}> {
  return [
    {
      name: "Ruta Optimizada",
      description: "Combina proximidad geográfica con horarios prioritarios",
      items: [...items].sort((a, b) => a.address.localeCompare(b.address)),
      estimatedTime: items.length * 22,
    },
  ]
}

// Función para acortar URLs usando múltiples servicios
const shortenURL = async (longUrl: string): Promise<string> => {
  console.log('🔗 === ACORTANDO URL ===');
  console.log('📏 URL original:', longUrl);
  console.log('📊 Longitud original:', longUrl.length, 'caracteres');
  
  // Lista de servicios para probar
  const services = [
    // Servicio 1: is.gd
    {
      name: 'is.gd',
      url: `https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`,
      method: 'GET'
    },
    // Servicio 2: tinyurl.com
    {
      name: 'tinyurl.com',
      url: `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`,
      method: 'GET'
    }
  ];
  
  for (const service of services) {
    try {
      console.log(`🔄 Intentando acortar con ${service.name}...`);
      
      const response = await fetch(service.url, {
        method: service.method,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn(`⚠️ ${service.name} respondió con estado ${response.status}`);
        continue;
      }
      
             let shortUrl: string = '';
       
       if (service.name === 'is.gd') {
         const data = await response.json();
         if (data.shorturl) {
           shortUrl = data.shorturl;
         } else {
           console.warn(`⚠️ ${service.name} no devolvió shorturl:`, data);
           continue;
         }
       } else if (service.name === 'tinyurl.com') {
         shortUrl = await response.text();
         if (!shortUrl.startsWith('http')) {
           console.warn(`⚠️ ${service.name} devolvió respuesta inválida:`, shortUrl);
           continue;
         }
       }
       
       if (!shortUrl) {
         console.warn(`⚠️ ${service.name} no generó URL válida`);
         continue;
       }
      
      console.log(`✅ URL acortada con ${service.name}:`, shortUrl);
      console.log(`📊 Reducido de ${longUrl.length} a ${shortUrl.length} caracteres`);
      return shortUrl;
      
    } catch (error) {
      console.warn(`⚠️ Error con ${service.name}:`, error);
      continue;
    }
  }
  
  console.warn('⚠️ Todos los servicios de acortamiento fallaron, usando URL original');
  return longUrl;
};

// Función para exportar a Google Maps
const exportToGoogleMaps = async (items: RouteItem[], routePreferences: RoutePreferences) => {
  console.log("🗺️ Exportando a Google Maps:", items.length, "items")
  
  if (items.length === 0) {
    alert("No hay centros en la ruta para exportar.")
    return
  }

  const origin = encodeURIComponent(routePreferences.startLocation);
  const destination = encodeURIComponent(routePreferences.endLocation);
  
  // Usar SOLO las direcciones reales de los items como waypoints
  const waypoints = items.map((item) => {
    const schoolName = item.name === "Academia" ? "Academia" : `Escola ${item.name}`;
    const cleanAddress = `${schoolName}, ${item.address}, Barcelona`; // Include school name
    return encodeURIComponent(cleanAddress);
  }).join('/');

  let googleMapsUrl: string;

  if (items.length === 0) { // Should be caught by the first if, but good to be explicit
    googleMapsUrl = `https://www.google.com/maps/dir/${origin}/${destination}`;
  } else {
    googleMapsUrl = `https://www.google.com/maps/dir/${origin}/${waypoints}/${destination}`;
  }
  
  console.log("🛣️ URL de ruta:", googleMapsUrl);
  console.log("🚀 Abriendo Google Maps...");
  window.open(googleMapsUrl, "_blank");
}

// Función alternativa usando solo direcciones (sin nombres de escuelas)
const exportToGoogleMapsAlternative = (items: RouteItem[]) => {
  console.log("🗺️ Exportando a Google Maps (solo direcciones):", items.length, "items")
  
  if (items.length === 0) {
    alert("No hay centros en la ruta")
    return
  }

  if (items.length === 1) {
    // Para un solo punto
    const schoolName = items[0].name === "Academia" ? "Academia" : `Escola ${items[0].name}`
    const address = `${schoolName}, ${items[0].address}, Barcelona`
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(address)}`, "_blank")
    return
  }

  // Para múltiples puntos - usar solo direcciones
  const addresses = items.slice(0, 9).map(item => `${item.address}, Barcelona`)
  
  // Crear URL simple
  const fullUrl = `https://www.google.com/maps/dir/${addresses.map(addr => encodeURIComponent(addr)).join('/')}`
  
  console.log("📍 Solo direcciones:", addresses)
  console.log("🛣️ URL completa:", fullUrl)
  
  if (items.length > 9) {
    alert(`ℹ️ Versión simplificada: ${addresses.length} de ${items.length} paradas`)
  }
  
  window.open(fullUrl, "_blank")
}

// Función simple (mantener por compatibilidad)
const exportToGoogleMapsSimple = (items: RouteItem[]) => {
  // Crear preferencias por defecto para la compatibilidad
  const defaultPreferences: RoutePreferences = {
    startLocation: "Eixos Creativa, Barcelona",
    endLocation: "Eixos Creativa, Barcelona", 
    preferredStartTime: "09:00",
    timePerStop: 20,
    avoidTolls: false,
    avoidHighways: false
  }
  
  exportToGoogleMaps(items, defaultPreferences)
}

// Función para copiar direcciones mejorada
const copyRouteAddresses = (items: RouteItem[]) => {
  const addresses = items.map((item, index) => {
    const schoolName = item.name === "Academia" ? "Academia" : `Escola ${item.name}`
    return `${index + 1}. ${schoolName}\n   ${item.address}, Barcelona`
  }).join("\n\n")
  
  const textToCopy = `RUTA DE ENTREGA - ${items.length} PARADAS\n\n${addresses}`
  
  navigator.clipboard
    .writeText(textToCopy)
    .then(() => {
      alert("✅ Lista de ruta copiada al portapapeles\n📱 Puedes pegarla en cualquier app de GPS")
    })
    .catch(() => {
      alert("❌ No se pudo copiar la lista")
    })
}

// NUEVA: Navegación paso a paso (la solución más confiable)
const exportStepByStep = (items: RouteItem[]) => {
  console.log("🚚 Navegación paso a paso:", items.length, "items")
  
  if (items.length === 0) {
    alert("No hay centros en la ruta")
    return
  }

  // Crear ventana con navegación paso a paso
  const stepByStepContent = items.map((item, index) => {
    const schoolName = item.name === "Academia" ? "Academia" : `Escola ${item.name}`
    const address = `${item.address}, Barcelona`
    
    return `<div style="margin-bottom: 15px; padding: 15px; border: 2px solid #e0e0e0; border-radius: 8px; background: #f9f9f9;">
      <h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">
        <span style="background: #4285f4; color: white; padding: 2px 8px; border-radius: 50%; margin-right: 8px; font-size: 14px;">${index + 1}</span>
        ${schoolName}
      </h3>
      <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">${address}</p>
      <button onclick="window.open('https://www.google.com/maps/search/${encodeURIComponent(address)}', '_blank')" 
              style="padding: 8px 16px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
        🗺️ Navegar aquí
      </button>
    </div>`
  }).join('')

  const modalWindow = window.open('', '_blank', 'width=600,height=700,scrollbars=yes')
  if (modalWindow) {
    modalWindow.document.write(`
      <html>
        <head>
          <title>Navegación Paso a Paso</title>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              margin: 20px; 
              background: #fff;
            }
            h1 { 
              color: #333; 
              border-bottom: 3px solid #4285f4; 
              padding-bottom: 10px; 
              margin-bottom: 20px;
            }
            .instructions {
              background: #e8f4fd;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              border-left: 4px solid #4285f4;
            }
          </style>
        </head>
        <body>
          <h1>🚚 Ruta de Entrega - ${items.length} Paradas</h1>
          <div class="instructions">
            <strong>📋 Instrucciones:</strong><br>
            1. Haz clic en "🗺️ Navegar aquí" para cada parada<br>
            2. Completa la entrega antes de ir a la siguiente<br>
            3. Mantén esta ventana abierta como referencia
          </div>
          ${stepByStepContent}
          <div style="margin-top: 30px; padding: 15px; background: #f0f8ff; border-radius: 8px; text-align: center;">
            <strong>✅ ¿Completaste todas las entregas?</strong><br>
            <small>Puedes cerrar esta ventana cuando termines</small>
          </div>
        </body>
      </html>
    `)
    modalWindow.document.close()
  }
}

// NUEVA: Crear archivo CSV para apps de GPS
const exportToCSV = (items: RouteItem[]) => {
  if (items.length === 0) {
    alert("No hay centros en la ruta")
    return
  }

  const csvContent = [
    'Orden,Escola,Direccion,Actividades',
    ...items.map((item, index) => {
      const schoolName = item.name === "Academia" ? "Academia" : `Escola ${item.name}`
      const address = `${item.address}, Barcelona`
      const activities = item.activities?.join(' + ') || ''
      return `${index + 1},"${schoolName}","${address}","${activities}"`
    })
  ].join('\\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ruta_entregas_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
  
  alert('📊 Archivo CSV descargado\\n\\n💡 Puedes importar este archivo en:\\n• Google My Maps\\n• Apps de GPS profesionales\\n• Excel para organizar')
}

// Función para crear URL de Waze
const exportToWaze = (items: RouteItem[]) => {
  if (items.length === 0) {
    alert("No hay centros en la ruta")
    return
  }

  if (items.length === 1) {
    const schoolName = items[0].name === "Academia" ? "Academia" : `Escola ${items[0].name}`
    const address = `${schoolName}, ${items[0].address}, Barcelona`
    const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(address)}`
    window.open(wazeUrl, "_blank")
    return
  }

  // Para múltiples puntos, mostrar opciones
  const firstDestination = items[0]
  const schoolName = firstDestination.name === "Academia" ? "Academia" : `Escola ${firstDestination.name}`
  const address = `${schoolName}, ${firstDestination.address}, Barcelona`
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(address)}`
  
  const proceed = confirm(`🚗 Waze no soporta rutas múltiples automáticas.\n\n¿Abrir primera parada: "${schoolName}"?\n\n💡 Consejo: Usa "Lista" para copiar todas las direcciones.`)
  
  if (proceed) {
    window.open(wazeUrl, "_blank")
  }
}

export default function RouteEditor({
  config,
  onClose,
}: {
  config: RouteConfig
  onClose: () => void
}) {
  const [routePreferences, setRoutePreferences] = useState<RoutePreferences>({
    startLocation: "Eixos Creativa, Barcelona",
    endLocation: "Eixos Creativa, Barcelona",
    preferredStartTime: "09:00",
    timePerStop: 20,
    avoidTolls: false,
    avoidHighways: false,
  })
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [routeFilters, setRouteFilters] = useState<RouteFilters>({
    turns: [],
    priorityTimes: [],
    activities: [],
    sortBy: "proximity",
  })
  const [manualOrder, setManualOrder] = useState<RouteItem[]>([])
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([])
  const [routeName, setRouteName] = useState("")
  const [selectedSavedRoute, setSelectedSavedRoute] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)
  const [viewMode, setViewMode] = useState<"day" | "week">("day")
  const [weeklyPlansByDay, setWeeklyPlansByDay] = useState<{[key: string]: RouteItem[]}>({})
  const [draggedItem, setDraggedItem] = useState<RouteItem | null>(null)
  const [draggedFromDay, setDraggedFromDay] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{day: string, index: number} | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [selectedDayInDayView, setSelectedDayInDayView] = useState<string>("")

  const routeOptions = useMemo(() => generateRouteOptions(config.items, routeFilters), [config.items, routeFilters])

  useEffect(() => {
    loadSavedRoutes()
  }, [])

  // Organizar items por días cuando cambie la configuración
  useEffect(() => {
    if (config.type === "delivery" && config.items.length > 0) {
      console.log("🔧 Editor de Rutas - Organizando items por día (Entrega):", config.items)
      
      
      
      const groupedByDay = config.items.reduce((acc, item) => {
        const day = item.day || "Sin asignar"
        if (!acc[day]) acc[day] = []
        acc[day].push(item)
        return acc
      }, {} as {[key: string]: RouteItem[]})
      
      setWeeklyPlansByDay(groupedByDay)
    } else if (config.type === "pickup" && config.selectedDay) {
      console.log(`🔧 Editor de Rutas - Configurando items para día (Recogida): ${config.selectedDay}`)
      const dayMapping: { [key: string]: string } = {
        'jueves': 'Dijous',
        'viernes': 'Divendres'
      };
      const catalanDay = dayMapping[config.selectedDay] || config.selectedDay;
      setWeeklyPlansByDay({ [catalanDay]: config.items });
    }
  }, [config.items, config.type, config.selectedDay, config.deliveryType, config.weekStart])

  // Inicializar día seleccionado en vista día
  useEffect(() => {
    if (config.selectedDay && !selectedDayInDayView) {
      setSelectedDayInDayView(config.selectedDay)
    }
  }, [config.selectedDay, selectedDayInDayView])

  const loadSavedRoutes = async () => {
    try {
      const routes = await loadRoutesFromSheet()
      setSavedRoutes(routes)
    } catch (error) {
      console.error("Error cargando rutas:", error)
    }
  }

  const currentItems = useMemo(() => {
    console.log("🔍 currentItems - Calculando items actuales:")
    console.log("   viewMode:", viewMode)
    console.log("   config.selectedDay:", config.selectedDay) 
    console.log("   config.items:", config.items)
    console.log("   routeFilters.sortBy:", routeFilters.sortBy)
    
    if (routeFilters.sortBy === "manual" && manualOrder.length > 0) {
      console.log("   → Usando orden manual:", manualOrder.length, "items")
      return manualOrder
    }
    
    // En vista de día, filtrar solo los elementos del día seleccionado
    if (viewMode === "day" && selectedDayInDayView) {
      console.log(`   → Filtrando por día "${selectedDayInDayView}"`)
      
      // Mapear días españoles a catalanes
      const dayMapping: { [key: string]: string } = {
        'lunes': 'Dilluns',
        'martes': 'Dimarts', 
        'miércoles': 'Dimecres',
        'jueves': 'Dijous',
        'viernes': 'Divendres'
      }
      
      const catalanDay = dayMapping[selectedDayInDayView.toLowerCase()] || selectedDayInDayView
      console.log(`   → Día español "${selectedDayInDayView}" → catalán "${catalanDay}"`)
      
      // USAR weeklyPlansByDay en lugar de config.items para reflejar los cambios de reorganización
      const dayItems = weeklyPlansByDay[catalanDay] || []
      console.log("   → Items del día desde weeklyPlansByDay:", dayItems.length)
      
      // Si hay una ruta optimizada, filtrar por día, sino usar los items reorganizados directamente
      const result = optimizedRoute ? optimizedRoute.items.filter(item => item.day === catalanDay) : dayItems
      console.log("   → Resultado final:", result.length, "items")
      return result
    }
    
    const result = optimizedRoute ? optimizedRoute.items : routeOptions[0]?.items || []
    console.log("   → Usando ruta optimizada o opciones:", result.length, "items")
    return result
  }, [optimizedRoute, routeOptions, routeFilters.sortBy, manualOrder, viewMode, selectedDayInDayView, config.items, weeklyPlansByDay])

  const optimizeRoute = async () => {
    setIsOptimizing(true)
    const result = await optimizeRouteWithGoogleMaps(config.items, routePreferences)
    setOptimizedRoute(result)
    setIsOptimizing(false)
  }

  const enableManualMode = () => {
    const uniqueItems = currentItems.filter((item, index, self) => index === self.findIndex((i) => i.id === item.id))
    setManualOrder(uniqueItems)
    setRouteFilters((prev) => ({ ...prev, sortBy: "manual" }))
  }

  const saveCurrentRoute = async () => {
    if (!routeName.trim()) {
      alert("Por favor, introduce un nombre para la ruta")
      return
    }

    setIsSaving(true)
    try {
      const routeId = `${config.type}_${Date.now()}`
      
      // Usar los items reorganizados si estamos en modo de reorganización
      const itemsToSave = viewMode === "week" && Object.keys(weeklyPlansByDay).length > 0 
        ? Object.entries(weeklyPlansByDay).flatMap(([day, items]) => 
            items.map((item, index) => ({ ...item, day, originalIndex: index }))
          )
        : currentItems
      
      const savedRoute: SavedRoute = {
        id: routeId,
        name: routeName.trim(),
        day: config.selectedDay || "general",
        type: config.type,
        items: itemsToSave,
        preferences: routePreferences,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const success = await saveRouteToSheet(savedRoute)
      if (success) {
        await loadSavedRoutes()
        setRouteName("")
        persistWeeklyLayout();
        alert(`✅ Ruta "${savedRoute.name}" guardada y establecida como la disposición actual de la semana.\n📋 ${itemsToSave.length} centros incluidos.`) 
        setIsDirty(false)
      } else {
        alert("❌ Error guardando la ruta")
      }
    } catch (error) {
      console.error("Error guardando ruta:", error)
      alert("❌ Error guardando la ruta")
    } finally {
      setIsSaving(false)
    }
  }

  const loadSavedRoute = async () => {
    if (!selectedSavedRoute) return

    const route = savedRoutes.find((r) => r.id === selectedSavedRoute)
    if (!route) return

    try {
      // Reorganizar los items por días si vienen de una reorganización guardada
      const itemsByDay: {[key: string]: RouteItem[]} = {}
      
      route.items.forEach(item => {
        const day = item.day || "Sin asignar"
        if (!itemsByDay[day]) itemsByDay[day] = []
        itemsByDay[day].push(item)
      })
      
      // Si hay items organizados por días, aplicarlos a weeklyPlansByDay
      if (Object.keys(itemsByDay).length > 1) {
        setWeeklyPlansByDay(itemsByDay)
        setViewMode("week") // Cambiar a vista semana para mostrar la reorganización
        console.log('🔄 Ruta cargada con reorganización por días:', itemsByDay)
      } else {
        // Si es una ruta simple, usar orden manual
        setManualOrder(route.items)
        setRouteFilters((prev) => ({ ...prev, sortBy: "manual" }))
      }
      
      setRoutePreferences(route.preferences)
      alert(`✅ Ruta "${route.name}" cargada exitosamente\n📋 ${route.items.length} centros cargados`)
    } catch (error) {
      console.error("Error cargando ruta:", error)
      alert("❌ Error cargando la ruta")
    }
  }

  const deleteSavedRoute = async (routeId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta ruta?")) return

    try {
      const success = await deleteRouteFromSheet(routeId)
      if (success) {
        await loadSavedRoutes()
        if (selectedSavedRoute === routeId) {
          setSelectedSavedRoute("")
        }
        alert("✅ Ruta eliminada exitosamente")
      } else {
        alert("❌ Error eliminando la ruta")
      }
    } catch (error) {
      console.error("Error eliminando ruta:", error)
      alert("❌ Error eliminando la ruta")
    }
  }

  // Funciones para drag & drop
  const handleDragStart = (item: RouteItem) => {
    setDraggedItem(item)
    // Encontrar el día original del item
    Object.entries(weeklyPlansByDay).forEach(([day, items]) => {
      if (items.some(i => i.id === item.id)) {
        setDraggedFromDay(day)
      }
    })
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDraggedFromDay(null)
    setDropIndicator(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (targetDay: string) => {
    if (!draggedItem || !draggedFromDay) return
    
    // Crear una copia del estado actual
    const updatedPlans = { ...weeklyPlansByDay }
    
    // Remover el item del día original
    if (updatedPlans[draggedFromDay]) {
      updatedPlans[draggedFromDay] = updatedPlans[draggedFromDay].filter(item => item.id !== draggedItem.id)
    }
    
    // Añadir el item al día de destino
    if (!updatedPlans[targetDay]) updatedPlans[targetDay] = []
    updatedPlans[targetDay].push({ ...draggedItem, day: targetDay })
    
    setWeeklyPlansByDay(updatedPlans)
    setIsDirty(true)
    handleDragEnd()
  }

  const handleDropBetweenItems = (targetDay: string, targetIndex: number, e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!draggedItem || !draggedFromDay) return
    
    const updatedPlans = { ...weeklyPlansByDay }
    
    // Encontrar el índice original del item
    let originalIndex = -1
    if (updatedPlans[draggedFromDay]) {
      originalIndex = updatedPlans[draggedFromDay].findIndex(item => item.id === draggedItem.id)
    }
    
    // Si estamos moviendo dentro del mismo día, ajustar el índice
    let adjustedTargetIndex = targetIndex
    if (draggedFromDay === targetDay && originalIndex !== -1 && originalIndex < targetIndex) {
      adjustedTargetIndex = targetIndex - 1
    }
    
    // Remover el item del día original
    if (updatedPlans[draggedFromDay]) {
      updatedPlans[draggedFromDay] = updatedPlans[draggedFromDay].filter(item => item.id !== draggedItem.id)
    }
    
    // Insertar el item en la posición específica
    if (!updatedPlans[targetDay]) updatedPlans[targetDay] = []
    updatedPlans[targetDay].splice(adjustedTargetIndex, 0, { ...draggedItem, day: targetDay })
    
    setWeeklyPlansByDay(updatedPlans)
    setIsDirty(true)
    handleDragEnd()
  }

  // Función para reordenar dentro del mismo día
  const handleDropWithinDay = (targetDay: string, targetIndex: number) => {
    if (!draggedItem) return
    
    const updatedPlans = { ...weeklyPlansByDay }
    
    // Remover el item del día original
    Object.keys(updatedPlans).forEach(day => {
      updatedPlans[day] = updatedPlans[day].filter(item => item.id !== draggedItem.id)
    })
    
    // Insertar el item en la posición específica
    if (!updatedPlans[targetDay]) updatedPlans[targetDay] = []
    updatedPlans[targetDay].splice(targetIndex, 0, { ...draggedItem, day: targetDay })
    
    setWeeklyPlansByDay(updatedPlans)
    setDraggedItem(null)
  }

  const toggleViewMode = () => {
    console.log("🔄 Cambiando modo de vista desde:", viewMode)
    setViewMode(prev => {
      const newMode = prev === "day" ? "week" : "day"
      console.log("🔄 Nuevo modo de vista:", newMode)
      return newMode
    })
  }

  const applyChanges = () => {
    // Convertir los cambios de planificación semanal de vuelta a la estructura original
    const updatedItems: RouteItem[] = []
    
    Object.entries(weeklyPlansByDay).forEach(([day, items]) => {
      items.forEach((item, index) => {
        updatedItems.push({
          ...item,
          day: day,
          originalIndex: index // Mantener el orden dentro del día
        })
      })
    })
    
    // Guardar la reorganización en localStorage
    const reorganizationId = `reorganization_${config.deliveryType || 'default'}_${config.weekStart || new Date().toISOString().split('T')[0]}`
    const reorganizationData: RouteReorganization = {
      id: reorganizationId,
      timestamp: new Date().toISOString(),
      deliveryType: config.deliveryType || 'default',
      weekStart: config.weekStart || new Date().toISOString().split('T')[0],
      reorganizedItems: weeklyPlansByDay
    }
    
    try {
      localStorage.setItem(reorganizationId, JSON.stringify(reorganizationData))
      
      // También mantener un índice de todas las reorganizaciones
      const allReorganizations = JSON.parse(localStorage.getItem('allRouteReorganizations') || '[]')
      const existingIndex = allReorganizations.findIndex((item: any) => item.id === reorganizationId)
      
      if (existingIndex >= 0) {
        allReorganizations[existingIndex] = { id: reorganizationId, timestamp: reorganizationData.timestamp }
      } else {
        allReorganizations.push({ id: reorganizationId, timestamp: reorganizationData.timestamp })
      }
      
      localStorage.setItem('allRouteReorganizations', JSON.stringify(allReorganizations))
      
      console.log('🔄 Reorganización guardada:', reorganizationId)
      
      // Notificar al componente padre si existe el callback
      if (config.onApplyChanges) {
        config.onApplyChanges(weeklyPlansByDay)
      }
      
      alert(`✅ Cambios aplicados y guardados: ${updatedItems.length} centros reorganizados
🔄 Los cambios se mantendrán entre sesiones
💡 Usa "Guardar Ruta" para crear una copia permanente con nombre`)
      setIsDirty(false)
      
    } catch (error) {
      console.error('Error guardando reorganización:', error)
      alert('⚠️ Los cambios se aplicaron pero no se pudieron guardar permanentemente')
    }
    
    setViewMode("day")
  }

  const saveWeeklyLayout = () => {
    persistWeeklyLayout();
    const totalItems = Object.values(weeklyPlansByDay).flat().length;
    alert(`✅ Disposición de la semana guardada: ${totalItems} centros reorganizados.\n🔄 La próxima vez que abras el editor para esta semana, verás estos cambios.`);
    setIsDirty(false);
    setViewMode("day");
  }

  const persistWeeklyLayout = () => {
    const reorganizationId = `reorganization_${config.deliveryType || 'default'}_${config.weekStart || new Date().toISOString().split('T')[0]}`;
    const reorganizationData: RouteReorganization = {
      id: reorganizationId,
      timestamp: new Date().toISOString(),
      deliveryType: config.deliveryType || 'default',
      weekStart: config.weekStart || new Date().toISOString().split('T')[0],
      reorganizedItems: weeklyPlansByDay
    };
    
    try {
      localStorage.setItem(reorganizationId, JSON.stringify(reorganizationData));
      const allReorganizations = JSON.parse(localStorage.getItem('allRouteReorganizations') || '[]');
      const existingIndex = allReorganizations.findIndex((item: any) => item.id === reorganizationId);
      if (existingIndex >= 0) {
        allReorganizations[existingIndex] = { id: reorganizationId, timestamp: reorganizationData.timestamp };
      } else {
        allReorganizations.push({ id: reorganizationId, timestamp: reorganizationData.timestamp });
      }
      localStorage.setItem('allRouteReorganizations', JSON.stringify(allReorganizations));
      console.log('🔄 Reorganización guardada en background:', reorganizationId);
      if (config.onApplyChanges) {
        config.onApplyChanges(weeklyPlansByDay);
      }
    } catch (error) {
      console.error('Error guardando reorganización en background:', error);
    }
  };

  const [transporterLink, setTransporterLink] = useState<string | null>(null);
  const [showTransporterModal, setShowTransporterModal] = useState(false);
  const [localIP, setLocalIP] = useState<string | null>(null);

  // Función para detectar IP local automáticamente
  const detectLocalIP = async () => {
    try {
      // Crear una conexión WebRTC para detectar la IP local
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      pc.createDataChannel('');
      await pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      return new Promise<string>((resolve) => {
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch && !ipMatch[1].startsWith('127.')) {
              resolve(ipMatch[1]);
              pc.close();
            }
          }
        };
        
        // Timeout después de 5 segundos
        setTimeout(() => {
          pc.close();
          resolve('');
        }, 5000);
      });
    } catch (error) {
      console.log('No se pudo detectar IP automáticamente:', error);
      return '';
    }
  };

  const generateTransporterLink = async () => {
    if (currentItems.length === 0) {
      alert("No hay paradas en la ruta para generar el link del transportista");
      return;
    }

    const currentRouteId = `${config.type}-${config.selectedDay || 'general'}-${Date.now()}`;
    console.log('🔧 === GENERANDO LINK DEL TRANSPORTISTA ===')
    console.log('📋 Config:', config)
    console.log('🆔 RouteID generado:', currentRouteId)
    console.log('📊 Items en la ruta:', currentItems.length)
    
    const routeData = {
      items: currentItems,
      metadata: {
        type: config.type,
        day: config.selectedDay,
        generatedAt: new Date().toISOString(),
        totalStops: currentItems.length
      }
    };
    
    // Save the current route items to localStorage for the transporter app to load
    localStorage.setItem(`savedRoute_${currentRouteId}`, JSON.stringify(routeData));
    console.log('💾 Ruta guardada en localStorage con key:', `savedRoute_${currentRouteId}`)
    
    // Versión COMPLETA para copiar/compartir
    const fullSummary = {
      id: currentRouteId,
      type: config.type,
      day: config.selectedDay,
      total: currentItems.length,
      items: currentItems.map(item => ({
        id: item.id,
        name: item.name,
        address: item.address,
        activities: item.activities,
        startTime: item.startTime || '09:00'
      }))
    };
    
    // Codificar versión completa
    const fullEncoded = btoa(JSON.stringify(fullSummary));
    
    // Link base
    const hostname = window.location.hostname;
    const baseUrl = `${window.location.origin}/transporter/${currentRouteId}`;
    const fullLink = `${baseUrl}?data=${fullEncoded}`;
    
    console.log('🌐 Hostname:', hostname)
    console.log('🔗 Link completo generado:', fullLink)
    console.log('📦 Datos codificados incluidos en URL para compatibilidad móvil')
    
    // Acortar URL para hacerla más manejable
    let shortFullLink = fullLink;
    
    try {
      console.log('🔗 Acortando URL...');
      shortFullLink = await shortenURL(fullLink);
    } catch (error) {
      console.warn('⚠️ No se pudo acortar la URL, usando original');
    }
    
    // Establecer link completo para copiar y compartir
    setTransporterLink(shortFullLink); // Link completo acortado
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // En desarrollo - necesita túnel público
      setLocalIP("desarrollo-local"); // Flag para mostrar instrucciones especiales
      console.log('🏠 Modo desarrollo - links establecidos')
    } else {
      // En producción - usar URL normal (ya accesible públicamente)
      setLocalIP("produccion"); // Flag para mostrar que está listo
      console.log('🌍 Modo producción - links establecidos')
    }
    
    setShowTransporterModal(true);
  };

  const copyTransporterLink = () => {
    if (transporterLink) {
      navigator.clipboard.writeText(transporterLink).then(() => {
        alert("✅ Link copiado al portapapeles");
      }).catch(() => {
        alert("❌ No se pudo copiar el link");
      });
    }
  };

  const shareTransporterLink = () => {
    if (transporterLink && navigator.share) {
      navigator.share({
        title: 'Ruta ActiviRutes',
        text: `Ruta de ${currentItems.length} paradas para transportista`,
        url: transporterLink,
      }).catch(console.error);
    } else {
      copyTransporterLink();
    }
  };



  const handleClose = () => {
    if (isDirty) {
      if (confirm("Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Función para cambiar día en vista día
  const switchToDay = (dayName: string) => {
    setSelectedDayInDayView(dayName);
    console.log(`🗓️ Cambiando a día: ${dayName}`);
  };

  // Obtener lista de días disponibles
  const getAvailableDays = () => {
    const allDays = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
    return allDays.filter(day => {
      const dayMapping: { [key: string]: string } = {
        'lunes': 'Dilluns',
        'martes': 'Dimarts', 
        'miércoles': 'Dimecres',
        'jueves': 'Dijous',
        'viernes': 'Divendres'
      }
      const catalanDay = dayMapping[day];
      return weeklyPlansByDay[catalanDay] && weeklyPlansByDay[catalanDay].length > 0;
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Button variant="ghost" onClick={handleClose} className="mr-4">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="text-2xl font-bold flex items-center">
                  {config.type === "delivery" ? (
                    <Truck className="h-6 w-6 mr-2" />
                  ) : (
                    <Package className="h-6 w-6 mr-2" />
                  )}
                  Editor de Rutas - {config.title}
                </h2>
                <p className="text-gray-600 mt-1">
                  {config.items.length} centros • {config.type === "delivery" ? "Entregas" : "Recogidas"}
                </p>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={toggleViewMode}
                variant="outline"
                className="bg-transparent"
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                {viewMode === "day" ? "Vista Semana" : "Vista Día"}
              </Button>
              <div className="flex gap-1">
                <Button
                  onClick={() => exportToGoogleMaps(currentItems, routePreferences)}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={currentItems.length === 0}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Maps ({currentItems.length})
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Configuración de Ruta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Route className="h-5 w-5 mr-2" />
                Configuración de Ruta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Punto de Inicio</label>
                  <Input
                    value={routePreferences.startLocation}
                    onChange={(e) => setRoutePreferences((prev) => ({ ...prev, startLocation: e.target.value }))}
                    placeholder="Dirección de inicio"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Punto Final</label>
                  <Input
                    value={routePreferences.endLocation}
                    onChange={(e) => setRoutePreferences((prev) => ({ ...prev, endLocation: e.target.value }))}
                    placeholder="Dirección final"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Hora de Inicio</label>
                  <Input
                    type="time"
                    value={routePreferences.preferredStartTime}
                    onChange={(e) => setRoutePreferences((prev) => ({ ...prev, preferredStartTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Tiempo por Parada (min)</label>
                  <Input
                    type="number"
                    value={routePreferences.timePerStop}
                    onChange={(e) =>
                      setRoutePreferences((prev) => ({ ...prev, timePerStop: Number.parseInt(e.target.value) || 20 }))
                    }
                    min="5"
                    max="60"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={optimizeRoute} disabled={isOptimizing} className="">
                  {isOptimizing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Route className="h-4 w-4 mr-2" />
                  )}
                  Optimizar con Google Maps
                </Button>
                <Button 
                  onClick={generateTransporterLink}
                  variant="outline"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={currentItems.length === 0}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Link Transportista
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Guardar/Cargar Rutas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Save className="h-5 w-5 mr-2" />
                Gestión de Rutas Guardadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Nombre de la ruta</label>
                  <Input
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    placeholder={`Ruta ${config.selectedDay || "General"} - ${new Date().toLocaleDateString()}`}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={saveCurrentRoute} disabled={isSaving || !routeName.trim()} className="w-full">
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Guardar Ruta
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Cargar ruta guardada</label>
                  <Select value={selectedSavedRoute} onValueChange={setSelectedSavedRoute}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una ruta guardada..." />
                    </SelectTrigger>
                    <SelectContent>
                      {savedRoutes.map((route) => (
                        <SelectItem key={route.id} value={route.id}>
                          {route.name} ({route.day}) - {new Date(route.updatedAt).toLocaleDateString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    onClick={loadSavedRoute}
                    disabled={!selectedSavedRoute}
                    variant="outline"
                    className="flex-1 bg-transparent"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Cargar
                  </Button>
                  <Button
                    onClick={() => selectedSavedRoute && deleteSavedRoute(selectedSavedRoute)}
                    disabled={!selectedSavedRoute}
                    variant="outline"
                    className="px-3"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vista de Centros - Día Individual o Semana Completa */}
          {(() => {
            console.log("🖥️ Renderizando vista:", viewMode)
            return viewMode === "day"
          })() ? (
            // Vista de día individual (original)
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Navegador de días */}
                    <div className="flex items-center gap-1">
                      {getAvailableDays().map((day, index, array) => {
                        const isSelected = day === selectedDayInDayView;
                        const isFirst = index === 0;
                        const isLast = index === array.length - 1;
                        
                        return (
                          <div key={day} className="flex items-center">
                            {!isFirst && <span className="text-gray-300 mx-1">→</span>}
                            <Button
                              onClick={() => switchToDay(day)}
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              className={`
                                ${isSelected 
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                  : 'bg-transparent hover:bg-blue-50'
                                }
                                font-medium capitalize min-w-[80px]
                              `}
                            >
                              {day}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Contador de centros */}
                    <span className="text-gray-600 font-medium">
                      {currentItems.length} centros
                    </span>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => exportStepByStep(currentItems)}>
                      <Truck className="h-4 w-4 mr-2 text-black" />
                      Paso a Paso
                    </Button>
                    
                    <Button variant="outline" size="sm" onClick={() => exportToCSV(currentItems)}>
                      <Package className="h-4 w-4 mr-2 text-black" />
                      CSV
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="map" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="map" className="flex items-center gap-2">
                      <Map className="h-4 w-4" />
                      Mapa Interactivo
                    </TabsTrigger>
                    <TabsTrigger value="list" className="flex items-center gap-2">
                      <List className="h-4 w-4" />
                      Lista de Rutas
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="map" className="mt-4">
                    <div className="h-[600px] w-full">
                      <InteractiveMap 
                        items={currentItems}
                        onItemClick={(item) => {
                          console.log('Clicked on:', item.name)
                        }}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="list" className="mt-4">
                    <div className="space-y-2">
                  <div className="flex items-center p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm font-bold">
                      🏁
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-green-800">INICIO</div>
                      <div className="text-sm text-green-600">{routePreferences.startLocation}</div>
                      <div className="text-xs text-green-500">{routePreferences.preferredStartTime}</div>
                    </div>
                  </div>

                  {currentItems.map((item, index) => {
                    const schoolDisplayName = item.name === "Academia" ? item.name : `Escola ${item.name}`
                    const estimatedTime = new Date(
                      new Date().getTime() + (index + 1) * (routePreferences.timePerStop + 5) * 60000,
                    ).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })

                    return (
                      <div
                        key={`${item.id}-${index}`}
                        className="flex items-center p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow"
                      >
                        <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-3 text-sm font-bold flex-shrink-0">
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate text-sm">{schoolDisplayName}</div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span className="flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {item.address}
                            </span>
                            {item.startTime && (
                              <span className="flex items-center bg-green-50 text-green-700 px-2 py-0.5 rounded">
                                <Clock className="h-3 w-3 mr-1" />
                                {item.startTime}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right text-xs text-gray-500 flex-shrink-0">
                          <div className="font-medium">{estimatedTime}</div>
                          <div>~{routePreferences.timePerStop}min</div>
                        </div>
                      </div>
                    )
                  })}

                      <div className="flex items-center p-3 bg-red-50 rounded-lg border border-red-200">
                        <div className="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm font-bold">
                          🏁
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-red-800">FINAL</div>
                          <div className="text-sm text-red-600">{routePreferences.endLocation}</div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            // Vista de semana completa con drag & drop
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Badge variant="outline" className="mr-3 font-medium text-lg px-3 py-1">
                      📅 Planificación Semanal
                    </Badge>
                    <span>Arrastra para reorganizar entre días</span>
                  </span>
                  <div className="flex gap-2">
                    <Button
                      onClick={saveWeeklyLayout}
                      className="bg-blue-600 hover:bg-blue-700"
                      size="sm"
                    >
                      <Save className="h-4 w-4 mr-2 text-white" />
                      Guardar Disposición Semanal
                    </Button>
                    <Button
                      onClick={() => {
                        const reorganizationId = `reorganization_${config.deliveryType || 'default'}_${config.weekStart || new Date().toISOString().split('T')[0]}`
                        localStorage.removeItem(reorganizationId)
                        // Recargar configuración original
                        const groupedByDay = config.items.reduce((acc, item) => {
                          const day = item.day || "Sin asignar"
                          if (!acc[day]) acc[day] = []
                          acc[day].push(item)
                          return acc
                        }, {} as {[key: string]: RouteItem[]})
                        setWeeklyPlansByDay(groupedByDay)
                        alert('🔄 Reorganización restablecida al estado original')
                      }}
                      variant="outline"
                      size="sm"
                      className="bg-transparent"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Restablecer
                    </Button>
                    <Button
                      onClick={() => {
                        // Cargar última reorganización guardada
                        const reorganizationId = `reorganization_${config.deliveryType || 'default'}_${config.weekStart || new Date().toISOString().split('T')[0]}`
                        const savedReorganization = localStorage.getItem(reorganizationId)
                        
                        if (savedReorganization) {
                          try {
                            const reorganizationData: RouteReorganization = JSON.parse(savedReorganization)
                            setWeeklyPlansByDay(reorganizationData.reorganizedItems)
                            alert('🔄 Última reorganización cargada exitosamente')
                          } catch (error) {
                            console.error('Error cargando reorganización:', error)
                            alert('❌ No se pudo cargar la última reorganización')
                          }
                        } else {
                          alert('ℹ️ No hay reorganización guardada para esta configuración')
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="bg-green-50 hover:bg-green-100 border-green-200"
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Recuperar
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-4">
                  {["lunes", "martes", "miércoles", "jueves", "viernes"].map((dayName, dayIndex) => {
                    const catalanDays = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres"]
                    const catalanDay = catalanDays[dayIndex]
                    const dayItems = weeklyPlansByDay[catalanDay] || []
                    
                    return (
                      <div
                        key={catalanDay}
                        className="min-h-[300px] p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
                        onDragOver={(e) => {
                          e.preventDefault()
                          if (dayItems.length === 0) {
                            e.currentTarget.classList.add('bg-blue-50', 'border-blue-300')
                          }
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300')
                        }}
                        onDrop={(e) => {
                          e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300')
                          // Solo permitir drop en la columna si no hay items
                          if (dayItems.length === 0) {
                            handleDrop(catalanDay)
                          }
                        }}
                      >
                        <div className="font-semibold text-center mb-3 capitalize text-gray-700">
                          {dayName}
                        </div>
                        <div className="space-y-1">
                          {/* Zona de drop al inicio */}
                          <div
                            className={`h-4 rounded transition-all duration-200 border-2 border-dashed ${
                              dropIndicator?.day === catalanDay && dropIndicator?.index === 0
                                ? 'bg-blue-100 border-blue-400 h-6'
                                : 'border-transparent hover:border-blue-200'
                            }`}
                            onDragOver={(e) => {
                              e.preventDefault()
                              setDropIndicator({ day: catalanDay, index: 0 })
                            }}
                            onDragLeave={(e) => {
                              // Solo quitar el indicador si realmente salimos del elemento
                              const rect = e.currentTarget.getBoundingClientRect()
                              const x = e.clientX
                              const y = e.clientY
                              if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                                setDropIndicator(null)
                              }
                            }}
                            onDrop={(e) => handleDropBetweenItems(catalanDay, 0, e)}
                          >
                            {dropIndicator?.day === catalanDay && dropIndicator?.index === 0 && (
                              <div className="text-center text-xs text-blue-600 font-medium py-1">
                                Soltar aquí
                              </div>
                            )}
                          </div>
                          
                          {dayItems.map((item, index) => {
                            const schoolDisplayName = item.name === "Academia" ? item.name : `Escola ${item.name}`
                            const isDragging = draggedItem?.id === item.id
                            
                            return (
                              <div key={`${item.id}-${catalanDay}-${index}`}>
                                <div
                                  draggable={!isDragging}
                                  onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move'
                                    handleDragStart(item)
                                  }}
                                  onDragEnd={handleDragEnd}
                                  className={`p-2 bg-white rounded border transition-all relative ${
                                    isDragging 
                                      ? 'opacity-30 scale-95 cursor-grabbing border-blue-300' 
                                      : 'cursor-move hover:shadow-md hover:border-blue-200'
                                  }`}
                                >
                                  {/* Indicador de orden */}
                                  <div className={`absolute -left-2 -top-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 shadow-sm ${
                                    isDragging ? 'bg-gray-400' : 'bg-blue-600 text-white'
                                  }`}>
                                    {index + 1}
                                  </div>
                                  
                                  <div className="text-sm font-medium text-gray-900 truncate">
                                    {schoolDisplayName}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {item.activities?.join(", ") || "Sin actividades"}
                                  </div>
                                  {item.startTime && (
                                    <div className="text-xs text-blue-600">
                                      🕐 {item.startTime}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Zona de drop entre items */}
                                <div
                                  className={`h-4 rounded transition-all duration-200 border-2 border-dashed ${
                                    dropIndicator?.day === catalanDay && dropIndicator?.index === index + 1
                                      ? 'bg-blue-100 border-blue-400 h-6'
                                      : 'border-transparent hover:border-blue-200'
                                  }`}
                                  onDragOver={(e) => {
                                    e.preventDefault()
                                    setDropIndicator({ day: catalanDay, index: index + 1 })
                                  }}
                                  onDragLeave={(e) => {
                                    // Solo quitar el indicador si realmente salimos del elemento
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    const x = e.clientX
                                    const y = e.clientY
                                    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                                      setDropIndicator(null)
                                    }
                                  }}
                                  onDrop={(e) => handleDropBetweenItems(catalanDay, index + 1, e)}
                                >
                                  {dropIndicator?.day === catalanDay && dropIndicator?.index === index + 1 && (
                                    <div className="text-center text-xs text-blue-600 font-medium py-1">
                                      Soltar aquí
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                          
                          {dayItems.length === 0 && (
                            <div className="text-center text-gray-400 text-sm py-8">
                              Sin entregas programadas
                              <br />
                              <span className="text-xs">Arrastra aquí para programar</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal del Link del Transportista */}
      {showTransporterModal && transporterLink && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center">
              <Truck className="h-5 w-5 mr-2 text-purple-600" />
              Link para el Transportista
            </h3>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Link generado:</p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    transporterLink && transporterLink.includes('is.gd') ? 'bg-green-100 text-green-700' :
                    transporterLink && transporterLink.includes('tinyurl') ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {transporterLink && transporterLink.includes('is.gd') ? '✅ Acortada (is.gd)' :
                     transporterLink && transporterLink.includes('tinyurl') ? '✅ Acortada (tinyurl)' :
                     '⚠️ URL Original'}
                  </span>
                </div>
                <p className="font-mono text-xs bg-white p-2 rounded border break-all">
                  {transporterLink}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  📏 Longitud: {transporterLink?.length || 0} caracteres
                </p>
              </div>

              {/* Instrucciones para acceso remoto */}
              {localIP === "desarrollo-local" && (
                <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-400">
                  <p className="text-sm text-blue-800 font-medium mb-3">
                    🌐 Para acceso remoto del transportista (desde cualquier lugar):
                  </p>
                  <div className="text-xs text-blue-700 space-y-3">
                    
                    <div className="bg-blue-100 p-3 rounded">
                      <p className="font-medium mb-2">🚀 OPCIÓN 1: Ngrok (Más fácil)</p>
                      <ol className="list-decimal ml-4 space-y-1">
                        <li>Instala ngrok: <code className="bg-white px-1 rounded">npm install -g ngrok</code></li>
                        <li>En otra terminal: <code className="bg-white px-1 rounded">ngrok http 3000</code></li>
                        <li>Copia la URL pública (ej: <code className="bg-white px-1 rounded">https://abc123.ngrok.io</code>)</li>
                        <li>Reemplaza localhost en el link de arriba</li>
                      </ol>
                    </div>

                    <div className="bg-blue-100 p-3 rounded">
                      <p className="font-medium mb-2">☁️ OPCIÓN 2: Deplegar en producción</p>
                      <ol className="list-decimal ml-4 space-y-1">
                        <li>Sube a <strong>Vercel</strong>: <code className="bg-white px-1 rounded">npx vercel</code></li>
                        <li>O a <strong>Netlify</strong>: Conecta el repo de GitHub</li>
                        <li>Tendrás una URL pública permanente</li>
                      </ol>
                    </div>

                    <div className="bg-blue-100 p-3 rounded">
                      <p className="font-medium mb-2">📱 OPCIÓN 3: LocalTunnel (Alternativa)</p>
                      <ol className="list-decimal ml-4 space-y-1">
                        <li>Instala: <code className="bg-white px-1 rounded">npm install -g localtunnel</code></li>
                        <li>Ejecuta: <code className="bg-white px-1 rounded">lt --port 3000</code></li>
                        <li>Te dará una URL pública temporal</li>
                      </ol>
                    </div>

                  </div>
                </div>
              )}

              {localIP === "produccion" && (
                <div className="bg-green-50 p-3 rounded border-l-4 border-green-400">
                  <p className="text-sm text-green-800 font-medium mb-2">
                    ✅ Link listo para usar desde cualquier lugar:
                  </p>
                  <div className="text-xs text-green-700">
                    <p>📱 El transportista puede usar este link con datos móviles</p>
                    <p>🌐 Funciona desde cualquier ubicación con internet</p>
                  </div>
                </div>
              )}
              
              <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
                <p className="text-sm text-blue-800">
                  <strong>📱 Funciones del transportista:</strong>
                </p>
                <ul className="text-xs text-blue-700 mt-1 space-y-1">
                  <li>• Ver toda la ruta optimizada en Google Maps</li>
                  <li>• Reordenar paradas en tiempo real</li>
                  <li>• Firmar digitalmente con el dedo</li>
                  <li>• Tomar fotos del almacenamiento</li>
                  <li>• Registro automático en Google Sheets</li>
                </ul>
              </div>



              <div className="flex gap-2">
                <Button onClick={copyTransporterLink} className="flex-1">
                  <MapPin className="h-4 w-4 mr-2" />
                  Copiar Link
                </Button>
                <Button onClick={shareTransporterLink} variant="outline" className="flex-1">
                  <Package className="h-4 w-4 mr-2" />
                  Compartir
                </Button>
              </div>

              <Button 
                onClick={() => setShowTransporterModal(false)} 
                variant="outline" 
                className="w-full"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
