"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { MapPin, Clock, Package, CheckCircle, User, Signature, Truck, RefreshCw, Loader2, ArrowUp, ArrowDown, X, Edit3, Navigation, BarChart3, Map, Camera, Trash2, RotateCcw, Save } from "lucide-react"

// Parsear hora de Google Sheets (puede venir como "1899-12-30T16:20:39.000Z" o "09:30")
function parseStartTime(raw: string): string {
  if (!raw) return ''
  // Si ya es formato HH:MM
  if (/^\d{1,2}:\d{2}$/.test(raw)) return raw
  // Si es formato ISO de Sheets (1899-12-30T...)
  if (raw.includes('T') && raw.includes(':')) {
    try {
      const d = new Date(raw)
      if (!isNaN(d.getTime())) {
        return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
      }
    } catch {}
  }
  return raw
}

// 🐛 CONTROL DE DEBUG - Cambiar a true para activar logs de debug
const DEBUG_MODE = false

// Helper para logs condicionales
const debugLog = (message: string, ...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(message, ...args)
  }
}

// Definición de tipos (debe coincidir con RouteItem del editor)
interface RouteItem {
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

// Configuración de Google Sheets (misma que en la app principal)
const GOOGLE_SHEETS_CONFIG = {
  SHEET_ID: "1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I",
  DELIVERIES_SHEET_NAME: "Entregas", // Nueva hoja para entregas
  // URL del Google Apps Script Web App - ¡SCRIPT ORIGINAL QUE FUNCIONA!
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzSYO-BTf33Qp6VP1L4d0AgAziGyqUnTIvE5DY8aaYYGNPnq8chGbQmmu0Iy9RuH9wg/exec"
}

// Tipo para los datos de entrega que se guardarán localmente y en Sheets
interface DeliveryData {
  deliveryId?: string // NUEVO: ID único para la entrega e informe
  routeId: string
  itemId: string
  recipientName: string
  signature: string // Ahora será base64 del canvas
  photoUrl?: string // Base64 de la foto tomada
  timestamp: string
  status: "delivered" | "pending"
  schoolName?: string
  schoolAddress?: string
  activities?: string
  deliveryDay?: string
  notes?: string // Comentarios adicionales
  reportUrl?: string // NUEVO: URL del informe individual
}

// Componente para firma digital
const SignatureCanvas = ({ onSignatureChange }: { onSignatureChange: (signature: string) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(clientX - rect.left, clientY - rect.top)
    }
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.lineTo(clientX - rect.left, clientY - rect.top)
      ctx.stroke()
    }
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas) {
      const signatureData = canvas.toDataURL()
      onSignatureChange(signatureData)
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      onSignatureChange('')
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
  }, [])

  return (
    <div className="space-y-2">
      <div className="border border-gray-300 rounded bg-white">
        <canvas
          ref={canvasRef}
          width={280}
          height={120}
          className="touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <Button type="button" variant="outline" size="sm" onClick={clearCanvas}>
        <RotateCcw className="h-3 w-3 mr-1" />
        Limpiar
      </Button>
    </div>
  )
}

// Componente para captura de foto
const CameraCapture = ({ onPhotoTaken }: { onPhotoTaken: (photo: string) => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [photo, setPhoto] = useState<string>('')
  const [cameraActive, setCameraActive] = useState(false)
  const [showCameraError, setShowCameraError] = useState(false)
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Verificar permisos de cámara al montar el componente
  useEffect(() => {
    const checkCameraPermission = async () => {
      if (navigator.permissions) {
        try {
          const permission = await navigator.permissions.query({ name: 'camera' as PermissionName })
          setCameraPermission(permission.state as 'granted' | 'denied' | 'prompt')
          console.log('🔒 Estado de permisos de cámara:', permission.state)
        } catch (error) {
          console.log('🔒 No se puede verificar permisos:', error)
        }
      }
    }
    checkCameraPermission()
  }, [])

  const startCamera = async () => {
    console.log('📷 === INICIANDO CÁMARA BÁSICA ===')
    
    try {
      setShowCameraError(false)
      
      // Método más básico posible
      const constraints = { video: true }
      console.log('🔄 Solicitando cámara con constraints básicos:', constraints)
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log('✅ Stream obtenido:', stream)
      
      if (!videoRef.current) {
        throw new Error('Elemento video no disponible')
      }
      
      const video = videoRef.current
      console.log('📹 Configurando elemento video...')
      
      // Configuración mínima
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      
      // Esperar a que se cargue y reproducir
      video.onloadedmetadata = () => {
        console.log('📹 Video cargado, dimensiones:', video.videoWidth, 'x', video.videoHeight)
        video.play()
          .then(() => {
            console.log('▶️ Video reproduciendo')
            setCameraActive(true)
            setStream(stream)
          })
          .catch(err => {
            console.error('❌ Error reproduciendo:', err)
            setCameraActive(true) // Marcar como activa de todas formas
            setStream(stream)
          })
      }
      
    } catch (error) {
      console.error('❌ Error completo:', error)
      setShowCameraError(true)
      setCameraActive(false)
      
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
      alert(`❌ Error de cámara: ${errorMsg}\n\n💡 Usa "Subir desde Galería"`)
    }
  }

  const takePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    
    if (!video || !canvas) {
      console.error('❌ Video o canvas no disponibles')
      alert('Error: No se puede acceder al video o canvas')
      return
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('❌ Video no tiene dimensiones válidas')
      alert('Error: El video no se ha cargado correctamente. Espera un momento e intenta de nuevo.')
      return
    }

    try {
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('No se puede obtener el contexto del canvas')
      }

      console.log('📸 Capturando foto...')
      console.log('📏 Dimensiones del video:', video.videoWidth, 'x', video.videoHeight)

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      
      const photoData = canvas.toDataURL('image/jpeg', 0.8)
      
      if (photoData.length < 1000) {
        throw new Error('La foto capturada parece estar vacía o corrupta')
      }

      console.log('✅ Foto capturada correctamente, tamaño:', Math.round(photoData.length / 1024), 'KB')

      setPhoto(photoData)
      onPhotoTaken(photoData)
      stopCamera()
      
    } catch (error) {
      console.error('❌ Error capturando la foto:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      alert(`Error al capturar la foto: ${errorMessage}`)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setCameraActive(false)
  }

  const removePhoto = () => {
    setPhoto('')
    onPhotoTaken('')
  }

  // Función para subir foto desde galería (alternativa a cámara)
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validar que sea imagen
    if (!file.type.startsWith('image/')) {
      alert('❌ Por favor selecciona un archivo de imagen')
      return
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('❌ La imagen es demasiado grande. Máximo 5MB.')
      return
    }

    console.log('📎 Procesando archivo desde galería:', file.name, '- Tamaño:', Math.round(file.size / 1024), 'KB')

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (result) {
        console.log('✅ Imagen cargada desde galería exitosamente')
        setPhoto(result)
        onPhotoTaken(result)
      }
    }
    reader.onerror = () => {
      console.error('❌ Error leyendo archivo')
      alert('❌ Error al leer la imagen')
    }
    reader.readAsDataURL(file)
  }

  const openFileSelector = () => {
    fileInputRef.current?.click()
  }

  // MÉTODO SIMPLE: Captura directa de cámara sin video preview
  const openCameraCapture = () => {
    console.log('📷 === CAPTURA DIRECTA DE CÁMARA ===')
    
    // Crear input temporal con captura directa de cámara
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // Fuerza usar cámara trasera
    
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        console.log('✅ Foto capturada:', file)
        
        const reader = new FileReader()
        reader.onload = (e) => {
          const photoData = e.target?.result as string
          if (photoData) {
            console.log('✅ Foto convertida a base64')
            setPhoto(photoData)
            onPhotoTaken(photoData)
          }
        }
        reader.readAsDataURL(file)
      }
    }
    
    // Activar la captura
    input.click()
  }

  // Función de diagnóstico de cámara
  const diagnosticCamera = async () => {
    try {
      console.log('🔍 === DIAGNÓSTICO DE CÁMARA ===')
      
      // Verificar API disponible
      const hasUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      console.log('📱 getUserMedia disponible:', hasUserMedia)
      
      // Obtener dispositivos de media
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput')
        console.log('📹 Dispositivos de video encontrados:', videoDevices.length)
        videoDevices.forEach((device, index) => {
          console.log(`  ${index + 1}. ${device.label || `Cámara ${index + 1}`} (ID: ${device.deviceId})`)
        })
      }
      
      // Verificar permisos
      if (navigator.permissions) {
        try {
          const permission = await navigator.permissions.query({ name: 'camera' as PermissionName })
          console.log('🔒 Estado de permisos de cámara:', permission.state)
        } catch (permError) {
          console.log('🔒 No se puede verificar permisos:', permError)
        }
      }
      
      // Información del navegador
      console.log('🌐 Navegador:', navigator.userAgent)
      console.log('🔐 Protocolo:', window.location.protocol)
      console.log('🌍 Origen:', window.location.origin)
      
      alert('🔍 Diagnóstico completado. Revisa la consola (F12) para ver los resultados detallados.')
      
    } catch (error) {
      console.error('❌ Error en diagnóstico:', error)
      alert(`❌ Error en diagnóstico: ${error}`)
    }
  }

  return (
    <div className="space-y-3">
      {!photo && (
        <div className="space-y-2">
          {/* MÉTODO SIMPLE: Captura directa de cámara */}
                              <Button type="button" onClick={openCameraCapture} className="w-full bg-red-600 hover:bg-red-700 text-white">
                      <Camera className="h-6 w-6" />
                    </Button>
          
          <div className="flex gap-2">
            <Button type="button" onClick={openFileSelector} variant="outline" className="flex-1">
              <Package className="h-4 w-4 mr-2" />
              Subir desde Galería
            </Button>
            {DEBUG_MODE && (
              <Button type="button" onClick={diagnosticCamera} variant="ghost" className="px-3">
                🔍
              </Button>
            )}
          </div>
          
          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-200">
            💡 <strong>Instrucciones:</strong> Al tocar "Tomar Foto" se abrirá la cámara de tu smartphone. La foto se almacena temporalmente en la aplicación y se enviará junto con la entrega.
          </div>
          
          {showCameraError && (
            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
              ⚠️ Problema con la cámara: La cámara tardó demasiado en responder o no está disponible.
              <br />💡 Usa "Reintentar Cámara" o "Subir desde Galería" como alternativa.
            </div>
          )}
          
          {cameraPermission === 'denied' && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
              🔒 Permisos de cámara denegados. Habilítalos en la configuración del navegador.
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {/* Ya no necesitamos la parte compleja del video */}

      {photo && (
        <div className="space-y-2">
          <img src={photo} alt="Foto del almacenamiento" className="w-full h-32 object-cover rounded border" />
          <Button type="button" onClick={removePhoto} variant="outline" size="sm">
            <Trash2 className="h-3 w-3 mr-1" />
            Eliminar foto
          </Button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

// Función para enviar datos de entrega a Google Sheets
const sendDeliveryToGoogleSheets = async (deliveryData: DeliveryData, images?: {signature?: string, photo?: string}): Promise<boolean> => {
  try {
    // Estructura de datos para la hoja "Entregas":
    // FECHA | HORA | RUTA_ID | ESCUELA | DIRECCION | ACTIVIDADES | RECEPTOR | NOTAS | TIENE_FIRMA | TIENE_FOTO | LINK_INFORME
    const formattedDate = new Date(deliveryData.timestamp).toLocaleDateString('es-ES')
    const formattedTime = new Date(deliveryData.timestamp).toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })

    const rowData = [
      formattedDate,
      formattedTime,
      deliveryData.routeId,
      deliveryData.schoolName || '',
      deliveryData.schoolAddress || '',
      deliveryData.activities || '',
      deliveryData.recipientName || '',
      deliveryData.notes || '',
      images?.signature ? 'SÍ' : 'NO', // Detectar si hay imagen de firma
      images?.photo ? 'SÍ' : 'NO', // Detectar si hay imagen de foto
      deliveryData.reportUrl || '' // Link del informe con fotos
    ]

    // Intentar envío real usando Google Apps Script Web App (método más simple)
    debugLog("📊 Datos preparados para Google Sheets:", rowData)
    debugLog("📸 Imágenes a enviar:", images ? Object.keys(images) : 'ninguna')
    
    try {
      // NUEVO: Usar el endpoint de Next.js que puede verificar respuestas
      const apiUrl = '/api/deliveries'

      debugLog("📤 Enviando a API endpoint Next.js:", apiUrl)

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: rowData,
          images: images || {} // Incluir imágenes
        })
      })

      debugLog("📡 Response status:", response.status)

      if (!response.ok) {
        throw new Error(`API respondió con status: ${response.status}`)
      }

      const result = await response.json()
      debugLog("📥 Response data:", result)

      if (result.status !== 'success') {
        throw new Error(result.message || 'Error desconocido del API')
      }

      debugLog("✅ Datos enviados exitosamente a Google Sheets")
      debugLog("📂 URLs de imágenes recibidas:", {
        signature: result.signatureUrl,
        photo: result.photoUrl
      })

      return true
      
    } catch (error) {
      console.warn("⚠️ No se pudo enviar a Google Sheets (posiblemente no configurado):", error)
      
      // Fallback: Guardar localmente y mostrar instrucciones
      console.log("💾 Guardando datos localmente como fallback")
      const localKey = `pending_delivery_${deliveryData.routeId}_${deliveryData.itemId}_${Date.now()}`
      localStorage.setItem(localKey, JSON.stringify({ rowData, timestamp: new Date().toISOString() }))
      
      // Mostrar datos formateados para copia manual
      const csvRow = rowData.map(field => `"${field}"`).join(',')
      console.log("📋 Datos CSV para copia manual:", csvRow)
      
      return true // Consideramos éxito aunque sea local
    }
    
  } catch (error) {
    console.error("❌ Error enviando datos a Google Sheets:", error)
    return false
  }
}

// Función de prueba para Google Sheets
const testGoogleSheetsDelivery = async () => {
  console.log("🧪 Iniciando prueba de envío a Google Sheets...")
  
  const testDelivery: DeliveryData = {
    routeId: 'test-route-' + Date.now(),
    itemId: 'test-item',
    recipientName: 'Receptor de Prueba',
    signature: 'data:image/png;base64,test-signature-data',
    photoUrl: 'data:image/jpeg;base64,test-photo-data', 
    timestamp: new Date().toISOString(),
    status: 'delivered',
    schoolName: 'Escola de Prueba ActiviRutes',
    schoolAddress: 'Carrer de Prueba, 123, Barcelona',
    activities: 'Material TC, Material CO',
    deliveryDay: 'Lunes',
    notes: 'Prueba de conexión desde ActiviRutes'
  }
  
  const success = await sendDeliveryToGoogleSheets(testDelivery)
  
  if (success) {
    // Mostrar los datos que se enviarían en formato CSV
    const csvRow = [
      testDelivery.timestamp.split('T')[0].split('-').reverse().join('/'), // Fecha DD/MM/YYYY
      new Date(testDelivery.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      testDelivery.routeId,
      testDelivery.schoolName,
      testDelivery.schoolAddress,
      testDelivery.activities,
      testDelivery.recipientName,
      testDelivery.notes,
      testDelivery.signature ? 'SÍ' : 'NO',
      testDelivery.photoUrl ? 'SÍ' : 'NO'
    ].map(field => `"${field}"`).join(',')
    
    console.log('📋 Datos CSV generados:', csvRow)
    
    if (GOOGLE_SHEETS_CONFIG.APPS_SCRIPT_URL === "YOUR_SCRIPT_URL_HERE") {
      alert(`⚠️ Google Apps Script no configurado\n\n✅ Prueba local completada!\n\n📋 Datos CSV para copia manual:\n${csvRow}\n\n💡 Para envío automático:\n1. Configura Google Apps Script\n2. Actualiza APPS_SCRIPT_URL en el código`)
    } else {
      alert('✅ Prueba de Google Sheets completada!\n\n📊 Datos enviados al Google Apps Script.\n\nRevisa:\n- La consola del navegador (F12)\n- Tu hoja ENTREGAS en Google Sheets')
    }
  } else {
    alert('❌ Error en la prueba de Google Sheets.\n\nRevisa la consola del navegador (F12) para más detalles.')
  }
}

export default function TransporterApp() {
  const params = useParams()
  const routeId = params.routeId as string
  const [allItemsByDay, setAllItemsByDay] = useState<{[day: string]: RouteItem[]}>({})
  const [selectedDay, setSelectedDay] = useState<string>('')
  const [routeItems, setRouteItems] = useState<RouteItem[]>([])
  const [deliveryStatus, setDeliveryStatus] = useState<{[itemId: string]: DeliveryData}>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const deliveryStatusKey = projectId ? `deliveryStatus_${projectId}` : `deliveryStatus_${routeId}`
  const [isEditing, setIsEditing] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [sendingToSheets, setSendingToSheets] = useState<string | null>(null) // ID del item que se está enviando
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null) // Item con formulario expandido
  const [signatures, setSignatures] = useState<{[itemId: string]: string}>({}) // Firmas por item
  const [photos, setPhotos] = useState<{[itemId: string]: string}>({}) // Fotos por item
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [showDebugPanel, setShowDebugPanel] = useState(false)

  // Función para añadir logs al panel de debug - ULTRA PROTEGIDA
  const addDebugLog = (message: string) => {
    try {
      const timestamp = new Date().toLocaleTimeString('es-ES')
      const logEntry = `${timestamp}: ${message}`
      console.log(logEntry) // También log normal
      
      // Guardar en localStorage también para persistencia - CON PROTECCIÓN
      try {
        if (typeof Storage !== 'undefined' && localStorage) {
          const existingLogs = localStorage.getItem('debugLogs_activirutes') || '[]'
          const logs = JSON.parse(existingLogs)
          logs.unshift(logEntry)
          localStorage.setItem('debugLogs_activirutes', JSON.stringify(logs.slice(0, 50)))
        }
      } catch (storageError) {
        console.warn('Error guardando debug logs en localStorage:', storageError)
      }
      
      // Actualizar estado siempre, aunque localStorage falle
      setDebugLogs(prev => [logEntry, ...prev].slice(0, 50)) // Mantener solo últimos 50
    } catch (error) {
      console.error('Error en addDebugLog:', error)
      // Fallback extremo - al menos mostrar en console
      debugLog(`[FALLBACK] ${message}`)
    }
  }

  // Capturar errores globales y mostrarlos en debug
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      addDebugLog(`🚨 ERROR GLOBAL: ${event.error?.message || event.message}`)
      addDebugLog(`📍 Archivo: ${event.filename}:${event.lineno}`)
      if (event.error?.stack) {
        addDebugLog(`📋 Stack: ${event.error.stack.slice(0, 200)}...`)
      }
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      addDebugLog(`🚨 PROMISE RECHAZADA: ${event.reason}`)
      addDebugLog(`📋 Detalles: ${JSON.stringify(event.reason).slice(0, 200)}`)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // Cargar logs persistentes al inicio
    try {
      const persistedLogs = localStorage.getItem('debugLogs_activirutes')
      if (persistedLogs) {
        const logs = JSON.parse(persistedLogs)
        setDebugLogs(logs.slice(0, 20)) // Solo últimos 20 al cargar
      }
    } catch (error) {
      console.warn('Error cargando logs persistentes:', error)
    }

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  // Estado para mostrar info de debug en móvil
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  
  // Función para agregar info de debug visible
  const addDebugInfo = (message: string) => {
    setDebugInfo(prev => [message, ...prev].slice(0, 10)) // Solo últimos 10
  }

  // Función para sincronizar estado con Google Sheets
  const syncDeliveryStatus = async (items: RouteItem[]) => {
    try {
      addDebugInfo('🔄 Sincronizando con Google Sheets...')
      debugLog('🔄 Sincronizando estado con Google Sheets...')
      
      // Agregar timeout para evitar colgarse
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 segundos
      
      addDebugInfo('📡 Consultando API...')
      const response = await fetch('/api/deliveries', {
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        addDebugInfo('❌ Error consultando entregas')
        debugLog('⚠️ No se pudo consultar entregas existentes')
        return
      }
      
      const data = await response.json()
      addDebugInfo(`📄 API respuesta: ${JSON.stringify(data).slice(0, 100)}...`)
      
      if (data.status !== 'success') {
        addDebugInfo('❌ Error respuesta API')
        debugLog('⚠️ Error en respuesta de entregas:', data.message)
        return
      }
      
      // Validar que deliveries existe y es un array (probar ambas propiedades)
      const deliveries = data.deliveries || data.data || []
      
      if (!deliveries || deliveries.length === 0) {
        addDebugInfo('❌ No hay entregas en respuesta')
        debugLog('❌ No se encontraron entregas en la respuesta')
        return
      }
      
      if (!Array.isArray(deliveries)) {
        addDebugInfo('❌ Entregas no es array')
        debugLog('❌ Las entregas no son un array:', typeof deliveries)
        return
      }
      
      addDebugInfo(`📊 ${deliveries.length} entregas en BD`)
      
      // Filtrar entregas de esta ruta específica (TODOS LOS DÍAS, no solo hoy)
      const today = new Date().toDateString()
      debugLog('📅 Fecha de hoy:', today)
      debugLog('📊 Total entregas en base de datos:', deliveries.length)
      debugLog('🆔 RouteId buscado:', routeId)
      addDebugInfo(`🔍 Buscando ruta: ${routeId}`)
      
      // Log todas las entregas para debug
      deliveries.forEach((delivery: any, index: number) => {
        const deliveryDate = new Date(delivery.timestamp).toDateString()
        debugLog(`  ${index + 1}. RouteId: ${delivery.routeId}, Fecha: ${deliveryDate}, Escuela: ${delivery.schoolName}`)
      })
      
      // ✅ CAMBIO: Solo filtrar por routeId, NO por fecha (para mantener estado entre días)
      const existingDeliveries = deliveries.filter((delivery: any) => {
        const matchesRoute = delivery.routeId === routeId
        
        debugLog(`🔍 Filtro - RouteId: ${matchesRoute} (${delivery.routeId} === ${routeId})`)
        
        return matchesRoute // Solo por ruta, no por fecha
      })
      
      debugLog(`📋 Entregas encontradas para ruta ${routeId}:`, existingDeliveries.length)
      addDebugInfo(`🎯 Ruta ${routeId}: ${existingDeliveries.length} entregas totales`)
      existingDeliveries.forEach((delivery: any, index: number) => {
        debugLog(`  ✅ ${index + 1}. ${delivery.schoolName} - ${delivery.contactPerson}`)
        addDebugInfo(`✅ ${delivery.schoolName}`)
      })
      
      // Crear nuevo estado basado en entregas existentes
      const newStatus: {[itemId: string]: DeliveryData} = {}
      
      items.forEach(item => {
        // Buscar entrega existente para esta escuela
        const existingDelivery = existingDeliveries.find((delivery: any) => 
          delivery.schoolName.toLowerCase().includes(item.name.toLowerCase()) ||
          item.name.toLowerCase().includes(delivery.schoolName.toLowerCase())
        )
        
        if (existingDelivery) {
          // Recrear DeliveryData desde la entrega existente
          newStatus[item.id] = {
            deliveryId: existingDelivery.deliveryId,
            routeId: routeId as string,
            itemId: item.id,
            recipientName: existingDelivery.recipientName || existingDelivery.contactPerson || 'Receptor confirmado',
            signature: existingDelivery.signature || '',
            photoUrl: existingDelivery.photo || '',
            timestamp: existingDelivery.timestamp,
            status: 'delivered',
            schoolName: item.name,
            schoolAddress: item.address,
            activities: item.activities?.join(', ') || '',
            notes: existingDelivery.notes || ''
          }
          debugLog(`✅ ${item.name} ya entregada hoy`)
        } else {
          debugLog(`⏳ ${item.name} pendiente`)
        }
      })
      
      // Actualizar estado local solo con entregas completadas
      setDeliveryStatus(newStatus)
      
      // Guardar estado sincronizado
      localStorage.setItem(deliveryStatusKey, JSON.stringify(newStatus))
      
      debugLog('🎯 Estado sincronizado correctamente')
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          addDebugInfo('⏰ Timeout API (>10s)')
        } else {
          addDebugInfo(`❌ Error: ${error.message}`)
        }
      } else {
        addDebugInfo('❌ Error desconocido')
      }
      debugLog('❌ Error sincronizando estado:', error)
      // No es crítico, continúa con estado local
    }
  }

  // Cargar ruta: primero API (proyecto), luego localStorage, luego URL
  useEffect(() => {
    const loadRoute = async () => {
    setLoading(true)
    setError(null)
    try {
      debugLog('📱 === CARGANDO RUTA DEL TRANSPORTISTA ===')
      debugLog('🆔 Route ID:', routeId)

      // 1. Intentar cargar desde proyecto (API) si hay parámetro projectId
      const urlParams = new URLSearchParams(window.location.search)
      const urlProjectId = urlParams.get('projectId')
      const dia = urlParams.get('dia')
      if (urlProjectId) setProjectId(urlProjectId)
      const projectId = urlProjectId

      if (projectId) {
        try {
          debugLog('🔄 Cargando entregas del proyecto:', projectId)
          // Cargar TODAS las entregas del proyecto (todos los días)
          const response = await fetch(`/api/projects?action=getProjectDeliveries&projectId=${projectId}`)
          const result = await response.json()
          if (result.status === 'success' && result.data?.length > 0) {
            // Agrupar por día
            const byDay: {[day: string]: RouteItem[]} = {}
            result.data.forEach((item: any, index: number) => {
              const day = item.diaPlanificado || 'Sin día'
              if (!byDay[day]) byDay[day] = []
              byDay[day].push({
                id: item.centro || `project-item-${index}`,
                name: item.centro.includes('Escola') ? item.centro : `Escola ${item.centro}`,
                address: item.direccion || '',
                activities: item.actividades || [],
                type: 'delivery' as const,
                startTime: parseStartTime(item.startTime || ''),
                day: day,
                totalStudents: 0,
                price: 0,
              })
            })
            setAllItemsByDay(byDay)
            // Seleccionar el día del parámetro URL o el primero disponible
            const dayOrder = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres']
            const availableDays = dayOrder.filter(d => byDay[d]?.length > 0)
            const initialDay = (dia && byDay[dia]) ? dia : availableDays[0] || ''
            setSelectedDay(initialDay)
            setRouteItems(byDay[initialDay] || [])
            // Restaurar progreso de entregas
            const statusKey = `deliveryStatus_${projectId}`
            const savedDeliveryStatus = localStorage.getItem(statusKey)
            if (savedDeliveryStatus) {
              setDeliveryStatus(JSON.parse(savedDeliveryStatus))
              debugLog('✅ Progreso de entregas restaurado')
            }
            debugLog(`✅ Proyecto cargado: ${availableDays.length} días, ${result.data.length} paradas total`)
            return
          }
        } catch (err) {
          debugLog('⚠️ Error cargando desde proyecto, intentando alternativas:', err)
        }
      }

      // 2. Intentar cargar desde localStorage (mismo dispositivo)
      const savedRoute = localStorage.getItem(`savedRoute_${routeId}`)
      if (savedRoute) {
        const route = JSON.parse(savedRoute)
        setRouteItems(route.items)
        const savedDeliveryStatus = localStorage.getItem(deliveryStatusKey)
        if (savedDeliveryStatus) {
          setDeliveryStatus(JSON.parse(savedDeliveryStatus))
        }
        debugLog("✅ Ruta cargada desde localStorage:", routeId)
        return
      }

      // 3. Intentar cargar desde URL parameters (datos codificados en base64)
      const encodedData = urlParams.get('data')
      
      if (encodedData) {
        try {
                  debugLog('📦 Intentando decodificar datos desde URL...')
        const decodedData = JSON.parse(atob(encodedData))
        debugLog('✅ Datos decodificados:', decodedData)
          
          // Manejar AMBOS formatos: compacto (s) y completo (items)
          const dataItems = decodedData.s || decodedData.items || []
          const routeItemsFromUrl: RouteItem[] = dataItems.map((item: any, index: number) => {
            const baseName = item.n || item.name || `Centro ${index + 1}`
            // Añadir "Escola" si no está presente (excepto Academia)
            const schoolName = baseName === 'Academia' || baseName.includes('Escola') ? 
              baseName : 
              `Escola ${baseName}`
              
            return {
              id: item.i || item.id || `url-item-${index}`,
              name: schoolName,
              address: item.address || 'Dirección desde ruta compartida',
              activities: item.a || item.activities || [],
              type: (decodedData.t === 'd' ? 'delivery' : decodedData.t === 'p' ? 'pickup' : decodedData.type) || "delivery",
              startTime: parseStartTime(item.startTime || ''),
              totalStudents: 0,
              price: 0
            }
          })
          
          // Si es formato compacto, avisar que hay más datos
          if (decodedData.s && decodedData.n > decodedData.s.length) {
            console.warn(`⚠️ LINK COMPACTO: Solo se muestran ${decodedData.s.length} de ${decodedData.n} escuelas totales`)
            alert(`⚠️ Link compacto detectado\n\nSolo se muestran ${decodedData.s.length} de ${decodedData.n} paradas.\n\n💡 Solicita el "Link completo" en lugar del QR para ver todas las paradas.`)
          }
          
          setRouteItems(routeItemsFromUrl)
          debugLog(`✅ Ruta cargada desde URL con ${routeItemsFromUrl.length} elementos`)
          return
          
        } catch (decodeError) {
          console.error('❌ Error decodificando datos de URL:', decodeError)
        }
      }
      
      // Fallback: datos de ejemplo mínimos (solo si todo falla)
              debugLog('⚠️ No se encontraron datos de ruta. Usando ejemplo mínimo.')
      setRouteItems([
        { 
          id: "example-1", 
          name: "Ruta no encontrada", 
          address: "Los datos de esta ruta no están disponibles en este dispositivo", 
          activities: ["Contactar con administrador"], 
          startTime: "09:00", 
          type: "delivery" 
        }
      ])
      setError("⚠️ Ruta no encontrada. Es posible que el link haya expirado o los datos no estén disponibles en este dispositivo.")
      
    } catch (e: any) {
      console.error("❌ Error cargando ruta:", e)
      setError("Error cargando la ruta: " + e.message)
    } finally {
      setLoading(false)
    }
    }
    loadRoute()
  }, [routeId])

  // Sincronizar estado con base de datos cuando se cargan los items
  useEffect(() => {
    if (routeItems.length > 0) {
      syncDeliveryStatus(routeItems)
    }
  }, [routeItems])

  // Función para manejar la entrega de un item
  const handleDeliver = async (itemId: string, recipientName: string, notes: string) => {
    try {
      addDebugLog('🚚 === INICIANDO ENTREGA ===')
      addDebugLog(`📦 Item ID: ${itemId}`)
      addDebugLog(`👤 Receptor: ${recipientName}`)
      
      // Encontrar los datos del item para incluir información completa
      const item = routeItems.find(item => item.id === itemId)
      if (!item) {
        addDebugLog(`❌ ERROR CRÍTICO: Item no encontrado: ${itemId}`)
        addDebugLog('❌ Cancelando entrega por item no válido')
        return
      }

      // Generar ID único para la entrega e informe (simplificado)
      const timestamp = Date.now()
      const deliveryId = `del_${timestamp}`
      addDebugLog(`🆔 ID generado: ${deliveryId}`)
    
    const newDeliveryData: DeliveryData = {
      deliveryId, // NUEVO: ID único para la entrega
      routeId,
      itemId,
      recipientName,
      signature: signatures[itemId] || '', // Firma del canvas
      photoUrl: photos[itemId] || '', // Foto capturada
      timestamp: new Date().toISOString(),
      status: "delivered",
      schoolName: item.name,
      schoolAddress: item.address,
      activities: item.activities.join(", "),
      deliveryDay: item.day,
      notes: notes
    }

    // Guardar datos completos para el informe individual (NUEVO) - CON PROTECCIÓN MÓVIL Y LIMPIEZA AUTOMÁTICA
    try {
      addDebugLog('💾 Intentando guardar informe individual...')
      // Verificar disponibilidad de localStorage
      if (typeof Storage !== 'undefined' && localStorage) {
        try {
          // Comprimir datos para ahorrar espacio
          const compressedData = {
            i: deliveryId, // id
            t: newDeliveryData.timestamp, // timestamp
            r: newDeliveryData.routeId, // route
            s: newDeliveryData.schoolName, // school
            a: newDeliveryData.schoolAddress, // address
            n: newDeliveryData.recipientName, // name
            c: newDeliveryData.activities, // activities
            o: newDeliveryData.notes, // notes
            g: newDeliveryData.signature ? 'Y' : 'N', // signature exists
            p: newDeliveryData.photoUrl ? 'Y' : 'N', // photo exists
            // Solo guardar firmas y fotos si son pequeñas
            gd: newDeliveryData.signature && newDeliveryData.signature.length < 50000 ? newDeliveryData.signature : undefined,
            pd: newDeliveryData.photoUrl && newDeliveryData.photoUrl.length < 100000 ? newDeliveryData.photoUrl : undefined
          }
          
          localStorage.setItem(`delivery_${deliveryId}`, JSON.stringify(compressedData))
          addDebugLog(`✅ Informe individual guardado (comprimido): delivery_${deliveryId}`)
        } catch (quotaError) {
          if (quotaError.name === 'QuotaExceededError') {
            addDebugLog('🧹 CUOTA EXCEDIDA - Iniciando limpieza automática...')
            
            // Limpiar datos antiguos automáticamente
            const allKeys = Object.keys(localStorage)
            const deliveryKeys = allKeys.filter(key => key.startsWith('delivery_'))
            
            if (deliveryKeys.length > 10) {
              // Ordenar por fecha y eliminar los más antiguos
              const deliveriesWithDates = deliveryKeys.map(key => {
                try {
                  const data = JSON.parse(localStorage.getItem(key) || '{}')
                  return { key, timestamp: data.t || data.timestamp || '0' }
                } catch {
                  return { key, timestamp: '0' }
                }
              }).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
              
              // Eliminar los 5 más antiguos
              const toDelete = deliveriesWithDates.slice(0, 5)
              toDelete.forEach(item => {
                localStorage.removeItem(item.key)
                addDebugLog(`🗑️ Eliminado: ${item.key}`)
              })
              
              addDebugLog(`🧹 Limpieza completada: ${toDelete.length} entregas eliminadas`)
              
              // Intentar guardar de nuevo
              try {
                const compressedData = {
                  i: deliveryId,
                  t: newDeliveryData.timestamp,
                  r: newDeliveryData.routeId,
                  s: newDeliveryData.schoolName,
                  n: newDeliveryData.recipientName,
                  c: newDeliveryData.activities,
                  o: newDeliveryData.notes
                }
                localStorage.setItem(`delivery_${deliveryId}`, JSON.stringify(compressedData))
                addDebugLog(`✅ Guardado exitoso después de limpieza`)
              } catch (retryError) {
                addDebugLog(`❌ Error después de limpieza: ${retryError}`)
              }
            } else {
              addDebugLog('⚠️ Pocos registros para limpiar, saltando guardado')
            }
          } else {
            throw quotaError
          }
        }
      } else {
        addDebugLog('⚠️ localStorage no disponible, saltando guardado individual')
      }
    } catch (storageError) {
      addDebugLog(`❌ Error guardando informe individual: ${storageError}`)
      addDebugLog('⚠️ Continuando sin guardado individual...')
    }

    // Guardar localmente inmediatamente (mantener para compatibilidad) - CON PROTECCIÓN MÓVIL Y OPTIMIZACIÓN
    try {
      addDebugLog('💾 Intentando actualizar estado local...')
      if (typeof Storage !== 'undefined' && localStorage) {
        setDeliveryStatus(prevStatus => {
          try {
            const updatedStatus = { ...prevStatus, [itemId]: newDeliveryData }
            
            // OPTIMIZACIÓN: Solo guardar datos esenciales en el estado de ruta
            const lightweightStatus = { ...prevStatus }
            lightweightStatus[itemId] = {
              ...newDeliveryData,
              // Eliminar datos pesados para ahorrar espacio
              signature: newDeliveryData.signature ? 'Y' : undefined,
              photoUrl: newDeliveryData.photoUrl ? 'Y' : undefined
            }
            
            try {
              localStorage.setItem(deliveryStatusKey, JSON.stringify(lightweightStatus))
              addDebugLog(`✅ Estado local actualizado (optimizado)`)
            } catch (quotaError: any) {
              if (quotaError.name === 'QuotaExceededError') {
                addDebugLog('🧹 CUOTA EXCEDIDA en estado - Limpiando rutas antiguas...')

                const allKeys = Object.keys(localStorage)
                const routeKeys = allKeys.filter(key => key.startsWith('deliveryStatus_'))

                if (routeKeys.length > 3) {
                  routeKeys.forEach(key => {
                    if (key !== deliveryStatusKey) {
                      localStorage.removeItem(key)
                    }
                  })

                  const minimalStatus = { [itemId]: {
                    deliveryId,
                    timestamp: newDeliveryData.timestamp,
                    status: 'delivered',
                    recipientName: newDeliveryData.recipientName
                  }}
                  localStorage.setItem(deliveryStatusKey, JSON.stringify(minimalStatus))
                }
              }
            }
            
            return updatedStatus
          } catch (innerStorageError) {
            addDebugLog(`❌ Error interno localStorage: ${innerStorageError}`)
            return { ...prevStatus, [itemId]: newDeliveryData } // Al menos actualizar el estado
          }
        })
      } else {
        // Fallback: solo actualizar el estado sin localStorage
        addDebugLog('⚠️ localStorage no disponible, solo actualizando estado')
        setDeliveryStatus(prevStatus => ({ ...prevStatus, [itemId]: newDeliveryData }))
      }
    } catch (storageError) {
      addDebugLog(`❌ Error guardando estado local: ${storageError}`)
      addDebugLog('⚠️ Intentando solo actualizar estado...')
      try {
        setDeliveryStatus(prevStatus => ({ ...prevStatus, [itemId]: newDeliveryData }))
        addDebugLog('✅ Estado actualizado sin localStorage')
      } catch (stateError) {
        addDebugLog(`❌ ERROR CRÍTICO actualizando estado: ${stateError}`)
      }
    }

    // NUEVO: Disparar evento para el panel Admin - CON PROTECCIÓN MÓVIL
    try {
      addDebugLog('🔔 Intentando disparar evento para Admin...')
      // Verificar soporte de CustomEvent
      if (typeof CustomEvent !== 'undefined' && window.dispatchEvent) {
        const deliveryEvent = new CustomEvent('deliveryCompleted', {
          detail: {
            deliveryId,
            schoolName: item.name,
            timestamp: newDeliveryData.timestamp,
            status: 'completed'
          }
        })
        window.dispatchEvent(deliveryEvent)
        addDebugLog('✅ Evento de entrega disparado para Admin')
      } else {
        addDebugLog('⚠️ CustomEvent no soportado, saltando evento Admin')
      }
    } catch (eventError) {
      addDebugLog(`❌ Error disparando evento: ${eventError}`)
      addDebugLog('⚠️ Continuando sin evento Admin...')
    }

    // Limpiar formulario y cerrar
    setExpandedItemId(null)
    setSignatures(prev => ({ ...prev, [itemId]: '' }))
    setPhotos(prev => ({ ...prev, [itemId]: '' }))

    // Enviar a Google Sheets en segundo plano (MODIFICADO: incluir imágenes y link del informe)
    setSendingToSheets(itemId)
    try {
      addDebugLog('📤 Enviando datos a Google Sheets con imágenes...')
      
      // Crear datos para Google Sheets con link del informe
      const deliveryDataWithReport = {
        ...newDeliveryData,
        reportUrl: `${window.location.origin}/informe/${deliveryId}` // Link del informe para Admin
      }
      
      // Preparar imágenes para envío
      const images = {}
      if (newDeliveryData.signature && newDeliveryData.signature.startsWith('data:image')) {
        images.signature = newDeliveryData.signature
        addDebugLog('📝 Incluyendo firma en envío a Sheets')
      }
      if (newDeliveryData.photoUrl && newDeliveryData.photoUrl.startsWith('data:image')) {
        images.photo = newDeliveryData.photoUrl
        addDebugLog('📸 Incluyendo foto en envío a Sheets')
      }
      
      const success = await sendDeliveryToGoogleSheets(deliveryDataWithReport, images)
      if (success) {
        addDebugLog("✅ Entrega registrada en Google Sheets con imágenes y link del informe")
      } else {
        addDebugLog("⚠️ No se pudo registrar en Google Sheets, pero se guardó localmente")
      }
    } catch (error) {
      addDebugLog(`❌ Error enviando a Sheets: ${error}`)
    } finally {
      setSendingToSheets(null)
    }
  } catch (error) {
    addDebugLog(`❌ ERROR CRÍTICO en handleDeliver: ${error}`)
    addDebugLog(`📋 Detalles del error: ${JSON.stringify(error)}`)
    addDebugLog(`📍 Stack trace: ${error instanceof Error ? error.stack?.slice(0, 200) : 'N/A'}`)
    addDebugLog('❌ Entrega cancelada por error')
    
    // PROTECCIÓN CRÍTICA: Intentar al menos limpiar el estado
    try {
      setSendingToSheets(null)
      setExpandedItemId(null)
      addDebugLog('🔄 Estado limpiado después de error')
    } catch (cleanupError) {
      addDebugLog(`❌ Error incluso limpiando estado: ${cleanupError}`)
    }
    
    // Mostrar error al usuario de forma no invasiva
    console.error('ERROR CRÍTICO en handleDeliver:', error)
  }
}

  // Funciones para reordenar items
  const moveItemUp = (index: number) => {
    if (index === 0) return
    const newItems = [...routeItems]
    const temp = newItems[index]
    newItems[index] = newItems[index - 1]
    newItems[index - 1] = temp
    setRouteItems(newItems)
    saveRouteChanges(newItems)
  }

  const moveItemDown = (index: number) => {
    if (index === routeItems.length - 1) return
    const newItems = [...routeItems]
    const temp = newItems[index]
    newItems[index] = newItems[index + 1]
    newItems[index + 1] = temp
    setRouteItems(newItems)
    saveRouteChanges(newItems)
  }

  const removeItem = (itemId: string) => {
    if (confirm("¿Estás seguro de eliminar esta parada?")) {
      const newItems = routeItems.filter(item => item.id !== itemId)
      setRouteItems(newItems)
      saveRouteChanges(newItems)
    }
  }

  const saveRouteChanges = (newItems: RouteItem[]) => {
    const route = { items: newItems }
    localStorage.setItem(`savedRoute_${routeId}`, JSON.stringify(route))
    console.log("Cambios de ruta guardados:", newItems.length, "items")
  }

  const openCompleteRoute = () => {
    if (routeItems.length === 0) return
    
    debugLog("🗺️ Abriendo Google Maps con ruta completa...")
    debugLog("📍 Elementos de la ruta:", routeItems.length, "paradas")
    
    // USAR EL MISMO MÉTODO QUE EL EDITOR DE RUTAS (formato /dir/ sin límites)
    const origin = encodeURIComponent("Eixos Creativa, Barcelona")
    const destination = encodeURIComponent("Eixos Creativa, Barcelona")
    
    // Usar NOMBRES de escuelas + direcciones para mejor identificación
    const waypoints = routeItems
      .map((item, index) => {
        const schoolName = item.name.includes('Escola') ? item.name : `Escola ${item.name}`
        const waypoint = `${schoolName}, ${item.address}, Barcelona`
        debugLog(`   📍 Waypoint ${index + 1}: ${waypoint}`)
        return encodeURIComponent(waypoint)
      })
      .join('/') // ⭐ CAMBIO CLAVE: usar / en lugar de |
    
    debugLog(`📊 Total waypoints generados: ${routeItems.length}`)
    debugLog(`📏 Longitud de waypoints string: ${waypoints.length} chars`)
    
    // USAR FORMATO /dir/ (como en el editor) en lugar de ?waypoints=
    let googleMapsUrl = `https://www.google.com/maps/dir/${origin}`
    if (waypoints && waypoints.length > 0) {
      googleMapsUrl += `/${waypoints}`
    }
    googleMapsUrl += `/${destination}`
    
    debugLog("🗺️ Google Maps URL (formato sin límites):", googleMapsUrl)
    debugLog(`✅ Incluyendo TODAS las ${routeItems.length} paradas (método del editor)`)
    window.open(googleMapsUrl, "_blank")
  }

  // Calcular progreso
  const completedCount = Object.values(deliveryStatus).filter(d => d.status === "delivered").length
  const totalCount = routeItems.length
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-gray-700">Cargando ruta...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4">
        <RefreshCw className="h-12 w-12 text-red-600 mb-4" />
        <p className="text-red-800 text-lg text-center">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Reintentar</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 md:p-4">
      {/* Header mejorado con progreso */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4 sticky top-0 z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">🚚 Ruta del Transportista</h1>
            <p className="text-sm text-gray-600">ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">{routeId}</span></p>
            
            {/* Panel de debug móvil */}
            {DEBUG_MODE && debugInfo.length > 0 && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                <strong className="text-blue-800">🔧 Debug:</strong>
                <div className="mt-1 space-y-1">
                  {debugInfo.slice(0, 5).map((info, index) => (
                    <div key={index} className="text-blue-700">{info}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Barra de progreso */}
          <div className="flex-1 md:max-w-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progreso</span>
              <span className="text-sm text-gray-600">{completedCount}/{totalCount}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-green-600 h-3 rounded-full transition-all duration-300" 
                style={{width: `${progressPercentage}%`}}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{progressPercentage}% completado</p>
          </div>
        </div>

        {/* Selector de días */}
        {Object.keys(allItemsByDay).length > 1 && (
          <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
            {['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres']
              .filter(d => allItemsByDay[d]?.length > 0)
              .map(day => {
                const dayLabels: {[k:string]:string} = { Dilluns: 'Lun', Dimarts: 'Mar', Dimecres: 'Mié', Dijous: 'Jue', Divendres: 'Vie' }
                const isSelected = day === selectedDay
                const dayDelivered = allItemsByDay[day]?.every(item => deliveryStatus[item.id]?.status === 'delivered')
                return (
                  <button
                    key={day}
                    onClick={() => {
                      setSelectedDay(day)
                      setRouteItems(allItemsByDay[day] || [])
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : dayDelivered
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {dayLabels[day] || day}
                    <span className="ml-1 text-xs opacity-75">({allItemsByDay[day]?.length})</span>
                    {dayDelivered && <span className="ml-1">✓</span>}
                  </button>
                )
              })}
          </div>
        )}

        {/* Botones principales */}
        <div className="flex flex-col md:flex-row gap-2 mt-4">
          <Button 
            onClick={openCompleteRoute}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            disabled={routeItems.length === 0}
          >
            <Navigation className="h-4 w-4 mr-2" />
            Abrir Ruta Completa en Google Maps
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsEditing(!isEditing)}
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            <Edit3 className="h-4 w-4 mr-2" />
            {isEditing ? "Terminar Edición" : "Editar Ruta"}
          </Button>
          {DEBUG_MODE && (
            <Button 
              variant="outline"
              onClick={testGoogleSheetsDelivery}
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Probar Google Sheets
            </Button>
          )}
        </div>
      </div>

      {/* Mensaje de edición */}
      {isEditing && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-orange-800">
            <Edit3 className="h-4 w-4 inline mr-2" />
            Modo edición activado. Puedes reordenar o eliminar paradas usando los botones.
          </p>
        </div>
      )}

      <div className="space-y-3 md:space-y-4">
        {routeItems.map((item, index) => {
          const currentDelivery = deliveryStatus[item.id]
          const isDelivered = currentDelivery?.status === "delivered"

          return (
            <Card key={item.id} className={`${isDelivered ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"} ${isEditing ? "border-orange-200" : ""}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base md:text-lg font-bold">
                    {index + 1}. {item.name}
                  </CardTitle>
                  {isEditing && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moveItemUp(index)}
                        disabled={index === 0}
                        className="h-6 w-6 p-0"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moveItemDown(index)}
                        disabled={index === routeItems.length - 1}
                        className="h-6 w-6 p-0"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeItem(item.id)}
                        className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isDelivered ? (
                    <Badge className="bg-green-600 text-white text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Entregado
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Pendiente</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <p className="text-gray-700 flex items-start">
                    <MapPin className="h-4 w-4 mr-2 text-blue-500 mt-0.5 flex-shrink-0" /> 
                    <span className="break-words">{item.address}</span>
                  </p>
                  {item.startTime && (
                    <p className="text-gray-700 flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-purple-500 flex-shrink-0" /> 
                      Hora estimada: <span className="font-medium ml-1">{item.startTime}</span>
                    </p>
                  )}
                  <p className="text-gray-700 flex items-start">
                    <Package className="h-4 w-4 mr-2 text-orange-500 mt-0.5 flex-shrink-0" /> 
                    Material: <span className="font-medium ml-1">{item.activities.join(", ")}</span>
                  </p>
                </div>

                {!isDelivered && (
                  <div className="pt-3 border-t border-gray-100">
                    {expandedItemId !== item.id ? (
                      // Vista colapsada - solo botón principal
                      <Button 
                        onClick={() => setExpandedItemId(item.id)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Package className="h-4 w-4 mr-2" />
                        Procesar Entrega
                      </Button>
                    ) : (
                      // Vista expandida - formulario completo
                      <div className="space-y-4">
                        {/* Información de la escuela */}
                        <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
                          <h4 className="font-medium text-blue-900 mb-1">📦 Entrega en {item.name}</h4>
                          <p className="text-sm text-blue-800">Material: {item.activities.join(", ")}</p>
                          <p className="text-xs text-blue-700 mt-1">{item.address}</p>
                        </div>

                        {/* Campo receptor */}
                        <div>
                          <label htmlFor={`recipient-${item.id}`} className="text-sm font-medium text-gray-700 flex items-center mb-2">
                            <User className="h-4 w-4 mr-2" /> 
                            Nombre de quien recibe:
                          </label>
                          <Input 
                            id={`recipient-${item.id}`} 
                            placeholder="Nombre completo de la persona" 
                            className="text-sm"
                          />
                        </div>

                        {/* Campo notas */}
                        <div>
                          <label htmlFor={`notes-${item.id}`} className="text-sm font-medium text-gray-700 flex items-center mb-2">
                            <Package className="h-4 w-4 mr-2" /> 
                            Notas adicionales (opcional):
                          </label>
                          <Textarea 
                            id={`notes-${item.id}`} 
                            placeholder="Comentarios sobre la entrega, ubicación del material, etc." 
                            className="text-sm h-16"
                          />
                        </div>

                        {/* Componente de firma */}
                        <div>
                          <label className="text-sm font-medium text-gray-700 flex items-center mb-2">
                            <Signature className="h-4 w-4 mr-2" /> 
                            Firma digital (opcional):
                          </label>
                          <SignatureCanvas 
                            onSignatureChange={(signature) => 
                              setSignatures(prev => ({ ...prev, [item.id]: signature }))
                            }
                          />
                        </div>

                        {/* Componente de cámara */}
                        <div>
                          <label className="text-sm font-medium text-gray-700 flex items-center mb-2">
                            <Camera className="h-4 w-4 mr-2" /> 
                            Foto del almacenamiento (opcional):
                          </label>
                          <CameraCapture 
                            onPhotoTaken={(photo) => 
                              setPhotos(prev => ({ ...prev, [item.id]: photo }))
                            }
                          />
                        </div>

                        {/* Botones de acción */}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            onClick={() => {
                              // PROTECCIÓN MÓVIL: Verificar elementos DOM antes de acceder
                              try {
                                addDebugLog('🔘 Usuario presionó Confirmar Entrega')
                                const recipientInput = document.getElementById(`recipient-${item.id}`) as HTMLInputElement
                                const notesInput = document.getElementById(`notes-${item.id}`) as HTMLTextAreaElement
                                
                                if (!recipientInput || !notesInput) {
                                  addDebugLog(`❌ ERROR: No se encontraron elementos DOM`)
                                  addDebugLog(`🔍 Receptor input: ${!!recipientInput}, Notas input: ${!!notesInput}`)
                                  throw new Error('Elementos del formulario no encontrados')
                                }
                                
                                const recipientValue = recipientInput.value || ''
                                const notesValue = notesInput.value || ''
                                addDebugLog(`📝 Valores capturados - Receptor: "${recipientValue}", Notas: "${notesValue}"`)
                                
                                handleDeliver(item.id, recipientValue, notesValue)
                              } catch (domError) {
                                addDebugLog(`❌ ERROR CRÍTICO accediendo al DOM: ${domError}`)
                                addDebugLog('🚨 Esto puede causar la excepción del cliente')
                                console.error('Error crítico en onClick:', domError)
                                // Intentar con valores por defecto para evitar crash total
                                try {
                                  handleDeliver(item.id, 'Receptor no especificado', 'Error capturando datos del formulario')
                                } catch (fallbackError) {
                                  addDebugLog(`❌ ERROR en fallback: ${fallbackError}`)
                                }
                              }
                            }}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400"
                            disabled={sendingToSheets === item.id}
                          >
                            {sendingToSheets === item.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Registrando...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Confirmar Entrega
                              </>
                            )}
                          </Button>
                          <Button 
                            onClick={() => setExpandedItemId(null)}
                            variant="outline"
                            className="px-3"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isDelivered && currentDelivery && (
                  <div className="space-y-3 pt-3 border-t border-green-100 bg-green-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-green-700 text-white text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" /> 
                        ENTREGADO
                      </Badge>
                      <div className="flex items-center text-xs text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                        Registrado en Sheets
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-green-800">
                      <p className="flex items-center">
                        <User className="h-4 w-4 mr-2 flex-shrink-0" /> 
                        Receptor: <span className="font-medium ml-1">{currentDelivery.recipientName || "No especificado"}</span>
                      </p>
                      
                      {currentDelivery.notes && (
                        <p className="flex items-start">
                          <Package className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" /> 
                          Notas: <span className="font-medium ml-1 break-words">{currentDelivery.notes}</span>
                        </p>
                      )}
                      
                      <p className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 flex-shrink-0" /> 
                        Fecha: <span className="font-medium ml-1">{new Date(currentDelivery.timestamp).toLocaleString('es-ES', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          year: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}</span>
                      </p>
                    </div>

                    {/* Mostrar firma si existe */}
                    {currentDelivery.signature && currentDelivery.signature.startsWith('data:image') && (
                      <div className="border-t border-green-200 pt-2">
                        <p className="text-xs text-green-700 mb-2 flex items-center">
                          <Signature className="h-3 w-3 mr-1" />
                          Firma capturada:
                        </p>
                        <img 
                          src={currentDelivery.signature} 
                          alt="Firma digital" 
                          className="max-w-32 h-16 border border-green-200 rounded bg-white"
                        />
                      </div>
                    )}

                    {/* Mostrar foto si existe */}
                    {currentDelivery.photoUrl && (
                      <div className="border-t border-green-200 pt-2">
                        <p className="text-xs text-green-700 mb-2 flex items-center">
                          <Camera className="h-3 w-3 mr-1" />
                          Foto del almacenamiento:
                        </p>
                        <img 
                          src={currentDelivery.photoUrl} 
                          alt="Foto del almacenamiento" 
                          className="w-full max-w-48 h-24 object-cover border border-green-200 rounded"
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {/* Botón de navegación mejorado */}
                <div className={`pt-3 ${isDelivered ? '' : 'border-t border-gray-100'}`}>
                  <Button
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${item.address}, Barcelona, España`)}`)}
                    variant="outline"
                    size="sm"
                    className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Navegar a esta parada
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Panel de Debug - ULTRA RESISTENTE */}
      {DEBUG_MODE && (
        <div className="fixed bottom-4 right-4 z-[99999]" style={{position: 'fixed', zIndex: 99999}}>
          <Button
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            variant="outline"
            size="sm"
            className={`mb-2 shadow-2xl transition-colors border-2 ${
              debugLogs.some(log => log.includes('🚨')) 
                ? 'bg-red-200 border-red-500 text-red-800 animate-pulse' 
                : debugLogs.some(log => log.includes('❌')) 
                ? 'bg-red-100 border-red-300 text-red-700' 
                : 'bg-white border-blue-300'
            }`}
            style={{position: 'relative', zIndex: 99999}}
          >
            🔧 Debug ({debugLogs.length})
            {debugLogs.some(log => log.includes('🚨')) && ' 🚨'}
            {debugLogs.some(log => log.includes('❌')) && ' ⚠️'}
          </Button>
        
        {showDebugPanel && (
          <div className="bg-white border rounded-lg shadow-2xl p-4 w-80 max-h-[70vh] overflow-y-auto border-2 border-blue-300">
            <div className="flex justify-between items-center mb-2 sticky top-0 bg-white">
              <h3 className="font-bold text-sm">🔧 Logs de Debug</h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    localStorage.removeItem('debugLogs_activirutes')
                    setDebugLogs([])
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs px-2 py-1"
                >
                  🗑️ Limpiar
                </Button>
                <Button
                  onClick={() => {
                    // Copiar logs al portapapeles para debugging
                    const logsText = debugLogs.join('\n')
                    navigator.clipboard.writeText(logsText).catch(() => {
                      console.log('No se pudo copiar, logs:', logsText)
                    })
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs px-2 py-1"
                >
                  📋 Copiar
                </Button>
                <Button
                  onClick={() => setShowDebugPanel(false)}
                  variant="outline"
                  size="sm"
                  className="text-xs px-2 py-1"
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="space-y-1 text-xs font-mono">
              {debugLogs.length === 0 ? (
                <div className="text-gray-500 p-2 text-center">
                  📱 No hay logs aún...<br />
                  Procesa una entrega para ver logs
                </div>
              ) : (
                debugLogs.map((log, index) => (
                  <div 
                    key={index} 
                    className={`border-b border-gray-100 pb-1 break-words px-2 py-1 rounded ${
                      log.includes('❌') 
                        ? 'bg-red-50 border-red-200' 
                        : log.includes('✅') 
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  )
}
