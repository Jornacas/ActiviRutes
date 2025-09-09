"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { MapPin, Clock, Package, CheckCircle, User, Signature, Truck, RefreshCw, Loader2 } from "lucide-react"

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

// Tipo para los datos de entrega que se guardarán localmente
interface DeliveryData {
  routeId: string
  itemId: string
  recipientName: string
  signature: string
  photoUrl?: string // Por ahora no implementado, pero para futura referencia
  timestamp: string
  status: "delivered" | "pending"
}

export default function TransporterApp() {
  const params = useParams()
  const routeId = params.routeId as string
  const [routeItems, setRouteItems] = useState<RouteItem[]>([])
  const [deliveryStatus, setDeliveryStatus] = useState<{[itemId: string]: DeliveryData}>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  const handleDeliver = (itemId: string, recipientName: string, signature: string) => {
    const newDeliveryData: DeliveryData = {
      routeId,
      itemId,
      recipientName,
      signature,
      timestamp: new Date().toISOString(),
      status: "delivered",
    }

    setDeliveryStatus(prevStatus => {
      const updatedStatus = { ...prevStatus, [itemId]: newDeliveryData }
      localStorage.setItem(`deliveryStatus_${routeId}`, JSON.stringify(updatedStatus))
      console.log("Estado de entrega guardado localmente:", updatedStatus)
      return updatedStatus
    })
  }

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
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Ruta del Transportista</h1>
      <p className="text-center text-gray-600 mb-8">ID de Ruta: <span className="font-mono bg-gray-200 px-2 py-1 rounded">{routeId}</span></p>

      <div className="space-y-6">
        {routeItems.map((item, index) => {
          const currentDelivery = deliveryStatus[item.id]
          const isDelivered = currentDelivery?.status === "delivered"

          return (
            <Card key={item.id} className={isDelivered ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-bold">
                  {index + 1}. {item.name}
                </CardTitle>
                {isDelivered ? (
                  <Badge className="bg-green-600 text-white">
                    <CheckCircle className="h-4 w-4 mr-1" /> Entregado
                  </Badge>
                ) : (
                  <Badge variant="secondary">Pendiente</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600 flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-blue-500" /> {item.address}
                </p>
                {item.startTime && (
                  <p className="text-sm text-gray-600 flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-purple-500" /> Hora estimada: {item.startTime}
                  </p>
                )}
                <p className="text-sm text-gray-600 flex items-center">
                  <Package className="h-4 w-4 mr-2 text-orange-500" /> Material: {item.activities.join(", ")}
                </p>

                {!isDelivered && (
                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <div>
                      <label htmlFor={`recipient-${item.id}`} className="text-sm font-medium text-gray-700 flex items-center mb-1">
                        <User className="h-4 w-4 mr-2" /> Nombre de quien recibe:
                      </label>
                      <Input id={`recipient-${item.id}`} placeholder="Nombre completo" className="mt-1" />
                    </div>
                    <div>
                      <label htmlFor={`signature-${item.id}`} className="text-sm font-medium text-gray-700 flex items-center mb-1">
                        <Signature className="h-4 w-4 mr-2" /> Firma (opcional):
                      </label>
                      <Textarea id={`signature-${item.id}`} placeholder="Escribe aquí la firma o un comentario" className="mt-1" />
                    </div>
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => {
                        const recipientInput = document.getElementById(`recipient-${item.id}`) as HTMLInputElement
                        const signatureInput = document.getElementById(`signature-${item.id}`) as HTMLTextAreaElement
                        handleDeliver(item.id, recipientInput.value, signatureInput.value)
                      }}
                    >
                      <CheckCircle className="h-5 w-5 mr-2" /> Marcar como Entregado
                    </Button>
                  </div>
                )}

                {isDelivered && currentDelivery && (
                  <div className="space-y-2 pt-4 border-t border-gray-100 text-sm text-gray-700">
                    <p className="flex items-center"><User className="h-4 w-4 mr-2" /> Entregado a: <span className="font-medium ml-1">{currentDelivery.recipientName || "No especificado"}</span></p>
                    <p className="flex items-center"><Signature className="h-4 w-4 mr-2" /> Firma/Comentario: <span className="font-medium ml-1">{currentDelivery.signature || "No especificado"}</span></p>
                    <p className="flex items-center"><Clock className="h-4 w-4 mr-2" /> Entregado el: <span className="font-medium ml-1">{new Date(currentDelivery.timestamp).toLocaleString()}</span></p>
                  </div>
                )}
                
                <div className="pt-4 border-t border-gray-100">
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}, Barcelona, España`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    <MapPin className="h-4 w-4 mr-2" /> Abrir en Google Maps
                  </a>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
