"use client"

import { useState, useMemo, useEffect, useCallback, memo, useRef } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  MapPin,
  CalendarIcon,
  Clock,
  Package,
  CheckCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Navigation,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Users,
  Euro,
  Truck,
  Plus,
  Route,
  X,
  FolderOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from "date-fns"
import { es } from "date-fns/locale"
import RouteEditor from "@/components/route-editor"
import { useProjects, type Project } from "@/lib/useProjects"

// Tipos de datos existentes
interface School {
  name: string
  address: string
  activities: string[]
  daysWithActivities: string[]
  lastActivityDay: string
  coordinates: { lat: number; lng: number }
  completed: boolean
  monitor?: string
  turn?: string
  totalStudents?: number
  price?: number
  commission?: number
  courseStart?: string
  courseEnd?: string
}

// Nuevos tipos para entregas
interface DeliverySchool {
  name: string
  address: string
  location?: string
  courseStart: Date
  activities: {
    [day: string]: Array<{
      turn: string
      activity: string
      courseStart: Date
      startTime?: string // Añadir hora de inicio
      totalStudents?: number // Añadir número de alumnos
    }>
  }
}

interface DeliveryPlan {
  school: DeliverySchool
  deliveryDate: Date
  deliveryDay: string
  activities: Array<{
    day: string
    turn: string
    activity: string
    startTime?: string // Añadir hora de inicio
    totalStudents?: number // Añadir número de alumnos
  }>
  consolidated: boolean
  reason: string
}

interface Holiday {
  date: Date
  name: string
}

type DeliveryType = "inicio-curso" | "trimestral" | "puntual"

interface GoogleSheetRow {
  [key: string]: string
}

// Componente memoizado para SchoolCard para evitar re-renders innecesarios
const SchoolCard = memo(({ 
  school, 
  index, 
  materials, 
  expandedSchool, 
  setExpandedSchool, 
  toggleCompleted 
}: {
  school: School
  index: number
  materials: string[]
  expandedSchool: string | null
  setExpandedSchool: (name: string | null) => void
  toggleCompleted: (name: string) => void
}) => {
  const handleToggle = useCallback(() => {
    toggleCompleted(school.name)
  }, [school.name, toggleCompleted])
  
  const handleExpand = useCallback(() => {
    setExpandedSchool(expandedSchool === school.name ? null : school.name)
  }, [school.name, expandedSchool, setExpandedSchool])

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-200",
        school.completed ? "bg-gray-100 border-gray-200" : "bg-white",
      )}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
              {index + 1}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{school.name}</h3>
              <p className="text-sm text-gray-600">{school.address}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant={school.completed ? "secondary" : "outline"}
              onClick={handleToggle}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {school.completed ? "Completado" : "Marcar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleExpand}>
              {expandedSchool === school.name ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {materials.slice(0, 3).map((material) => (
            <Badge key={material} className="bg-blue-100 text-blue-800 hover:bg-blue-200 text-sm">
              {material}
            </Badge>
          ))}
          {materials.length > 3 && (
            <Badge variant="outline" className="text-sm">
              +{materials.length - 3} más
            </Badge>
          )}
        </div>
        {school.monitor && (
          <div className="mt-2 flex items-center text-sm text-gray-600">
            <Users className="h-4 w-4 mr-1" />
            Monitor: {school.monitor}
          </div>
        )}
        {school.totalStudents && (
          <div className="mt-1 flex items-center text-sm text-gray-600">
            <Users className="h-4 w-4 mr-1" />
            Alumnos: {school.totalStudents}
          </div>
        )}
        {school.price && (
          <div className="mt-1 flex items-center text-sm text-green-600">
            <Euro className="h-4 w-4 mr-1" />
            Precio: {school.price}€
          </div>
        )}
      </CardHeader>

      {expandedSchool === school.name && (
        <CardContent className="pt-0">
          <div className="space-y-3 mt-2">
            <div>
              <h4 className="font-medium mb-2">Días con actividades:</h4>
              <div className="flex flex-wrap gap-1 mb-2">
                {school.daysWithActivities.map((day) => (
                  <Badge key={day} variant="outline" className="text-xs">
                    {day}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Último día:</span> {school.lastActivityDay}
              </p>
            </div>

            <div>
              <h4 className="font-medium mb-2">Actividades:</h4>
              <div className="flex flex-wrap gap-2">
                {school.activities.map((activity) => (
                  <Badge key={activity} variant="secondary" className="text-sm font-mono">
                    {activity}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Materiales a recoger:</h4>
              <div className="flex flex-wrap gap-2">
                {materials.map((material) => (
                  <Badge
                    key={material}
                    className="bg-blue-100 text-blue-800 hover:bg-blue-200 text-sm"
                  >
                    {material}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
})

SchoolCard.displayName = 'SchoolCard'

// Custom hook para búsqueda con debounce
function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Hook para optimizar re-renders costosos
function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef<T>(callback)
  callbackRef.current = callback
  
  return useCallback<T>((...args: any[]) => {
    return callbackRef.current(...args)
  }, []) as T
}

// Mapeo de códigos de actividades SOLO a materiales
const activityMapping = {
  TC: ["Material TC"],
  CO: ["Material CO"],
  JC: ["Material JC"],
  DX: ["Material DX"],
}

// Configuración de Google Sheets
const GOOGLE_SHEETS_CONFIG = {
  SHEET_ID: "1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I",
  SHEET_NAME: "Dades",
}

// Datos de ejemplo como fallback
const FALLBACK_DATA: School[] = [
  {
    name: "Escola Exemple 1",
    address: "Carrer Exemple, 123",
    activities: ["TC1", "CO2"],
    daysWithActivities: ["Dilluns", "Dimarts"],
    lastActivityDay: "Dimarts",
    coordinates: { lat: 41.3851, lng: 2.1734 },
    completed: false,
    monitor: "Monitor Exemple",
    totalStudents: 25,
    price: 150,
  },
  {
    name: "Escola Exemple 2",
    address: "Avinguda Exemple, 456",
    activities: ["JC1", "DX2"],
    daysWithActivities: ["Dimecres", "Dijous"],
    lastActivityDay: "Dijous",
    coordinates: { lat: 41.3901, lng: 2.1784 },
    completed: false,
    monitor: "Monitor Exemple 2",
    totalStudents: 30,
    price: 180,
  },
]

// Función para obtener datos del Google Sheet usando SOLO CSV público
async function fetchGoogleSheetData(): Promise<GoogleSheetRow[]> {
  try {
    console.log("🔄 Cargando datos desde CSV público...")

    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_CONFIG.SHEET_ID}/export?format=csv&gid=0`
    console.log("📡 URL CSV:", csvUrl)

    const response = await fetch(csvUrl, {
      method: "GET",
      headers: {
        Accept: "text/csv",
        "User-Agent": "Mozilla/5.0 (compatible; Barcelona-Route-App/1.0)",
      },
    })

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("❌ El Google Sheet no es público. Ve a Compartir → 'Cualquiera con el enlace puede ver'")
      } else if (response.status === 404) {
        throw new Error("❌ No se encontró el Google Sheet. Verifica el ID del sheet.")
      } else {
        throw new Error(`❌ Error ${response.status}: ${response.statusText}`)
      }
    }

    const csvText = await response.text()
    console.log("✅ CSV recibido, longitud:", csvText.length)

    if (!csvText || csvText.trim().length === 0) {
      throw new Error("❌ El CSV está vacío. Verifica que el Google Sheet tenga datos.")
    }

    const lines = csvText.split("\n").filter((line) => line.trim().length > 0)

    if (lines.length === 0) {
      throw new Error("❌ No se encontraron líneas válidas en el CSV")
    }

    const headerLine = lines[0]
    const headers = parseCSVLine(headerLine)

    console.log("📋 Headers encontrados:", headers)

    // Debug: mostrar todas las columnas para identificar la de hora
    console.log(
      "🔍 Columnas que contienen 'HORA' o 'INICI':",
      headers.filter((h) => h.toUpperCase().includes("HORA") || h.toUpperCase().includes("INICI")),
    )

    if (headers.length === 0) {
      throw new Error("❌ No se encontraron headers en el CSV")
    }

    const dataRows = lines.slice(1)
    console.log(`📊 Procesando ${dataRows.length} filas de datos`)

    const result = dataRows
      .map((line, index) => {
        try {
          const values = parseCSVLine(line)
          const rowObject: GoogleSheetRow = {}

          headers.forEach((header, headerIndex) => {
            rowObject[header] = values[headerIndex] || ""
          })

          return rowObject
        } catch (error) {
          console.warn(`⚠️ Error procesando fila ${index + 2}:`, error)
          return null
        }
      })
      .filter((row) => row !== null) as GoogleSheetRow[]

    console.log(`✅ Datos procesados exitosamente: ${result.length} filas`)
    return result
  } catch (error) {
    console.error("❌ Error cargando datos CSV:", error)
    throw error
  }
}

// Función auxiliar para parsear líneas CSV correctamente
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result.map((field) => field.replace(/^"|"$/g, ""))
}

// Función para procesar datos para recogidas (existente)
function processGoogleSheetData(sheetData: GoogleSheetRow[]): School[] {
  const schools: School[] = []

  sheetData.forEach((row) => {
    const name = row["ESCOLA"] || ""
    const address = row["ADREÇA"] || row["UBICACIÓ"] || ""
    const day = row["DIA"] || ""
    const activity = row["ACTIVITAT"] || ""
    const monitor = row["MONITORA"] || ""
    const turn = row["TORN"] || ""
    const totalStudents = Number.parseInt(row["TOTAL ALUMNES"] || "0") || 0
    const price = Number.parseFloat(row["PREU"] || "0") || 0
    const commission = Number.parseFloat(row["COMISSIÓ"] || "0") || 0
    const courseStart = row["INICI CURS"] || ""
    const courseEnd = row["FINAL CURS"] || ""

    if (!name || !address) {
      return
    }

    const days = day ? [day.trim()] : []
    const activities = activity ? [activity.trim()] : []

    if (days.length === 0 || activities.length === 0) {
      return
    }

    const existingSchool = schools.find((school) => school.name === name)

    if (existingSchool) {
      if (!existingSchool.daysWithActivities.includes(day)) {
        existingSchool.daysWithActivities.push(day)
      }
      if (!existingSchool.activities.includes(activity)) {
        existingSchool.activities.push(activity)
      }
      existingSchool.lastActivityDay = getLastDay(existingSchool.daysWithActivities)
    } else {
      const lastDay = getLastDay(days)

      schools.push({
        name,
        address,
        activities,
        daysWithActivities: days,
        lastActivityDay: lastDay,
        coordinates: getCoordinates(name),
        completed: false,
        monitor,
        turn,
        totalStudents,
        price,
        commission,
        courseStart,
        courseEnd,
      })
    }
  })

  return schools
}

// Corregir la función processDeliveryData para manejar correctamente los días
function processDeliveryData(sheetData: GoogleSheetRow[]): DeliverySchool[] {
  const schoolsMap = new Map<string, DeliverySchool>()

  console.log("🔍 Procesando datos para entregas...")
  console.log("Headers disponibles:", Object.keys(sheetData[0] || {}))

  sheetData.forEach((row, index) => {
    const name = row["ESCOLA"] || ""
    const address = row["ADREÇA"] || row["UBICACIÓ"] || ""
    const day = row["DIA"] || ""
    const activity = row["ACTIVITAT"] || ""
    const turn = row["TORN"] || ""
    const courseStartStr = row["INICI CURS"] || ""
    const location = row["ADREÇA"] || row["UBICACIÓ"] || ""
    const startTime = row["HORA INICI"] || ""
    const totalStudents = Number.parseInt(row["TOTAL ALUMNES"] || "0") || 0

    console.log(`📝 Fila ${index + 1}:`, {
      name,
      day,
      activity,
      turn,
      courseStartStr,
      startTime,
    })

    // Debug específico para Escola Proa
    if (name === "Proa") {
      console.log(`🔍 PROA DEBUG - Fila ${index + 1}:`)
      console.log(`   Fecha string original: "${courseStartStr}"`)
      console.log(`   Incluye "/": ${courseStartStr.includes("/")}`)
      if (courseStartStr.includes("/")) {
        const parts = courseStartStr.split("/")
        console.log(`   Partes: [${parts.join(", ")}]`)
      }
    }

    if (!name || !day || !activity) {
      console.warn(`⚠️ Fila ${index + 1} incompleta, saltando...`)
      return
    }

    // Parsear fecha de inicio de curso
    let courseStart: Date
    try {
      if (courseStartStr && courseStartStr.trim()) {
        console.log(`📅 Parseando fecha "${courseStartStr}" para ${name}`)
        
        // Intentar diferentes formatos de fecha
        if (courseStartStr.includes("/")) {
          const parts = courseStartStr.split("/")
          console.log(`   Partes de la fecha: ${parts}`)
          
          if (parts.length === 3) {
            const day = Number.parseInt(parts[0])
            const month = Number.parseInt(parts[1]) - 1
            let year = Number.parseInt(parts[2])
            if (year < 100) year += 2000
            
            console.log(`   Parseado: día=${day}, mes=${month}, año=${year}`)
            courseStart = new Date(year, month, day)
            console.log(`   Fecha resultante: ${courseStart}`)
          } else {
            throw new Error("Invalid date format")
          }
        } else if (courseStartStr.includes("-")) {
          courseStart = new Date(courseStartStr)
          console.log(`   Fecha ISO parseada: ${courseStart}`)
        } else {
          throw new Error("Unknown date format")
        }

        if (isNaN(courseStart.getTime())) {
          throw new Error("Invalid date")
        }
        
        console.log(`✅ ${name}: Fecha de inicio parseada correctamente: ${courseStart}`)
      } else {
        courseStart = new Date()
        console.log(`⚠️ ${name}: Sin fecha de inicio, usando fecha actual`)
      }
    } catch (error) {
      console.warn(`❌ Error parsing date "${courseStartStr}" for school "${name}":`, error)
      courseStart = new Date()
    }

    // Crear o actualizar escuela
    if (!schoolsMap.has(name)) {
      schoolsMap.set(name, {
        name,
        address: address || `Escola ${name}`, // Fallback si no hay dirección
        location,
        courseStart,
        activities: {},
      })
    } else {
      // Si la escuela ya existe, mantener su fecha de inicio original
      // No actualizamos courseStart para evitar sobrescribir con fechas de otras actividades
    }

    const school = schoolsMap.get(name)!

    // Inicializar día si no existe
    if (!school.activities[day]) {
      school.activities[day] = []
    }

    // Añadir actividad al día correspondiente
    school.activities[day].push({
      turn,
      activity,
      courseStart,
      startTime,
      totalStudents,
    })

    console.log(`✅ Añadida actividad ${activity} para ${name} el ${day}`)
  })

  const result = Array.from(schoolsMap.values())
  console.log(`📊 Procesadas ${result.length} escuelas para entregas`)

  // Debug: mostrar resumen por escuela
  console.log("📋 ESCUELAS PROCESADAS EN TOTAL:")
  result.forEach((school) => {
    const totalActivities = Object.values(school.activities).flat().length
    const days = Object.keys(school.activities).join(", ")
    console.log(`🏫 ${school.name}: ${totalActivities} actividades en días: ${days}`)
  })

  // Debug específico: verificar escuelas problemáticas
  const problematicSchools = ["Llacuna", "FructuosGelabert", "TuroBlau", "BetaniaPatmos", "TrentaPassos"]
  problematicSchools.forEach((schoolName) => {
    const school = result.find(s => s.name === schoolName)
    if (school) {
      console.log(`✅ ENCONTRADA: ${schoolName} con ${Object.values(school.activities).flat().length} actividades`)
    } else {
      console.log(`❌ NO ENCONTRADA: ${schoolName}`)
    }
  })

  return result
}

// Funciones auxiliares existentes
function getLastDay(days: string[]): string {
  const dayOrder = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres"]
  let lastIndex = -1

  days.forEach((day) => {
    const index = dayOrder.indexOf(day)
    if (index > lastIndex) {
      lastIndex = index
    }
  })

  return dayOrder[lastIndex] || "Dilluns"
}

function getCoordinates(schoolName: string) {
  const baseCoords = { lat: 41.3851, lng: 2.1734 }
  const hash = schoolName.split("").reduce((a, b) => a + b.charCodeAt(0), 0)

  return {
    lat: baseCoords.lat + ((hash % 100) - 50) * 0.001,
    lng: baseCoords.lng + ((hash % 100) - 50) * 0.001,
  }
}

// Cache para memoización de materiales
const materialsCache = new Map<string, string[]>()

function getMaterialsForActivities(activities: string[]): string[] {
  const cacheKey = activities.sort().join(',')
  
  if (materialsCache.has(cacheKey)) {
    return materialsCache.get(cacheKey)!
  }
  
  const materials = new Set<string>()

  activities.forEach((activity) => {
    const activityCode = activity.replace(/\d+[A-Z]?$/, "")
    const activityMaterials = activityMapping[activityCode as keyof typeof activityMapping]

    if (activityMaterials) {
      activityMaterials.forEach((material) => materials.add(material))
    } else {
      materials.add(`Material ${activity}`)
    }
  })

  const result = Array.from(materials)
  materialsCache.set(cacheKey, result)
  return result
}

// Cache para nombres de actividades
const activityNamesCache = new Map<string, string[]>()

function getActivityNames(activities: string[]): string[] {
  const cacheKey = activities.sort().join(',')
  
  if (activityNamesCache.has(cacheKey)) {
    return activityNamesCache.get(cacheKey)!
  }
  
  const result = [...activities]
  activityNamesCache.set(cacheKey, result)
  return result
}

function getCollectionDay(lastActivityDay: string): "jueves" | "viernes" | null {
  const dayMapping = {
    Dilluns: "jueves",
    Dimarts: "jueves",
    Dimecres: "jueves",
    Dijous: "viernes",
    Divendres: "viernes",
  }

  return (dayMapping[lastActivityDay as keyof typeof dayMapping] as "jueves" | "viernes") || null
}

// Nueva función generateDeliveryPlan - CONSOLIDADA POR CENTRO
function generateDeliveryPlan(
  schools: DeliverySchool[],
  selectedWeek: Date,
  deliveryType: DeliveryType,
  holidays: Holiday[],
): DeliveryPlan[] {
  console.log("🗓️ Generando plan de entregas consolidado...")
  console.log("Tipo de entrega:", deliveryType)
  console.log("Semana seleccionada:", selectedWeek)
  console.log("Escuelas a procesar:", schools.length)

  if (!selectedWeek || isNaN(selectedWeek.getTime())) {
    console.warn("Invalid selectedWeek date, using current date")
    selectedWeek = new Date()
  }

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 })

  console.log("Inicio de semana:", weekStart)
  console.log("Fin de semana:", weekEnd)

  // Mapeo de días en catalán a índices de la semana
  const dayMapping = {
    Dilluns: 0, // Lunes
    Dimarts: 1, // Martes
    Dimecres: 2, // Miércoles
    Dijous: 3, // Jueves
    Divendres: 4, // Viernes
  }

  // Obtener días laborables sin festivos
  const getAvailableDays = () => {
    const availableDays: { name: string; index: number; date: Date }[] = []
    
    Object.entries(dayMapping).forEach(([dayName, dayIndex]) => {
      const dayDate = addDays(weekStart, dayIndex)
      
      // Verificar si es festivo
      const isHoliday = holidays.some((holiday) => {
        try {
          return holiday.date && !isNaN(holiday.date.getTime()) && isSameDay(holiday.date, dayDate)
        } catch {
          return false
        }
      })
      
      if (!isHoliday && dayDate >= weekStart && dayDate <= weekEnd) {
        availableDays.push({ name: dayName, index: dayIndex, date: dayDate })
      }
    })
    
    return availableDays
  }

  const availableDays = getAvailableDays()
  console.log("📅 Días disponibles:", availableDays.map(d => d.name))

  if (availableDays.length === 0) {
    console.warn("❌ No hay días laborables disponibles en la semana")
    return []
  }

  // Filtrar actividades válidas por escuela (en lugar de filtrar escuelas completas)
  const validSchools: DeliverySchool[] = []
  
  schools.forEach((school) => {
    console.log(`\n🔍 PROCESANDO: ${school.name}`)
    
    // Crear escuela filtrada con solo las actividades válidas
    const filteredSchool: DeliverySchool = {
      name: school.name,
      address: school.address,
      location: school.location,
      courseStart: school.courseStart,
      activities: {}
    }
    
    let hasValidActivities = false
    
    // Procesar cada día de actividades
    Object.entries(school.activities).forEach(([day, dayActivities]) => {
      const validActivities = dayActivities.filter((activity) => {
        // En modo trimestral, todas las actividades son válidas (no depende de fecha de inicio)
        if (deliveryType === "trimestral") {
          return true
        }

        // En modo inicio-curso, verificar fecha de inicio
        if (!activity.courseStart || isNaN(activity.courseStart.getTime())) {
          return false
        }

        if (deliveryType === "inicio-curso") {
          try {
            const activityWeekStart = startOfWeek(activity.courseStart, { weekStartsOn: 1 })
            console.log(`      Semana actividad: ${activityWeekStart.toISOString().split('T')[0]}`)
            console.log(`      Semana seleccionada: ${weekStart.toISOString().split('T')[0]}`)
            
            // Comparar si las fechas de inicio de semana son iguales
            const sameWeek = activityWeekStart.getTime() === weekStart.getTime()
            console.log(`      ¿Misma semana?: ${sameWeek}`)
            
            if (!sameWeek) {
              console.log(`      ❌ No empieza en la semana seleccionada`)
              return false
            }
          } catch (error) {
            console.warn(`      ❌ Error procesando fecha de inicio:`, error)
            return false
          }
        }
        
        console.log(`      ✅ Actividad válida`)
        return true
      })
      
      // Si hay actividades válidas para este día, agregarlas
      if (validActivities.length > 0) {
        filteredSchool.activities[day] = validActivities
        hasValidActivities = true
        console.log(`   ✅ ${validActivities.length} actividades válidas el ${day}`)
      }
    })
    
    // Solo agregar la escuela si tiene al menos una actividad válida
    if (hasValidActivities) {
      // Actualizar la fecha de inicio del curso con la primera actividad válida
      const firstValidActivity = Object.values(filteredSchool.activities).flat()[0]
      filteredSchool.courseStart = firstValidActivity.courseStart
      
      validSchools.push(filteredSchool)
      console.log(`✅ ${school.name}: VÁLIDA con actividades filtradas`)
    } else {
      console.log(`❌ ${school.name}: Sin actividades válidas para la semana seleccionada`)
    }
  })

  console.log(`✅ Escuelas con actividades válidas: ${validSchools.length}`)

  // CONSOLIDAR: Una entrega por centro en el PRIMER DÍA con actividades (no festivo)
  const deliveryPlans: DeliveryPlan[] = []
  const centersByDay: { [key: string]: DeliveryPlan[] } = {}

  validSchools.forEach((school, schoolIndex) => {
    console.log(`\n🏫 Procesando escuela: ${school.name}`)

    const schoolDays = Object.keys(school.activities)
    console.log(`Días con actividades: ${schoolDays.join(", ")}`)

    // Consolidar TODAS las actividades de la semana en una sola entrega
    const allActivities: Array<{ day: string; turn: string; activity: string; startTime?: string; totalStudents?: number }> = []

    schoolDays.forEach((dayName) => {
      const dayActivities = school.activities[dayName] || []
      dayActivities.forEach((activityInfo) => {
        allActivities.push({
          day: dayName,
          turn: activityInfo.turn,
          activity: activityInfo.activity,
          startTime: activityInfo.startTime,
          totalStudents: activityInfo.totalStudents,
        })
      })
    })

    if (allActivities.length === 0) {
      console.log(`❌ ${school.name} no tiene actividades válidas`)
      return
    }

    // BUSCAR EL PRIMER DÍA LABORABLE (NO FESTIVO) CON ACTIVIDADES
    const dayOrder = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres"]
    let deliveryDay: { name: string; index: number; date: Date } | null = null

    // Recorrer días de la semana en orden cronológico
    for (const dayName of dayOrder) {
      // Verificar si este centro tiene actividades este día
      if (schoolDays.includes(dayName)) {
        // Verificar si este día está disponible (no es festivo)
        const availableDay = availableDays.find(d => d.name === dayName)
        
        if (availableDay) {
          deliveryDay = availableDay
          console.log(`📅 ${school.name} → Primer día laborable con actividades: ${dayName}`)
          break
        } else {
          console.log(`🚫 ${school.name} → ${dayName} es festivo o no disponible`)
        }
      }
    }

    // Si no encontramos ningún día laborable con actividades, posponer
    if (!deliveryDay) {
      console.log(`⏭️ ${school.name} → No hay días laborables con actividades, posponiendo a siguiente semana`)
      console.log(`   Días con actividades: ${schoolDays.join(", ")}`)
      console.log(`   Días laborables disponibles: ${availableDays.map(d => d.name).join(", ")}`)
      return
    }

    console.log(`📅 ${school.name} → Entrega programada: ${deliveryDay.name}`)

    // Crear plan consolidado
    const deliveryPlan: DeliveryPlan = {
      school,
      deliveryDate: deliveryDay.date,
      deliveryDay: deliveryDay.name,
      activities: allActivities,
      consolidated: true,
      reason: `Consolidado en primer día laborable: ${allActivities.length} actividades de ${schoolDays.length} días`,
    }

    deliveryPlans.push(deliveryPlan)

    // Actualizar contador por día
    if (!centersByDay[deliveryDay.name]) {
      centersByDay[deliveryDay.name] = []
    }
    centersByDay[deliveryDay.name].push(deliveryPlan)

    console.log(`✅ Plan consolidado creado para ${school.name} el ${deliveryDay.name}`)
  })

  // Ordenar por fecha de entrega
  const sortedPlans = deliveryPlans.sort((a, b) => a.deliveryDate.getTime() - b.deliveryDate.getTime())

  console.log(`\n📋 RESUMEN FINAL CONSOLIDADO:`)
  console.log(`Total centros: ${sortedPlans.length}`)
  console.log(`Días utilizados: ${Object.keys(centersByDay).length}`)

  // Mostrar distribución equilibrada
  Object.entries(centersByDay).forEach(([day, plans]) => {
    console.log(`${day}: ${plans.length} centros`)
    plans.forEach((plan) => {
      const totalActivities = plan.activities.length
      const uniqueDays = [...new Set(plan.activities.map(a => a.day))].length
      console.log(`  - ${plan.school.name}: ${totalActivities} actividades de ${uniqueDays} días`)
    })
  })

  return sortedPlans
}

// Nuevas funciones para el sistema de entregas
function generateDeliveryPlanOld(
  schools: DeliverySchool[],
  selectedWeek: Date,
  deliveryType: DeliveryType,
  holidays: Holiday[],
): DeliveryPlan[] {
  // Verificar que selectedWeek sea una fecha válida
  if (!selectedWeek || isNaN(selectedWeek.getTime())) {
    console.warn("Invalid selectedWeek date, using current date")
    selectedWeek = new Date()
  }

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }) // Lunes
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 }) // Domingo

  const deliveryPlans: DeliveryPlan[] = []

  schools.forEach((school) => {
    // Verificar que la fecha de inicio del curso sea válida
    if (!school.courseStart || isNaN(school.courseStart.getTime())) {
      console.warn(`Invalid course start date for school ${school.name}, using current date`)
      school.courseStart = new Date()
    }

    // Filtrar escuelas según tipo de entrega
    if (deliveryType === "inicio-curso") {
      try {
        const courseWeekStart = startOfWeek(school.courseStart, { weekStartsOn: 1 })
        if (!isSameDay(weekStart, courseWeekStart)) {
          return // Solo incluir escuelas que empiecen esta semana
        }
      } catch (error) {
        console.warn(`Error processing course start for ${school.name}:`, error)
        return
      }
    }

    const schoolDays = Object.keys(school.activities)
    if (schoolDays.length === 0) return

    // Encontrar el primer día disponible de la semana
    const dayOrder = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres"]
    let deliveryDay = ""
    let deliveryDate = new Date()

    for (const day of dayOrder) {
      if (schoolDays.includes(day)) {
        const dayIndex = dayOrder.indexOf(day)
        const potentialDate = addDays(weekStart, dayIndex)

        // Verificar si es festivo
        const isHoliday = holidays.some((holiday) => {
          try {
            return holiday.date && !isNaN(holiday.date.getTime()) && isSameDay(holiday.date, potentialDate)
          } catch {
            return false
          }
        })

        if (!isHoliday && potentialDate >= weekStart && potentialDate <= weekEnd) {
          deliveryDay = day
          deliveryDate = potentialDate
          break
        }
      }
    }

    if (!deliveryDay) {
      // Si todos los días son festivos, programar para la siguiente semana
      return
    }

    // Consolidar todas las actividades de la semana en una entrega
    const allActivities: Array<{ day: string; turn: string; activity: string; startTime?: string; totalStudents?: number }> = []

    schoolDays.forEach((day) => {
      school.activities[day].forEach((activityInfo) => {
        allActivities.push({
          day,
          turn: activityInfo.turn,
          activity: activityInfo.activity,
          startTime: activityInfo.startTime, // Incluir hora de inicio
          totalStudents: activityInfo.totalStudents, // Incluir número de alumnos
        })
      })
    })

    deliveryPlans.push({
      school,
      deliveryDate,
      deliveryDay,
      activities: allActivities,
      consolidated: allActivities.length > 1,
      reason: allActivities.length > 1 ? "Consolidado en una visita" : "Entrega única",
    })
  })

  return deliveryPlans.sort((a, b) => a.deliveryDate.getTime() - b.deliveryDate.getTime())
}

// Añadir después de la función generateRouteForDay, estas nuevas funciones para mejorar la gestión de rutas:

// Nuevas funciones para gestión avanzada de rutas
interface RouteOptimization {
  schools: School[]
  totalDistance: number
  estimatedTime: number
  optimizedOrder: number[]
}

interface RoutePreferences {
  startLocation: string
  endLocation: string
  avoidTolls: boolean
  avoidHighways: boolean
  preferredStartTime: string
}

// Función para optimizar ruta usando Google Maps Directions API
async function optimizeRouteWithGoogle(schools: School[], preferences: RoutePreferences): Promise<RouteOptimization> {
  // Simulación de optimización (en producción usaríamos Google Maps API)
  const optimizedOrder = [...Array(schools.length).keys()].sort(() => Math.random() - 0.5)

  return {
    schools: optimizedOrder.map((i) => schools[i]),
    totalDistance: Math.random() * 50 + 20, // km simulados
    estimatedTime: Math.random() * 180 + 120, // minutos simulados
    optimizedOrder,
  }
}

// Función para generar múltiples opciones de ruta
function generateRouteOptions(schools: School[]): Array<{
  name: string
  description: string
  schools: School[]
  estimatedTime: number
}> {
  return [
    {
      name: "Ruta Óptima por Distancia",
      description: "Minimiza la distancia total recorrida",
      schools: [...schools].sort((a, b) => a.name.localeCompare(b.name)),
      estimatedTime: 180,
    },
    {
      name: "Ruta por Zonas",
      description: "Agrupa centros por proximidad geográfica",
      schools: [...schools].sort((a, b) => a.address.localeCompare(b.address)),
      estimatedTime: 200,
    },
    {
      name: "Ruta por Prioridad",
      description: "Prioriza centros con más actividades",
      schools: [...schools].sort((a, b) => b.activities.length - a.activities.length),
      estimatedTime: 190,
    },
  ]
}

// Componente de gestión de festivos
function HolidayManager({
  holidays,
  onHolidaysChange,
}: { holidays: Holiday[]; onHolidaysChange: (holidays: Holiday[]) => void }) {
  const [newHolidayDate, setNewHolidayDate] = useState<Date>()
  const [newHolidayName, setNewHolidayName] = useState("")

  const addHoliday = () => {
    if (newHolidayDate && newHolidayName.trim()) {
      const newHoliday: Holiday = {
        date: newHolidayDate,
        name: newHolidayName.trim(),
      }
      onHolidaysChange([...holidays, newHoliday])
      setNewHolidayDate(undefined)
      setNewHolidayName("")
    }
  }

  const removeHoliday = (index: number) => {
    const updatedHolidays = holidays.filter((_, i) => i !== index)
    onHolidaysChange(updatedHolidays)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CalendarIcon className="h-5 w-5 mr-2" />
          Gestión de Festivos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start text-left font-normal bg-transparent">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {newHolidayDate ? format(newHolidayDate, "PPP", { locale: es }) : "Seleccionar fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={newHolidayDate} onSelect={setNewHolidayDate} initialFocus weekStartsOn={1} />
            </PopoverContent>
          </Popover>
          <Input
            placeholder="Nombre del festivo"
            value={newHolidayName}
            onChange={(e) => setNewHolidayName(e.target.value)}
            className="flex-1"
          />
          <Button onClick={addHoliday} disabled={!newHolidayDate || !newHolidayName.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {holidays.map((holiday, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div>
                <span className="font-medium">{holiday.name}</span>
                <span className="text-sm text-gray-500 ml-2">{format(holiday.date, "PPP", { locale: es })}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeHoliday(index)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Constantes para DeliveryModule (fuera del componente para evitar re-renders)
const ALL_ACTIVITIES = ["TC", "CO", "DX", "HC", "JL"] as const
const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes"] as const
const dayNameMapping: { [key: string]: string } = {
  "lunes": "Dilluns",
  "martes": "Dimarts",
  "miércoles": "Dimecres",
  "jueves": "Dijous",
  "viernes": "Divendres"
}
const catalanToSpanish: { [key: string]: string } = {
  "Dilluns": "lunes",
  "Dimarts": "martes",
  "Dimecres": "miércoles",
  "Dijous": "jueves",
  "Divendres": "viernes"
}
const dayOrder: { [key: string]: number } = {
  "lunes": 0, "martes": 1, "miércoles": 2, "jueves": 3, "viernes": 4
}

// Componente principal de entregas - SIMPLIFICADO
function DeliveryModule({
  deliverySchools,
  onOpenRouteEditor,
}: {
  deliverySchools: DeliverySchool[]
  onOpenRouteEditor: (allPlans: DeliveryPlan[], dayName: string, deliveryType: string, weekStart: string, minStudentsFilter?: number, additionalPlans?: DeliveryPlan[], onReorganizeCb?: (items: any) => void, projectId?: string) => void
}) {
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date())
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("trimestral")
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedActivities, setSelectedActivities] = useState<string[]>([...ALL_ACTIVITIES])
  const [selectedPlanningDay, setSelectedPlanningDay] = useState<string>("martes")

  // Proyecto activo en Google Sheets
  const { getProjects, createProject, updateProject, saveProjectDeliveries, getProjectDeliveries, deleteProject: deleteProjectApi, loading: projectLoading } = useProjects()
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [projectSaved, setProjectSaved] = useState(false)
  const [availableProjects, setAvailableProjects] = useState<Project[]>([])
  const [showProjectSelector, setShowProjectSelector] = useState(false)

  const debouncedSearchTerm = useDebounced(searchTerm, 300)

  // Pre-filtrar escuelas por actividades seleccionadas ANTES de generar el plan
  // Esto es crucial: el filtro de actividades afecta qué días tiene cada centro,
  // y por tanto a qué día se le asigna la entrega
  const filteredDeliverySchools = useMemo(() => {
    const allActivitiesSelected = selectedActivities.length === ALL_ACTIVITIES.length
    if (allActivitiesSelected) return deliverySchools

    return deliverySchools.map(school => {
      const filteredActivities: typeof school.activities = {}

      Object.entries(school.activities).forEach(([day, dayActivities]) => {
        const matching = dayActivities.filter(a => {
          const code = a.activity.replace(/\d+[A-Z]?$/, "")
          return selectedActivities.includes(code)
        })
        if (matching.length > 0) {
          filteredActivities[day] = matching
        }
      })

      return { ...school, activities: filteredActivities }
    }).filter(school => Object.keys(school.activities).length > 0)
  }, [deliverySchools, selectedActivities])

  // Generar planes de entrega para la semana (con escuelas ya filtradas)
  const deliveryPlans = useMemo(() => {
    return generateDeliveryPlan(filteredDeliverySchools, selectedWeek, deliveryType, holidays)
  }, [filteredDeliverySchools, selectedWeek, deliveryType, holidays])

  // Planes de la SEMANA SIGUIENTE (para aprovechar rutas)
  const nextWeekPlans = useMemo(() => {
    const nextWeek = addDays(selectedWeek, 7)
    return generateDeliveryPlan(filteredDeliverySchools, nextWeek, deliveryType, holidays)
  }, [filteredDeliverySchools, selectedWeek, deliveryType, holidays])

  // Centros seleccionados de la semana siguiente
  const [selectedNextWeekCenters, setSelectedNextWeekCenters] = useState<Set<string>>(new Set())

  const toggleNextWeekCenter = useCallback((schoolName: string) => {
    setSelectedNextWeekCenters(prev => {
      const newSet = new Set(prev)
      if (newSet.has(schoolName)) {
        newSet.delete(schoolName)
      } else {
        newSet.add(schoolName)
      }
      return newSet
    })
  }, [])

  // Filtrar planes por búsqueda (actividades ya filtradas en filteredDeliverySchools)
  const filteredPlans = useMemo(() => {
    if (!deliveryPlans.length) return []
    if (!debouncedSearchTerm) return deliveryPlans

    const lowerSearchTerm = debouncedSearchTerm.toLowerCase()

    return deliveryPlans.filter((plan) =>
      plan.school.name.toLowerCase().includes(lowerSearchTerm) ||
      plan.activities.some((activity) => activity.activity.toLowerCase().includes(lowerSearchTerm))
    )
  }, [deliveryPlans, debouncedSearchTerm])

  // Días laborables disponibles (excluyendo festivos)
  const availableDays = useMemo(() => {
    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 })
    const result: string[] = []

    WEEKDAYS.forEach((day, index) => {
      const dayDate = addDays(weekStart, index)
      const isHoliday = holidays.some(h => {
        try { return h.date && !isNaN(h.date.getTime()) && isSameDay(h.date, dayDate) }
        catch { return false }
      })
      if (!isHoliday) result.push(day)
    })

    return result
  }, [selectedWeek, holidays])

  // Estado para reorganizaciones guardadas desde el editor de rutas
  const [savedReorganization, setSavedReorganization] = useState<{ [day: string]: any[] } | null>(null)

  const weekStartStr = useMemo(() => format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'), [selectedWeek])
  const weekEndStr = useMemo(() => format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'), [selectedWeek])

  // Cargar proyecto activo desde Google Sheets cuando cambia la semana
  useEffect(() => {
    const loadProject = async () => {
      try {
        const projects = await getProjects('entrega')
        setAvailableProjects(projects)
        // Buscar proyecto que coincida con semana y modo
        const matching = projects.find(p =>
          p.fechaInicio === weekStartStr && p.modo === deliveryType
        )
        if (matching) {
          setActiveProject(matching)
          setProjectSaved(true)
          // Restaurar festivos del proyecto
          if (matching.festivos && matching.festivos.length > 0) {
            setHolidays(matching.festivos.map(f => ({ date: new Date(f), name: 'Festivo' })))
          }
          // Restaurar actividades del proyecto
          if (matching.actividades && matching.actividades.length > 0) {
            setSelectedActivities(matching.actividades)
          }
        } else {
          setActiveProject(null)
          setProjectSaved(false)
        }
      } catch (err) {
        console.error('Error cargando proyecto:', err)
        setActiveProject(null)
        setProjectSaved(false)
      }
    }
    loadProject()
  }, [weekStartStr, deliveryType])

  // Cerrar selector de proyectos al hacer click fuera
  useEffect(() => {
    if (!showProjectSelector) return
    const handleClick = () => setShowProjectSelector(false)
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0)
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClick) }
  }, [showProjectSelector])

  // Abrir un proyecto existente
  const loadProjectById = useCallback(async (project: Project) => {
    setActiveProject(project)
    setProjectSaved(true)
    // Restaurar configuración del proyecto
    setDeliveryType(project.modo as DeliveryType)
    setSelectedWeek(new Date(project.fechaInicio))
    if (project.festivos && project.festivos.length > 0) {
      setHolidays(project.festivos.map(f => ({ date: new Date(f), name: 'Festivo' })))
    } else {
      setHolidays([])
    }
    if (project.actividades && project.actividades.length > 0) {
      setSelectedActivities(project.actividades)
    }
    setShowProjectSelector(false)
  }, [])

  // Cargar reorganización guardada: primero desde proyecto (Sheets), fallback a localStorage
  useEffect(() => {
    const loadReorganization = async () => {
      if (activeProject) {
        try {
          const deliveries = await getProjectDeliveries(activeProject.id)
          if (deliveries.length > 0) {
            // Reconstruir reorganizedItems desde las entregas del proyecto
            const byDay: { [day: string]: any[] } = {}
            deliveries.forEach(d => {
              const day = d.diaPlanificado
              if (!byDay[day]) byDay[day] = []
              byDay[day].push({
                id: d.centro,
                name: d.centro,
                address: d.direccion,
                activities: d.actividades,
                day: day,
                orden: d.orden,
                startTime: d.startTime || '',
                turn: d.turn || '',
                priority: d.priority || false,
              })
            })
            // Ordenar por el campo orden dentro de cada día
            Object.values(byDay).forEach(items => {
              items.sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0))
            })
            setSavedReorganization(byDay)
            // Restaurar selectedNextWeekCenters: detectar centros que no son de esta semana
            const currentWeekNames = new Set(filteredPlans.map(p => p.school.name))
            const adelantadosRestaurados = new Set<string>()
            deliveries.forEach(d => {
              if (!currentWeekNames.has(d.centro)) {
                adelantadosRestaurados.add(d.centro)
              }
            })
            if (adelantadosRestaurados.size > 0) {
              setSelectedNextWeekCenters(adelantadosRestaurados)
            }
            return
          }
        } catch (err) {
          console.error('Error cargando entregas del proyecto:', err)
        }
      }
      // Fallback a localStorage
      try {
        const key = `reorganization_${deliveryType}_${weekStartStr}`
        const saved = localStorage.getItem(key)
        if (saved) {
          const data = JSON.parse(saved)
          setSavedReorganization(data.reorganizedItems || null)
        } else {
          setSavedReorganization(null)
        }
      } catch {
        setSavedReorganization(null)
      }
    }
    loadReorganization()
  }, [activeProject, deliveryType, weekStartStr])

  // Escuchar cambios del editor de rutas (callback onApplyChanges)
  const handleRouteReorganization = useCallback((reorganizedItems: { [day: string]: any[] }) => {
    setSavedReorganization(reorganizedItems)
  }, [])

  // Agrupar centros por día: proyecto guardado es fuente de verdad, si no distribución automática
  const plansByDay = useMemo(() => {
    const grouped: { [key: string]: DeliveryPlan[] } = {}
    availableDays.forEach(day => { grouped[day] = [] })

    // Mapa rápido de filteredPlans y nextWeekPlans por nombre para enriquecer datos
    const plansByName: { [name: string]: DeliveryPlan } = {}
    filteredPlans.forEach(p => { plansByName[p.school.name] = p })
    nextWeekPlans.forEach(p => { if (!plansByName[p.school.name]) plansByName[p.school.name] = p })

    if (savedReorganization) {
      // savedReorganization es la fuente de verdad (viene del proyecto guardado o del editor)
      // Incluye centros de esta semana Y adelantados, con orden correcto
      const centrosEnReorganizacion = new Set<string>()

      Object.entries(savedReorganization).forEach(([day, items]) => {
        const spanishDay = catalanToSpanish[day] || day.toLowerCase()
        if (!grouped[spanishDay]) return // día no disponible (festivo)

        items.forEach((item: any) => {
          const name = item.id || item.name
          if (!name) return
          centrosEnReorganizacion.add(name)

          const existingPlan = plansByName[name]
          if (existingPlan) {
            // Enriquecer con datos actuales del CSV + preservar priority del proyecto
            const enriched: any = { ...existingPlan, deliveryDay: day }
            if (item.priority) enriched.priority = true
            if (item.startTime) enriched.activities = existingPlan.activities.length > 0
              ? existingPlan.activities
              : [{ day, turn: item.turn || '', activity: '', startTime: item.startTime }]
            grouped[spanishDay].push(enriched)
          } else {
            // Centro adelantado o no en filteredPlans — crear plan sintético
            const syntheticPlan: any = {
              school: {
                name: name,
                address: item.address || '',
                courseStart: new Date(),
                activities: {}
              },
              deliveryDate: new Date(),
              deliveryDay: day,
              activities: (item.activities || []).map((a: any) => ({
                day: day,
                turn: item.turn || '',
                activity: typeof a === 'string' ? a : a.activity || '',
                startTime: item.startTime || '',
              })),
              consolidated: false,
              reason: 'adelantado',
            }
            if (item.priority) syntheticPlan.priority = true
            grouped[spanishDay].push(syntheticPlan)
          }
        })
      })

      // Añadir centros de filteredPlans que NO están en la reorganización (centros nuevos)
      filteredPlans.forEach(plan => {
        if (!centrosEnReorganizacion.has(plan.school.name)) {
          const spanishDay = catalanToSpanish[plan.deliveryDay]
          if (spanishDay && grouped[spanishDay]) {
            grouped[spanishDay].push(plan)
          } else if (availableDays.length > 0) {
            grouped[availableDays[0]].push(plan)
          }
        }
      })
    } else {
      // Sin reorganización: distribución automática por primer día con actividades
      filteredPlans.forEach(plan => {
        const spanishDay = catalanToSpanish[plan.deliveryDay]
        if (spanishDay && grouped[spanishDay]) {
          grouped[spanishDay].push(plan)
        } else if (availableDays.length > 0) {
          grouped[availableDays[0]].push(plan)
        }
      })
    }

    return grouped
  }, [filteredPlans, nextWeekPlans, availableDays, savedReorganization])

  return (
    <div className="space-y-6">
      {/* Controles principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Modo</label>
          <Select value={deliveryType} onValueChange={(value: DeliveryType) => setDeliveryType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trimestral">Trimestral (todos a la vez)</SelectItem>
              <SelectItem value="inicio-curso">Inicio de curso (progresivo)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Semana de entrega</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedWeek, "PPP", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedWeek}
                onSelect={(date) => date && setSelectedWeek(date)}
                initialFocus
                weekStartsOn={1}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar centro o actividad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Filtro de actividades */}
      <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <span className="text-sm font-medium">Actividades:</span>
        <div className="flex flex-wrap gap-4">
          {ALL_ACTIVITIES.map((activity) => (
            <label key={activity} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={selectedActivities.includes(activity)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedActivities([...selectedActivities, activity])
                  } else {
                    setSelectedActivities(selectedActivities.filter((a) => a !== activity))
                  }
                }}
              />
              <span className="text-sm font-medium">{activity}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedActivities([...ALL_ACTIVITIES])}
            disabled={selectedActivities.length === ALL_ACTIVITIES.length}
          >
            Todas
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedActivities([])}
            disabled={selectedActivities.length === 0}
          >
            Ninguna
          </Button>
        </div>
      </div>

      {/* Gestión de festivos */}
      <HolidayManager holidays={holidays} onHolidaysChange={setHolidays} />

      {/* Resumen rápido + proyecto + botones exportar */}
      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-4">
          <Truck className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-blue-800">{filteredPlans.length} centros</span>
            <span className="text-blue-600"> repartidos en </span>
            <span className="font-semibold text-blue-800">{availableDays.length} días</span>
            <span className="text-blue-600"> &middot; Semana del </span>
            <span className="font-semibold text-blue-800">
              {format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), "d 'de' MMMM", { locale: es })}
            </span>
            {holidays.length > 0 && (
              <span className="text-orange-600 ml-2">
                ({holidays.length} festivo{holidays.length > 1 ? 's' : ''})
              </span>
            )}
            {activeProject && (
              <span className="text-green-600 ml-2 font-medium">
                &middot; Proyecto guardado
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const weekLabel = format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), "d-MM-yyyy")
              const bom = "\uFEFF"
              const rows = ["Día;Orden;Centro;Dirección;Actividades"]

              availableDays.forEach(day => {
                const plans = plansByDay[day] || []
                const catalanDay = dayNameMapping[day]
                const dayLabel = catalanDay.charAt(0).toUpperCase() + catalanDay.slice(1)

                if (plans.length === 0) return

                plans.forEach((plan, i) => {
                  const name = plan.school.name === "Academia" ? plan.school.name : `Escola ${plan.school.name}`
                  const activities = plan.activities.map(a => a.activity).join(", ")
                  rows.push(`${dayLabel};${i + 1};${name};${plan.school.address};${activities}`)
                })
              })

              const blob = new Blob([bom + rows.join("\n")], { type: "text/csv;charset=utf-8" })
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `entregas_semana_${weekLabel}.csv`
              a.click()
              window.URL.revokeObjectURL(url)
            }}
            disabled={filteredPlans.length === 0}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const weekLabel = format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), "d 'de' MMMM yyyy", { locale: es })
              let html = `
                <html><head><title>Entregas - Semana del ${weekLabel}</title>
                <style>
                  body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                  h1 { font-size: 18px; margin-bottom: 4px; }
                  h2 { font-size: 15px; color: #2563eb; margin-top: 24px; margin-bottom: 8px; border-bottom: 2px solid #2563eb; padding-bottom: 4px; }
                  .subtitle { color: #666; font-size: 13px; margin-bottom: 20px; }
                  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
                  th { background: #f0f4ff; text-align: left; padding: 6px 10px; border: 1px solid #ddd; font-weight: 600; }
                  td { padding: 6px 10px; border: 1px solid #ddd; }
                  tr:nth-child(even) { background: #f9fafb; }
                  .activities { color: #555; font-size: 12px; }
                  @media print { body { padding: 0; } }
                </style></head><body>
                <h1>Plan de Entregas - Semana del ${weekLabel}</h1>
                <div class="subtitle">${filteredPlans.length} centros &middot; ${availableDays.length} días &middot; ${selectedActivities.join(", ")}</div>
              `

              availableDays.forEach(day => {
                const plans = plansByDay[day] || []
                const catalanDay = dayNameMapping[day]
                const dayLabel = catalanDay.charAt(0).toUpperCase() + catalanDay.slice(1)

                if (plans.length === 0) return

                html += `<h2>${dayLabel} (${plans.length} centros)</h2>`
                html += `<table><tr><th>#</th><th>Centro</th><th>Dirección</th><th>Actividades</th></tr>`

                plans.forEach((plan, i) => {
                  const name = plan.school.name === "Academia" ? plan.school.name : `Escola ${plan.school.name}`
                  const activities = plan.activities.map(a => `${a.activity} (${a.day})`).join(", ")
                  html += `<tr><td>${i + 1}</td><td><strong>${name}</strong></td><td>${plan.school.address}</td><td class="activities">${activities}</td></tr>`
                })

                html += `</table>`
              })

              html += `</body></html>`

              const printWindow = window.open("", "_blank")
              if (printWindow) {
                printWindow.document.write(html)
                printWindow.document.close()
                printWindow.focus()
                setTimeout(() => printWindow.print(), 500)
              }
            }}
            disabled={filteredPlans.length === 0}
          >
            <Truck className="h-4 w-4 mr-1" />
            Imprimir
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              if (filteredPlans.length === 0 && selectedNextWeekCenters.size === 0) return
              try {
                // Construir entregas: plansByDay ya incluye adelantados si vienen de savedReorganization
                // Pero si hay adelantados recién seleccionados (no guardados aún), añadirlos también
                const buildDeliveries = () => {
                  const deliveries = Object.entries(plansByDay).flatMap(([day, plans]) => {
                    const catalanDay = dayNameMapping[day]
                    return plans.map((plan, index) => ({
                      centro: plan.school.name,
                      direccion: plan.school.address,
                      diaPlanificado: catalanDay,
                      actividades: plan.activities.map(a => a.activity),
                      orden: index + 1,
                      startTime: plan.activities[0]?.startTime || '',
                      turn: plan.activities[0]?.turn || '',
                      priority: (plan as any).priority || false,
                    }))
                  })
                  // Añadir adelantados seleccionados que no estén ya en plansByDay
                  const centrosYaIncluidos = new Set(deliveries.map(d => d.centro))
                  const adelantados = nextWeekPlans
                    .filter(p => selectedNextWeekCenters.has(p.school.name) && !centrosYaIncluidos.has(p.school.name))
                  if (adelantados.length > 0) {
                    const firstDay = dayNameMapping[availableDays[0]] || 'Dilluns'
                    const baseIndex = deliveries.filter(d => d.diaPlanificado === firstDay).length
                    adelantados.forEach((plan, i) => {
                      deliveries.push({
                        centro: plan.school.name,
                        direccion: plan.school.address,
                        diaPlanificado: firstDay,
                        actividades: plan.activities.map(a => a.activity),
                        orden: baseIndex + i + 1,
                        startTime: plan.activities[0]?.startTime || '',
                        turn: plan.activities[0]?.turn || '',
                        priority: false,
                      })
                    })
                  }
                  return deliveries
                }

                if (activeProject) {
                  // Actualizar proyecto existente
                  await updateProject(activeProject.id, {
                    actividades: selectedActivities,
                    festivos: holidays.map(h => format(h.date, 'yyyy-MM-dd')),
                    modo: deliveryType as 'trimestral' | 'inicio-curso',
                  })
                  const deliveries = buildDeliveries()
                  await saveProjectDeliveries(activeProject.id, deliveries)
                  setProjectSaved(true)
                  alert('Proyecto actualizado')
                } else {
                  // Crear nuevo proyecto
                  const projectId = await createProject({
                    tipo: 'entrega',
                    modo: deliveryType as 'trimestral' | 'inicio-curso',
                    fechaInicio: weekStartStr,
                    fechaFin: weekEndStr,
                    actividades: selectedActivities,
                    festivos: holidays.map(h => format(h.date, 'yyyy-MM-dd')),
                  })
                  if (projectId) {
                    const deliveries = buildDeliveries()
                    await saveProjectDeliveries(projectId, deliveries)
                    // Recargar proyecto
                    const projects = await getProjects('entrega')
                    const newProject = projects.find(p => p.id === projectId)
                    if (newProject) setActiveProject(newProject)
                    setProjectSaved(true)
                    alert('Proyecto creado y guardado')
                  }
                }
              } catch (err) {
                console.error('Error guardando proyecto:', err)
                alert('Error guardando proyecto')
              }
            }}
            disabled={filteredPlans.length === 0 || projectLoading}
            className={activeProject ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}
          >
            {projectLoading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-1" />
            )}
            {activeProject ? 'Actualizar proyecto' : 'Guardar proyecto'}
          </Button>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                // Recargar lista de proyectos al abrir
                try {
                  const projects = await getProjects('entrega')
                  setAvailableProjects(projects)
                } catch {}
                setShowProjectSelector(!showProjectSelector)
              }}
              disabled={projectLoading}
            >
              <FolderOpen className="h-4 w-4 mr-1" />
              Abrir proyecto
            </Button>
            {showProjectSelector && availableProjects.length > 0 && (
              <div className="absolute top-full right-0 mt-1 w-72 bg-white border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {availableProjects.map(project => {
                  const isActive = activeProject?.id === project.id
                  const weekLabel = (() => {
                    try { return format(new Date(project.fechaInicio), "d MMM yyyy", { locale: es }) }
                    catch { return project.fechaInicio }
                  })()
                  return (
                    <div
                      key={project.id}
                      className={cn(
                        "flex items-center justify-between p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0",
                        isActive && "bg-green-50"
                      )}
                      onClick={() => loadProjectById(project)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          Semana {weekLabel}
                        </div>
                        <div className="text-xs text-gray-500">
                          {project.modo} &middot; {project.actividades.join(', ')}
                          {project.festivos?.length > 0 && ` &middot; ${project.festivos.length} festivo${project.festivos.length > 1 ? 's' : ''}`}
                        </div>
                      </div>
                      {isActive && (
                        <span className="text-green-600 text-xs font-medium ml-2">activo</span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-1 p-1 h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!confirm('¿Eliminar este proyecto?')) return
                          await deleteProjectApi(project.id)
                          setAvailableProjects(prev => prev.filter(p => p.id !== project.id))
                          if (activeProject?.id === project.id) {
                            setActiveProject(null)
                            setProjectSaved(false)
                            setSavedReorganization(null)
                          }
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                })}
                {availableProjects.length === 0 && (
                  <div className="p-3 text-sm text-gray-400 text-center">No hay proyectos guardados</div>
                )}
              </div>
            )}
            {showProjectSelector && availableProjects.length === 0 && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-white border rounded-lg shadow-lg z-50 p-3 text-sm text-gray-400 text-center">
                No hay proyectos guardados
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs por día */}
      {filteredPlans.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Tabs value={selectedPlanningDay} onValueChange={setSelectedPlanningDay} className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-4">
                {WEEKDAYS.map(day => {
                  const isHoliday = !availableDays.includes(day)
                  const count = plansByDay[day]?.length || 0
                  return (
                    <TabsTrigger
                      key={day}
                      value={day}
                      disabled={isHoliday}
                      className={cn(
                        "flex flex-col py-2 data-[state=active]:bg-blue-100",
                        isHoliday && "opacity-40 line-through"
                      )}
                    >
                      <span className="capitalize text-sm">{day}</span>
                      <span className="text-xs text-gray-500">
                        {isHoliday ? "festivo" : count > 0 ? `${count} centros` : "—"}
                      </span>
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              {WEEKDAYS.map(day => {
                const catalanDay = dayNameMapping[day]
                const formattedDay = catalanDay.charAt(0).toUpperCase() + catalanDay.slice(1).toLowerCase()
                const assignedPlans = plansByDay[day] || []
                const isHoliday = !availableDays.includes(day)

                // Centros adelantados que aún NO están en plansByDay (recién seleccionados)
                const centrosEnPlansByDay = new Set(Object.values(plansByDay).flat().map(p => p.school.name))
                const nextWeekSelectedForDay = nextWeekPlans.filter(
                  p => selectedNextWeekCenters.has(p.school.name) && !centrosEnPlansByDay.has(p.school.name)
                )
                const totalForRoute = assignedPlans.length + nextWeekSelectedForDay.length

                return (
                  <TabsContent key={day} value={day} className="space-y-4">
                    {isHoliday ? (
                      <div className="text-center py-8 text-gray-400">
                        <CalendarIcon className="h-12 w-12 mx-auto mb-3" />
                        <p>Este día es festivo</p>
                      </div>
                    ) : (
                      <>
                        {/* Cabecera del día */}
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <h3 className="font-semibold capitalize">{formattedDay}</h3>
                            <p className="text-sm text-gray-600">
                              {assignedPlans.length} centros
                              {nextWeekSelectedForDay.length > 0 && ` + ${nextWeekSelectedForDay.length} adelantados`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                // Pasar TODOS los centros desde plansByDay (fuente de verdad)
                                // plansByDay ya incluye adelantados en el día correcto
                                const allPlansFromByDay: DeliveryPlan[] = []
                                Object.entries(plansByDay).forEach(([spanishDay, plans]) => {
                                  const catalanDay = dayNameMapping[spanishDay]
                                  plans.forEach(plan => {
                                    allPlansFromByDay.push({ ...plan, deliveryDay: catalanDay })
                                  })
                                })
                                // Añadir adelantados recién seleccionados que no estén ya en plansByDay
                                const centrosYaIncluidos = new Set(allPlansFromByDay.map(p => p.school.name))
                                const nuevosAdelantados = nextWeekPlans
                                  .filter(p => selectedNextWeekCenters.has(p.school.name) && !centrosYaIncluidos.has(p.school.name))

                                onOpenRouteEditor(
                                  [...allPlansFromByDay, ...nuevosAdelantados],
                                  formattedDay,
                                  deliveryType,
                                  format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
                                  0,
                                  [],
                                  handleRouteReorganization,
                                  activeProject?.id
                                )
                              }}
                              disabled={totalForRoute === 0}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Route className="h-4 w-4 mr-2" />
                              Editar Ruta ({totalForRoute})
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                // Placeholder: en futuro se puede conectar a tracking
                                alert(`Ruta de ${formattedDay} marcada como entregada (${totalForRoute} centros)`)
                              }}
                              disabled={totalForRoute === 0}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Ruta entregada
                            </Button>
                          </div>
                        </div>

                        {/* Lista de centros asignados */}
                        {assignedPlans.length > 0 && (
                          <div className="space-y-2">
                            {assignedPlans.map((plan, index) => {
                              const schoolDisplayName = plan.school.name === "Academia" ? plan.school.name : `Escola ${plan.school.name}`
                              return (
                                <div
                                  key={`${plan.school.name}-${index}`}
                                  className="flex items-center gap-3 p-3 rounded-lg border bg-white border-gray-200"
                                >
                                  <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {index + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium">{schoolDisplayName}</div>
                                    <div className="text-sm text-gray-500 truncate">{plan.school.address}</div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {plan.activities.map((a, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs">
                                          {a.activity} ({a.day})
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Centros adelantados de semana siguiente (ya seleccionados) */}
                        {nextWeekSelectedForDay.length > 0 && (
                          <div className="space-y-2 border-t pt-4">
                            <h4 className="font-medium text-blue-700 text-sm flex items-center">
                              <Plus className="h-4 w-4 mr-1" />
                              Adelantados de próxima semana ({nextWeekSelectedForDay.length})
                            </h4>
                            {nextWeekSelectedForDay.map((plan, index) => {
                              const schoolDisplayName = plan.school.name === "Academia" ? plan.school.name : `Escola ${plan.school.name}`
                              return (
                                <div
                                  key={`next-${plan.school.name}-${index}`}
                                  className="flex items-center gap-3 p-3 rounded-lg border bg-blue-50 border-blue-200"
                                >
                                  <Checkbox
                                    checked={true}
                                    onCheckedChange={() => toggleNextWeekCenter(plan.school.name)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium">{schoolDisplayName}</div>
                                    <div className="text-sm text-gray-500 truncate">{plan.school.address}</div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {plan.activities.map((a, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs">
                                          {a.activity} ({a.day})
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Aprovechar ruta: centros de próxima semana (excluir los que ya están en plansByDay o seleccionados) */}
                        {(() => {
                          const allCentrosIncluidos = new Set([
                            ...Object.values(plansByDay).flat().map(p => p.school.name),
                            ...Array.from(selectedNextWeekCenters)
                          ])
                          const availableNextWeek = nextWeekPlans.filter(
                            plan => !allCentrosIncluidos.has(plan.school.name)
                          )

                          if (availableNextWeek.length === 0) return null

                          return (
                            <div className="space-y-3 border-t pt-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-gray-600 text-sm flex items-center">
                                  <CalendarIcon className="h-4 w-4 mr-2 text-blue-500" />
                                  Aprovechar ruta: {availableNextWeek.length} centros de la semana siguiente
                                </h4>
                              </div>
                              <p className="text-xs text-gray-500">
                                Estos centros necesitan material la semana que viene. Puedes adelantar su entrega y aprovechar la ruta de hoy.
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                                {availableNextWeek.map((plan) => {
                                  const schoolDisplayName = plan.school.name === "Academia" ? plan.school.name : `Escola ${plan.school.name}`
                                  return (
                                    <label
                                      key={plan.school.name}
                                      className="flex items-center gap-2 p-2 rounded-lg cursor-pointer border bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-200"
                                    >
                                      <Checkbox
                                        checked={false}
                                        onCheckedChange={() => toggleNextWeekCenter(plan.school.name)}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium truncate block">{schoolDisplayName}</span>
                                        <span className="text-xs text-gray-500">
                                          {plan.activities.map(a => a.activity).join(", ")}
                                        </span>
                                      </div>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })()}

                        {/* Mensaje si no hay centros */}
                        {assignedPlans.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p>No hay centros asignados a este día</p>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                )
              })}
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <Truck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay entregas programadas</h3>
          <p className="text-gray-600">
            No se encontraron centros para la semana seleccionada con los filtros actuales.
          </p>
        </Card>
      )}
    </div>
  )
}

// Reemplazar el componente WebRouteMap con esta versión mejorada:

function AdvancedRouteManager({ schools, day }: { schools: School[]; day: string }) {
  const [selectedRoute, setSelectedRoute] = useState<number>(0)
  const [routePreferences, setRoutePreferences] = useState<RoutePreferences>({
    startLocation: "Oficina Central, Barcelona",
    endLocation: "Oficina Central, Barcelona",
    avoidTolls: false,
    avoidHighways: false,
    preferredStartTime: "09:00",
  })
  const [optimizedRoute, setOptimizedRoute] = useState<RouteOptimization | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)

  const routeOptions = useMemo(() => generateRouteOptions(schools), [schools])

  const optimizeRoute = async () => {
    setIsOptimizing(true)
    try {
      const result = await optimizeRouteWithGoogle(schools, routePreferences)
      setOptimizedRoute(result)
    } catch (error) {
      console.error("Error optimizando ruta:", error)
    } finally {
      setIsOptimizing(false)
    }
  }

  const exportRouteToGoogleMaps = (schoolList: School[]) => {
    const waypoints = schoolList.map((school) => `Escola ${school.name}, ${school.address}, Barcelona`).join("|")

    const googleMapsUrl = `https://www.google.com/maps/dir/${encodeURIComponent(routePreferences.startLocation)}/${waypoints}/${encodeURIComponent(routePreferences.endLocation)}`
    window.open(googleMapsUrl, "_blank")
  }

  const exportToRouteXL = (schoolList: School[]) => {
    const addresses = [
      routePreferences.startLocation,
      ...schoolList.map((school) => `Escola ${school.name}, ${school.address}, Barcelona`),
      routePreferences.endLocation,
    ].join("|")

    const routeXLUrl = `https://www.routexl.com/route?addresses=${encodeURIComponent(addresses)}`
    window.open(routeXLUrl, "_blank")
  }

  const currentSchools = optimizedRoute ? optimizedRoute.schools : routeOptions[selectedRoute].schools

  return (
    <div className="space-y-6">
      {/* Configuración de Ruta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Route className="h-5 w-5 mr-2" />
            Configuración de Ruta - {day}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Hora de Inicio</label>
              <Input
                type="time"
                value={routePreferences.preferredStartTime}
                onChange={(e) => setRoutePreferences((prev) => ({ ...prev, preferredStartTime: e.target.value }))}
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="avoidTolls"
                checked={routePreferences.avoidTolls}
                onChange={(e) => setRoutePreferences((prev) => ({ ...prev, avoidTolls: e.target.checked }))}
              />
              <label htmlFor="avoidTolls" className="text-sm">
                Evitar peajes
              </label>
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="avoidHighways"
                checked={routePreferences.avoidHighways}
                onChange={(e) => setRoutePreferences((prev) => ({ ...prev, avoidHighways: e.target.checked }))}
              />
              <label htmlFor="avoidHighways" className="text-sm">
                Evitar autopistas
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={optimizeRoute} disabled={isOptimizing} className="flex-1">
              {isOptimizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Route className="h-4 w-4 mr-2" />}
              Optimizar con Google Maps
            </Button>
            <Button variant="outline" onClick={() => exportRouteToGoogleMaps(currentSchools)}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir en Google Maps
            </Button>
            <Button variant="outline" onClick={() => exportToRouteXL(currentSchools)}>
              <Navigation className="h-4 w-4 mr-2" />
              RouteXL
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Opciones de Ruta */}
      <Card>
        <CardHeader>
          <CardTitle>Opciones de Ruta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {routeOptions.map((option, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedRoute === index ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedRoute(index)}
              >
                <h4 className="font-medium mb-2">{option.name}</h4>
                <p className="text-sm text-gray-600 mb-2">{option.description}</p>
                <div className="text-xs text-gray-500">
                  <Clock className="h-3 w-3 inline mr-1" />~{option.estimatedTime} min
                </div>
              </div>
            ))}
          </div>

          {optimizedRoute && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-800 mb-2">✅ Ruta Optimizada</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-green-600 font-medium">Distancia:</span>
                  <div>{optimizedRoute.totalDistance.toFixed(1)} km</div>
                </div>
                <div>
                  <span className="text-green-600 font-medium">Tiempo:</span>
                  <div>
                    {Math.floor(optimizedRoute.estimatedTime / 60)}h {optimizedRoute.estimatedTime % 60}m
                  </div>
                </div>
                <div>
                  <span className="text-green-600 font-medium">Centros:</span>
                  <div>{optimizedRoute.schools.length}</div>
                </div>
                <div>
                  <span className="text-green-600 font-medium">Ahorro:</span>
                  <div className="text-green-600">~15% tiempo</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Centros en Orden de Ruta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Orden de Visita ({currentSchools.length} centros)</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportRouteToGoogleMaps(currentSchools)}>
                <MapPin className="h-4 w-4 mr-2" />
                Google Maps
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToRouteXL(currentSchools)}>
                <Route className="h-4 w-4 mr-2" />
                RouteXL
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Punto de inicio */}
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

            {currentSchools.map((school, index) => {
              const estimatedArrival = new Date()
              estimatedArrival.setHours(
                Number.parseInt(routePreferences.preferredStartTime.split(":")[0]),
                Number.parseInt(routePreferences.preferredStartTime.split(":")[1]) + (index + 1) * 25,
              )

              return (
                <div
                  key={school.name}
                  className="flex items-center p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow"
                >
                  <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{school.name}</div>
                    <div className="text-sm text-gray-600">📍 {school.address}</div>
                    <div className="text-xs text-blue-600 mt-1">
                      🎯 {school.activities.slice(0, 3).join(", ")}
                      {school.activities.length > 3 && ` +${school.activities.length - 3} más`}
                      {school.totalStudents && school.totalStudents > 0 && (
                        <span className="ml-2">👥 {school.totalStudents}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-700">
                      {estimatedArrival.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="text-xs text-gray-500">~20 min</div>
                  </div>
                </div>
              )
            })}

            {/* Punto final */}
            <div className="flex items-center p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm font-bold">
                🏁
              </div>
              <div className="flex-1">
                <div className="font-medium text-red-800">FINAL</div>
                <div className="text-sm text-red-600">{routePreferences.endLocation}</div>
                <div className="text-xs text-red-500">
                  {new Date(new Date().getTime() + (currentSchools.length + 1) * 25 * 60000).toLocaleTimeString(
                    "es-ES",
                    { hour: "2-digit", minute: "2-digit" },
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Herramientas Adicionales */}
      <Card>
        <CardHeader>
          <CardTitle>Herramientas de Navegación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" onClick={() => exportRouteToGoogleMaps(currentSchools)} className="w-full">
              <MapPin className="h-4 w-4 mr-2" />
              Google Maps
            </Button>
            <Button variant="outline" onClick={() => exportToRouteXL(currentSchools)} className="w-full">
              <Route className="h-4 w-4 mr-2" />
              RouteXL
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(currentSchools[0]?.address + ", Barcelona")}`
                window.open(wazeUrl, "_blank")
              }}
              className="w-full"
            >
              <Navigation className="h-4 w-4 mr-2" />
              Waze
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const addressList = currentSchools
                  .map(
                    (school, index) =>
                      `${index + 1}. ${school.name}\n   📍 ${school.address}, Barcelona\n   🎯 ${school.activities.join(", ")}\n`,
                  )
                  .join("\n")
                navigator.clipboard.writeText(addressList)
                alert("✅ Lista copiada al portapapeles")
              }}
              className="w-full"
            >
              <Package className="h-4 w-4 mr-2" />
              Copiar Lista
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de mapa simplificado (existente)
function WebRouteMap({ schools, day }: { schools: School[]; day: string }) {
  const openInOpenStreetMap = (school: School) => {
    const address = encodeURIComponent(`Escola ${school.name}, ${school.address}, Barcelona, España`)
    const url = `https://www.openstreetmap.org/search?query=${address}`
    window.open(url, "_blank")
  }

  const openAllInOpenStreetMap = () => {
    const url = `https://www.openstreetmap.org/#map=12/41.3851/2.1734`
    window.open(url, "_blank")
  }

  const openInBingMaps = (school: School) => {
    const address = encodeURIComponent(`Escola ${school.name}, ${school.address}, Barcelona, España`)
    const url = `https://www.bing.com/maps?q=${address}`
    window.open(url, "_blank")
  }

  const openInHereMaps = () => {
    const url = `https://wego.here.com/?map=41.3851,2.1734,12,normal`
    window.open(url, "_blank")
  }

  const copyAddressList = () => {
    const addressList = schools
      .map(
        (school, index) =>
          `${index + 1}. Escola ${school.name}\n   📍 ${school.address}, Barcelona\n   🎯 ${school.activities.join(", ")}\n   👥 ${school.totalStudents || 0} alumnos\n`,
      )
      .join("\n")

    navigator.clipboard.writeText(addressList).then(() => {
      alert("✅ Lista de direcciones copiada al portapapeles")
    })
  }

  const downloadRoute = () => {
    const routeData = schools.map((school, index) => ({
      orden: index + 1,
      centro: school.name,
      direccion: `Escola ${school.name}, ${school.address}, Barcelona`,
      actividades: school.activities.join(", "),
      ultimo_dia: school.lastActivityDay,
      monitor: school.monitor || "",
      alumnos: school.totalStudents || 0,
      precio: school.price || 0,
    }))

    const csvContent = [
      "Orden,Centro,Dirección,Actividades,Último Día,Monitor,Alumnos,Precio",
      ...routeData.map(
        (row) =>
          `${row.orden},"${row.centro}","${row.direccion}","${row.actividades}","${row.ultimo_dia}","${row.monitor}",${row.alumnos},${row.precio}`,
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ruta_${day}_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full space-y-4">
      <div className="w-full h-[400px] rounded-lg border shadow-sm bg-gradient-to-br from-blue-50 to-green-50 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-20 h-20 bg-blue-500 rounded-full"></div>
          <div className="absolute top-32 right-16 w-16 h-16 bg-green-500 rounded-full"></div>
          <div className="absolute bottom-20 left-20 w-12 h-12 bg-red-500 rounded-full"></div>
          <div className="absolute bottom-32 right-32 w-14 h-14 bg-yellow-500 rounded-full"></div>
        </div>

        <div className="text-center z-10">
          <Navigation className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Ruta del {day}</h3>
          <p className="text-gray-600 mb-6">{schools.length} centros programados</p>

          <Button onClick={openAllInOpenStreetMap} className="mb-2" size="lg">
            <ExternalLink className="h-5 w-5 mr-2" />
            Ver en OpenStreetMap
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Button onClick={copyAddressList} className="w-full" size="lg">
          <Package className="h-5 w-5 mr-2" />📋 Copiar direcciones
        </Button>

        <Button onClick={openInHereMaps} variant="outline" className="w-full bg-transparent" size="lg">
          <Navigation className="h-5 w-5 mr-2" />
          🗺️ Here Maps
        </Button>

        <Button onClick={downloadRoute} variant="outline" className="w-full bg-transparent" size="lg">
          <Clock className="h-5 w-5 mr-2" />📥 Descargar CSV
        </Button>

        <Button onClick={openAllInOpenStreetMap} variant="secondary" className="w-full" size="lg">
          <MapPin className="h-5 w-5 mr-2" />🌐 OpenStreetMap
        </Button>
      </div>

      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h4 className="font-semibold mb-4">
          🎯 Ruta del {day} ({schools.length} centros):
        </h4>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {schools.map((school, index) => (
            <div key={school.name} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border">
              <div className="flex items-center flex-1">
                <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{school.name}</div>
                  <div className="text-sm text-gray-600">📍 {school.address}</div>
                  <div className="text-xs text-blue-600 mt-1">
                    🎯 {school.activities.slice(0, 3).join(", ")}
                    {school.activities.length > 3 && ` +${school.activities.length - 3} más`}
                    {school.totalStudents && school.totalStudents > 0 && (
                      <span className="ml-2">👥 {school.totalStudents}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openInOpenStreetMap(school)}
                  className="text-blue-600"
                >
                  <MapPin className="h-4 w-4 mr-1" /> OSM
                </Button>
                <Button size="sm" variant="outline" onClick={() => openInBingMaps(school)} className="text-blue-600">
                  <MapPin className="h-4 w-4 mr-1" /> Bing
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h5 className="font-medium text-yellow-800 mb-2">💡 Opciones de navegación web:</h5>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>
            • <strong>🌐 OpenStreetMap:</strong> Mapa web que funciona en cualquier navegador
          </li>
          <li>
            • <strong>🗺️ Here Maps:</strong> Alternativa a Google Maps que funciona en navegador
          </li>
          <li>
            • <strong>📋 Copiar direcciones:</strong> Para usar en cualquier aplicación
          </li>
          <li>
            • <strong>📥 CSV:</strong> Para importar en Excel o cualquier otra aplicación
          </li>
        </ul>
      </div>
    </div>
  )
}

// Componente principal
export default function Home() {
  const [activeTab, setActiveTab] = useState("recogidas")
  const [activeDay, setActiveDay] = useState<"jueves" | "viernes">("jueves")
  const [searchTerm, setSearchTerm] = useState("")
  
  // Debounced search term para optimizar rendimiento en recogidas
  const debouncedPickupSearchTerm = useDebounced(searchTerm, 300)
  const [expandedSchool, setExpandedSchool] = useState<string | null>(null)
  const [schoolsDatabase, setSchoolsDatabase] = useState<School[]>([])
  const [deliverySchools, setDeliverySchools] = useState<DeliverySchool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [routeConfig, setRouteConfig] = useState<any>(null)

  // Función para cargar datos del Google Sheet
  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const sheetData = await fetchGoogleSheetData()

      // Procesar datos para recogidas
      const processedData = processGoogleSheetData(sheetData)

      // Procesar datos para entregas
      const deliveryData = processDeliveryData(sheetData)

      if (processedData.length === 0) {
        console.warn("No se procesaron datos, usando datos de ejemplo")
        setSchoolsDatabase(FALLBACK_DATA)
      } else {
        setSchoolsDatabase(processedData)
      }

      setDeliverySchools(deliveryData)
      setLastUpdated(new Date())
    } catch (err) {
      console.error("Error loading data, usando datos de ejemplo:", err)
      setError(err instanceof Error ? err.message : "Error desconocido")

      // Usar datos de ejemplo como fallback
      setSchoolsDatabase(FALLBACK_DATA)
      setDeliverySchools([])
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }

  // Cargar datos al montar el componente
  useEffect(() => {
    loadData()
  }, [])

  // Calcular qué centros visitar cada día (para recogidas)
  const schoolsByDay = useMemo(() => {
    const jueves: School[] = []
    const viernes: School[] = []

    schoolsDatabase.forEach((school) => {
      const collectionDay = getCollectionDay(school.lastActivityDay)
      if (collectionDay === "jueves") {
        jueves.push(school)
      } else if (collectionDay === "viernes") {
        viernes.push(school)
      }
    })

    return { jueves, viernes }
  }, [schoolsDatabase])

  // Pre-computar datos de las escuelas para optimizar rendimiento
  const schoolsWithPrecomputedData = useMemo(() => {
    const schools = schoolsByDay[activeDay]
    if (!schools?.length) return []
    
    return schools.map(school => ({
      ...school,
      materials: getMaterialsForActivities(school.activities),
      activityNames: getActivityNames(school.activities),
      schoolNameLower: school.name.toLowerCase(),
      monitorLower: school.monitor?.toLowerCase() || ""
    }))
  }, [activeDay, schoolsByDay])

  // Filtrar centros por término de búsqueda (para recogidas)
  // Optimized filteredSchools con datos pre-computados
  const filteredSchools = useMemo(() => {
    if (!schoolsWithPrecomputedData.length) return []
    
    const lowerSearchTerm = debouncedPickupSearchTerm.toLowerCase()
    
    // Si no hay búsqueda, retornar todos
    if (!lowerSearchTerm) return schoolsWithPrecomputedData
    
    return schoolsWithPrecomputedData.filter((school) => {
      return school.schoolNameLower.includes(lowerSearchTerm) ||
        school.activityNames.some((activity) =>
          activity.toLowerCase().includes(lowerSearchTerm)
        ) ||
        school.materials.some((material) =>
          material.toLowerCase().includes(lowerSearchTerm)
        ) ||
        school.monitorLower.includes(lowerSearchTerm)
    })
  }, [debouncedPickupSearchTerm, schoolsWithPrecomputedData])

  // Marcar centro como completado (memoizado)
  const toggleCompleted = useCallback((schoolName: string) => {
    const school = schoolsDatabase.find((s) => s.name === schoolName)
    if (school) {
      school.completed = !school.completed
      setActiveDay((prev) => prev)
    }
  }, [schoolsDatabase])

  // Expandir/colapsar detalles del centro (memoizado)
  const toggleExpanded = useCallback((schoolName: string) => {
    setExpandedSchool(expandedSchool === schoolName ? null : schoolName)
  }, [expandedSchool])

  // Función para abrir el editor de rutas con datos de recogidas
  const openPickupRouteEditor = () => {
    const routeItems = filteredSchools.map((school) => ({
      id: school.name,
      name: school.name,
      address: school.address,
      activities: school.activities,
      totalStudents: school.totalStudents,
      price: school.price,
      monitor: school.monitor,
      type: "pickup" as const,
    }))

    setRouteConfig({
      title: `Recogidas ${activeDay}`,
      items: routeItems,
      type: "pickup",
      selectedDay: activeDay,
    })
  }

  // Estado para manejar reorganizaciones de entregas
  const [deliveryReorganizations, setDeliveryReorganizations] = useState<{ [key: string]: any }>({})
  
  // Función para abrir el editor de rutas con datos de entregas - Vista completa semanal
  const openDeliveryRouteEditor = (allWeekPlans: DeliveryPlan[], dayName: string, deliveryType: string, weekStart: string, minStudentsFilter: number = 0, additionalPlans: DeliveryPlan[] = [], onReorganizeCb?: (items: any) => void, projectId?: string) => {
    // Recibimos todos los planes de la semana para permitir drag & drop entre días
    // También recibimos planes adicionales de la semana siguiente (adelantados)

    // Combinar planes de semana actual + adelantados de semana siguiente
    const combinedPlans = [...allWeekPlans, ...additionalPlans]

    console.log(`📦 Editor de rutas: ${allWeekPlans.length} centros semana actual + ${additionalPlans.length} adelantados`)

    const routeItems = combinedPlans.map((plan) => {
      // RESPETAR EL FILTRO DE ESTUDIANTES MÍNIMOS - Solo incluir actividades que cumplen el filtro
      const validActivities = plan.activities.filter((activity) => (activity.totalStudents || 0) >= minStudentsFilter)
      
      // Log para debugging
      if (validActivities.length !== plan.activities.length) {
        console.log(`🔍 Filtro de estudiantes aplicado en ${plan.school.name}: ${plan.activities.length} → ${validActivities.length} actividades (min: ${minStudentsFilter})`)
      }
      
      // Si no hay actividades válidas después del filtro, usar todas (fallback)
      const activitiesToUse = validActivities.length > 0 ? validActivities : plan.activities
      
      return {
        id: plan.school.name,
        name: plan.school.name,
        address: plan.school.address,
        activities: activitiesToUse.map((a) => a.activity),
        day: plan.deliveryDay,
        turn: activitiesToUse[0]?.turn,
        startTime: activitiesToUse[0]?.startTime,
        totalStudents: activitiesToUse.reduce((sum, a) => sum + (a.totalStudents || 0), 0),
        price: 0,
        monitor: "",
        type: "delivery" as const,
        priority: (plan as any).priority || false,
        filteredActivities: activitiesToUse,
        originalActivities: plan.activities.length,
      }
    })

    setRouteConfig({
      title: `Entregas Semana del ${format(new Date(weekStart), "PPP", { locale: es })}`,
      items: routeItems,
      type: "delivery",
      selectedDay: dayName,
      deliveryType: deliveryType,
      weekStart: weekStart,
      projectId: projectId,
      allPlans: allWeekPlans,
      onApplyChanges: (reorganizedItems: any) => {
        if (onReorganizeCb) {
          onReorganizeCb(reorganizedItems)
        }
        const reorganizationKey = `${deliveryType}_${weekStart}`
        setDeliveryReorganizations(prev => ({
          ...prev,
          [reorganizationKey]: reorganizedItems
        }))
      }
    })
  }

  // Mostrar pantalla de carga
  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Cargando datos...</h2>
          <p className="text-gray-600">Conectando con Google Sheets</p>
        </div>
      </main>
    )
  }

  // Mostrar pantalla de error
  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-red-800">Error al cargar datos</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadData} variant="outline" size="sm" className="mt-2 bg-transparent">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
            <h3 className="font-medium text-yellow-800 mb-2">Configuración necesaria:</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Verifica el ID del Google Sheet</li>
              <li>• Asegúrate de que el sheet sea público</li>
            </ul>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Editor de Rutas Modal */}
      {routeConfig && <RouteEditor config={routeConfig} onClose={() => setRouteConfig(null)} />}

      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Sistema de Gestión - Barcelona</h1>
          <p className="text-gray-600">
            {schoolsDatabase.length} centros totales • Horario: 9:00 - 15:00
            {lastUpdated && (
              <span className="block text-sm mt-1">Última actualización: {lastUpdated.toLocaleString("es-ES")}</span>
            )}
          </p>
          <Button onClick={loadData} variant="outline" size="sm" className="mt-2 bg-transparent">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar datos
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full rounded-full bg-gray-200 p-1 mb-6">
            <TabsTrigger value="entregas" className="flex-1 rounded-full px-4 py-2 text-center text-lg font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow">
              <Truck className="mr-2 h-5 w-5" />
              Entregas
            </TabsTrigger>
            <TabsTrigger value="recogidas" className="flex-1 rounded-full px-4 py-2 text-center text-lg font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow">
              <Package className="mr-2 h-5 w-5" />
              Recogidas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entregas">
            <DeliveryModule deliverySchools={deliverySchools} onOpenRouteEditor={openDeliveryRouteEditor} />
          </TabsContent>

          <TabsContent value="recogidas">
            <Tabs
              value={activeDay}
              onValueChange={(value) => setActiveDay(value as "jueves" | "viernes")}
              className="w-full"
            >
              <TabsList className="flex w-full rounded-full bg-gray-200 p-1 mb-6">
                <TabsTrigger value="jueves" className="flex-1 rounded-full px-4 py-2 text-center text-lg font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow">
                  <CalendarIcon className="mr-2 h-5 w-5" />
                  Jueves ({schoolsByDay.jueves.length} centros)
                </TabsTrigger>
                <TabsTrigger value="viernes" className="flex-1 rounded-full px-4 py-2 text-center text-lg font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow">
                  <CalendarIcon className="mr-2 h-5 w-5" />
                  Viernes ({schoolsByDay.viernes.length} centros)
                </TabsTrigger>
              </TabsList>

              {/* Información explicativa */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">
                      Datos cargados desde Google Sheets • {schoolsDatabase.length} centros
                    </p>
                    <p>Estructura: ESCOLA, MONITORA, DIA, TORN, ACTIVITAT, etc.</p>
                  </div>
                </div>
              </div>

              <div className="mb-6 flex justify-between items-center">
                <div className="flex items-center border rounded-md bg-white px-3 py-2 flex-1 mr-4">
                  <Search className="h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="Buscar centro, monitor, actividad o material..."
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button
                  onClick={openPickupRouteEditor}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={filteredSchools.length === 0}
                >
                  <Route className="h-4 w-4 mr-2" />
                  Editar Ruta ({filteredSchools.length})
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">
                    Centros para el {activeDay} ({filteredSchools.length})
                  </h2>

                  {filteredSchools.length === 0 ? (
                    <Card className="p-8 text-center">
                      <p className="text-gray-500">No hay centros que coincidan con la búsqueda</p>
                    </Card>
                  ) : (
                    <div className="space-y-4 max-h-[800px] overflow-y-auto">
                      {filteredSchools.map((school, index) => (
                        <SchoolCard
                          key={school.name}
                          school={school}
                          index={index}
                          materials={school.materials}
                          expandedSchool={expandedSchool}
                          setExpandedSchool={toggleExpanded}
                          toggleCompleted={toggleCompleted}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
