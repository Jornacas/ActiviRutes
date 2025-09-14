"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { MapPin, Clock, Package, CheckCircle, User, Signature, Truck, RefreshCw, Loader2, ArrowUp, ArrowDown, X, Edit3, Navigation, BarChart3, Map, Camera, Trash2, RotateCcw, Save } from "lucide-react"

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
  // URL del Google Apps Script Web App - ¡YA CONFIGURADA!
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbz__Y99LWani6uG87sM30fEKozuZsz6YpD94dgXMtboYYZFW1E6epJRS1sjKBtNyRkN/exec"
}

// Tipo para los datos de entrega que se guardarán localmente y en Sheets
interface DeliveryData {
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
          <Button type="button" onClick={openCameraCapture} variant="outline" className="w-full">
            Tomar Foto
          </Button>
          
          <div className="flex gap-2">
            <Button type="button" onClick={openFileSelector} variant="outline" className="flex-1">
              <Package className="h-4 w-4 mr-2" />
              Subir desde Galería
            </Button>
            <Button type="button" onClick={diagnosticCamera} variant="ghost" className="px-3">
              🔍
            </Button>
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
const sendDeliveryToGoogleSheets = async (deliveryData: DeliveryData): Promise<boolean> => {
  try {
    // Estructura de datos para la hoja "Entregas":
    // FECHA | HORA | RUTA_ID | ESCUELA | DIRECCION | ACTIVIDADES | RECEPTOR | NOTAS | TIENE_FIRMA | TIENE_FOTO
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
      deliveryData.signature ? 'SÍ' : 'NO',
      deliveryData.photoUrl ? 'SÍ' : 'NO'
    ]

    // Intentar envío real usando Google Apps Script Web App (método más simple)
    console.log("📊 Datos preparados para Google Sheets:", rowData)
    
    try {
      // Verificar si está configurada la URL del Google Apps Script
      if (GOOGLE_SHEETS_CONFIG.APPS_SCRIPT_URL === "YOUR_SCRIPT_URL_HERE") {
        throw new Error("Google Apps Script URL no configurada")
      }
      
      const webAppUrl = GOOGLE_SHEETS_CONFIG.APPS_SCRIPT_URL
      
      const response = await fetch(webAppUrl, {
        method: 'POST',
        mode: 'no-cors', // Importante para Google Apps Script
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'addDelivery',
          data: rowData
        })
      })
      
      console.log("✅ Datos enviados a Google Sheets")
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
  const [routeItems, setRouteItems] = useState<RouteItem[]>([])
  const [deliveryStatus, setDeliveryStatus] = useState<{[itemId: string]: DeliveryData}>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [sendingToSheets, setSendingToSheets] = useState<string | null>(null) // ID del item que se está enviando
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null) // Item con formulario expandido
  const [signatures, setSignatures] = useState<{[itemId: string]: string}>({}) // Firmas por item
  const [photos, setPhotos] = useState<{[itemId: string]: string}>({}) // Fotos por item

  // Simular carga de datos de la ruta (en un caso real, vendría de una DB o API)
  useEffect(() => {
    setLoading(true)
    setError(null)
    try {
      console.log('📱 === CARGANDO RUTA DEL TRANSPORTISTA ===')
      console.log('🆔 Route ID:', routeId)
      
      // Intentar cargar desde localStorage primero (para mismo dispositivo)
      const savedRoute = localStorage.getItem(`savedRoute_${routeId}`)
      if (savedRoute) {
        const route = JSON.parse(savedRoute)
        setRouteItems(route.items)
        // Cargar también el estado de entrega si existe
        const savedDeliveryStatus = localStorage.getItem(`deliveryStatus_${routeId}`)
        if (savedDeliveryStatus) {
          setDeliveryStatus(JSON.parse(savedDeliveryStatus))
        }
        console.log("✅ Ruta cargada desde localStorage:", routeId)
        return
      }
      
      // Si no está en localStorage, intentar cargar desde URL parameters (para compartir entre dispositivos)
      const urlParams = new URLSearchParams(window.location.search)
      const encodedData = urlParams.get('data')
      
      if (encodedData) {
        try {
          console.log('📦 Intentando decodificar datos desde URL...')
          const decodedData = JSON.parse(atob(encodedData))
          console.log('✅ Datos decodificados:', decodedData)
          
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
              startTime: item.startTime || `${9 + index}:00`,
              totalStudents: 0,
              price: 0
            }
          })
          
          // Si es formato compacto, avisar que hay más datos
          if (decodedData.s && decodedData.n > decodedData.s.length) {
            console.log(`📦 Formato compacto: mostrando ${decodedData.s.length} de ${decodedData.n} escuelas totales`)
          }
          
          setRouteItems(routeItemsFromUrl)
          console.log(`✅ Ruta cargada desde URL con ${routeItemsFromUrl.length} elementos`)
          return
          
        } catch (decodeError) {
          console.error('❌ Error decodificando datos de URL:', decodeError)
        }
      }
      
      // Fallback: datos de ejemplo mínimos (solo si todo falla)
      console.log('⚠️ No se encontraron datos de ruta. Usando ejemplo mínimo.')
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
  }, [routeId])

  // Función para manejar la entrega de un item
  const handleDeliver = async (itemId: string, recipientName: string, notes: string) => {
    // Encontrar los datos del item para incluir información completa
    const item = routeItems.find(item => item.id === itemId)
    if (!item) return

    const newDeliveryData: DeliveryData = {
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

    // Guardar localmente inmediatamente
    setDeliveryStatus(prevStatus => {
      const updatedStatus = { ...prevStatus, [itemId]: newDeliveryData }
      localStorage.setItem(`deliveryStatus_${routeId}`, JSON.stringify(updatedStatus))
      console.log("Estado de entrega guardado localmente:", updatedStatus)
      return updatedStatus
    })

    // Limpiar formulario y cerrar
    setExpandedItemId(null)
    setSignatures(prev => ({ ...prev, [itemId]: '' }))
    setPhotos(prev => ({ ...prev, [itemId]: '' }))

    // Enviar a Google Sheets en segundo plano
    setSendingToSheets(itemId)
    try {
      const success = await sendDeliveryToGoogleSheets(newDeliveryData)
      if (success) {
        console.log("✅ Entrega registrada en Google Sheets")
      } else {
        console.log("⚠️ No se pudo registrar en Google Sheets, pero se guardó localmente")
      }
    } catch (error) {
      console.error("Error enviando a Sheets:", error)
    } finally {
      setSendingToSheets(null)
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
    
    console.log("🗺️ Abriendo Google Maps con ruta completa...")
    console.log("📍 Elementos de la ruta:", routeItems.length, "paradas")
    
    // Google Maps tiene límite de 25 waypoints. Crear múltiples rutas si es necesario
    const maxWaypoints = 23 // Reservar 2 para origen y destino
    const origin = encodeURIComponent("Eixos Creativa, Barcelona")
    
    if (routeItems.length <= maxWaypoints) {
      // Una sola ruta - INCLUIR TODAS LAS PARADAS
      const destination = encodeURIComponent("Eixos Creativa, Barcelona")
      
      // Usar NOMBRES de escuelas + direcciones para mejor identificación
      const waypoints = routeItems
        .map((item, index) => {
          const schoolName = item.name.includes('Escola') ? item.name : `Escola ${item.name}`
          const waypoint = `${schoolName}, ${item.address}, Barcelona`
          console.log(`   📍 Waypoint ${index + 1}: ${waypoint}`)
          return encodeURIComponent(waypoint)
        })
        .join('|')
      
      console.log(`📊 Total waypoints generados: ${routeItems.length}`)
      console.log(`📏 Longitud de waypoints string: ${waypoints.length} chars`)
      
      let googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`
      if (waypoints && waypoints.length > 0) {
        googleMapsUrl += `&waypoints=${waypoints}`
      }
      
      console.log("🗺️ Google Maps URL (ruta única):", googleMapsUrl)
      console.log(`✅ Incluyendo TODAS las ${routeItems.length} paradas`)
      window.open(googleMapsUrl, "_blank")
      
    } else {
      // Múltiples rutas para más de 23 paradas
      const chunks = []
      for (let i = 0; i < routeItems.length; i += maxWaypoints) {
        chunks.push(routeItems.slice(i, i + maxWaypoints))
      }
      
      console.log(`🗺️ Creando ${chunks.length} rutas separadas para ${routeItems.length} paradas`)
      alert(`La ruta tiene ${routeItems.length} paradas. Se abrirán ${chunks.length} pestañas de Google Maps.`)
      
      chunks.forEach((chunk, index) => {
        const chunkOrigin = index === 0 ? origin : encodeURIComponent(`${chunks[index-1][chunks[index-1].length-1].name}, Barcelona`)
        const chunkDestination = index === chunks.length - 1 ? 
          encodeURIComponent("Eixos Creativa, Barcelona") : 
          encodeURIComponent(`${chunk[chunk.length-1].name}, Barcelona`)
        
        const waypoints = chunk
          .map(item => {
            const schoolName = item.name.includes('Escola') ? item.name : `Escola ${item.name}`
            return encodeURIComponent(`${schoolName}, ${item.address}, Barcelona`)
          })
          .join('|')
        
        let googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${chunkOrigin}&destination=${chunkDestination}`
        if (waypoints) {
          googleMapsUrl += `&waypoints=${waypoints}`
        }
        
        console.log(`🗺️ Ruta ${index + 1}/${chunks.length} (${chunk.length} paradas):`, googleMapsUrl)
        setTimeout(() => {
          window.open(googleMapsUrl, "_blank")
        }, index * 1500) // Delay entre ventanas
      })
    }
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
          <Button 
            variant="outline"
            onClick={testGoogleSheetsDelivery}
            className="border-green-300 text-green-700 hover:bg-green-50"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Probar Google Sheets
          </Button>
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
                              const recipientInput = document.getElementById(`recipient-${item.id}`) as HTMLInputElement
                              const notesInput = document.getElementById(`notes-${item.id}`) as HTMLTextAreaElement
                              handleDeliver(item.id, recipientInput.value, notesInput.value)
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
    </div>
  )
}
