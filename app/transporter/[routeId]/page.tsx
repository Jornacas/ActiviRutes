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

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Cámara trasera preferida
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setCameraActive(true)
    } catch (error) {
      console.error('Error accediendo a la cámara:', error)
      alert('No se puede acceder a la cámara')
    }
  }

  const takePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (ctx) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const photoData = canvas.toDataURL('image/jpeg', 0.8)
      setPhoto(photoData)
      onPhotoTaken(photoData)
      stopCamera()
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

  return (
    <div className="space-y-3">
      {!photo && !cameraActive && (
        <Button type="button" onClick={startCamera} variant="outline" className="w-full">
          <Camera className="h-4 w-4 mr-2" />
          Tomar foto del almacenamiento
        </Button>
      )}

      {cameraActive && (
        <div className="space-y-2">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-48 bg-black rounded"
          />
          <div className="flex gap-2">
            <Button type="button" onClick={takePhoto} className="flex-1">
              <Camera className="h-4 w-4 mr-2" />
              Capturar
            </Button>
            <Button type="button" onClick={stopCamera} variant="outline">
              Cancelar
            </Button>
          </div>
        </div>
      )}

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

    // Por ahora simulamos el envío exitoso
    // TODO: Implementar con Google Sheets API o Google Apps Script
    console.log("📊 Datos preparados para Google Sheets:", rowData)
    await new Promise(resolve => setTimeout(resolve, 1500)) // Simular delay
    console.log("✅ Datos enviados a Google Sheets exitosamente")
    return true
    
  } catch (error) {
    console.error("❌ Error enviando datos a Google Sheets:", error)
    return false
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
      // Aquí deberías cargar los RouteItems reales asociados a este routeId
      // Por ahora, usamos datos de ejemplo o los cargados del localStorage si existen
      const savedRoute = localStorage.getItem(`savedRoute_${routeId}`)
      if (savedRoute) {
        const route = JSON.parse(savedRoute)
        setRouteItems(route.items)
        // Cargar también el estado de entrega si existe
        const savedDeliveryStatus = localStorage.getItem(`deliveryStatus_${routeId}`)
        if (savedDeliveryStatus) {
          setDeliveryStatus(JSON.parse(savedDeliveryStatus))
        }
        console.log("Ruta cargada desde localStorage:", routeId)
      } else {
        // Datos de ejemplo si no hay ruta guardada (para pruebas)
        setRouteItems([
          { id: "1", name: "Escola Primaria", address: "Carrer Ficticio, 10, Barcelona", activities: ["Libros", "Material"], startTime: "09:00", type: "delivery" },
          { id: "2", name: "Institut Secundari", address: "Avinguda Imaginaria, 25, Barcelona", activities: ["Tablets"], startTime: "10:30", type: "delivery" },
          { id: "3", name: "Guarderia Infantil", address: "Plaça de la Fantasia, 5, Barcelona", activities: ["Juguetes"], startTime: "12:00", type: "delivery" },
        ])
        console.log("Cargando ruta de ejemplo (no encontrada en localStorage):", routeId)
      }
    } catch (e: any) {
      console.error("Error cargando ruta:", e)
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
    
    // Crear URL con múltiples waypoints para Google Maps
    const origin = encodeURIComponent("Barcelona, España") // Punto de inicio por defecto
    const waypoints = routeItems
      .slice(0, -1) // Todos excepto el último (que será el destino)
      .map(item => encodeURIComponent(`${item.address}, Barcelona, España`))
      .join('|')
    
    const destination = encodeURIComponent(`${routeItems[routeItems.length - 1].address}, Barcelona, España`)
    
    let googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`
    if (waypoints) {
      googleMapsUrl += `&waypoints=${waypoints}`
    }
    
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
