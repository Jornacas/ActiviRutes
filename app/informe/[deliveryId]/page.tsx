"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  Download, 
  Share, 
  Printer, 
  Calendar,
  MapPin,
  User,
  Package,
  FileText,
  Camera,
  PenTool,
  ExternalLink
} from "lucide-react"

interface DeliveryData {
  deliveryId: string
  timestamp: string
  routeId: string
  schoolName: string
  schoolAddress: string
  recipientName: string
  activities: string
  notes: string
  signature?: string
  photoUrl?: string
  status: string
}

export default function InformePage() {
  const params = useParams()
  const router = useRouter()
  const [delivery, setDelivery] = useState<DeliveryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const deliveryId = params.deliveryId as string
    
    if (deliveryId) {
      // Cargar datos de la entrega desde localStorage
      try {
        const deliveryData = localStorage.getItem(`delivery_${deliveryId}`)
        if (deliveryData) {
          const parsed = JSON.parse(deliveryData)
          setDelivery(parsed)
        } else {
          console.error('Entrega no encontrada:', deliveryId)
        }
      } catch (error) {
        console.error('Error cargando entrega:', error)
      }
    }
    
    setLoading(false)
  }, [params.deliveryId])

  const downloadPhoto = () => {
    if (!delivery?.photoUrl) return
    
    const link = document.createElement('a')
    link.href = delivery.photoUrl
    link.download = `foto_entrega_${delivery.schoolName}_${new Date(delivery.timestamp).toISOString().split('T')[0]}.jpg`
    link.click()
  }

  const downloadSignature = () => {
    if (!delivery?.signature) return
    
    const link = document.createElement('a')
    link.href = delivery.signature
    link.download = `firma_entrega_${delivery.schoolName}_${new Date(delivery.timestamp).toISOString().split('T')[0]}.png`
    link.click()
  }

  const shareReport = async () => {
    const url = window.location.href
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Informe de entrega - ${delivery?.schoolName}`,
          text: `Entrega completada en ${delivery?.schoolName}`,
          url: url
        })
      } catch (error) {
        console.log('Error compartiendo:', error)
        copyToClipboard(url)
      }
    } else {
      copyToClipboard(url)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('✅ Link copiado al portapapeles')
    })
  }

  const printReport = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando informe...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!delivery) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-gray-900 mb-2">Informe no encontrado</h2>
            <p className="text-gray-600 mb-4">
              No se pudo encontrar la entrega solicitada.
            </p>
            <Button onClick={() => router.back()} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header con navegación */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Button onClick={() => router.back()} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al Admin
        </Button>
        
        <div className="flex gap-2">
          <Button onClick={shareReport} variant="outline" size="sm">
            <Share className="h-4 w-4 mr-2" />
            Compartir
          </Button>
          <Button onClick={printReport} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Informe principal */}
      <div className="space-y-6">
        {/* Encabezado del informe */}
        <Card>
          <CardHeader className="text-center bg-gradient-to-r from-blue-50 to-blue-100">
            <div className="flex items-center justify-center mb-2">
              <Package className="h-8 w-8 text-blue-600 mr-3" />
              <CardTitle className="text-2xl text-blue-900">Informe de Entrega</CardTitle>
            </div>
            <p className="text-blue-700">ActiviRutes - Sistema de Gestión de Entregas</p>
          </CardHeader>
        </Card>

        {/* Información de la entrega */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Datos de la Entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Fecha</p>
                    <p className="font-medium">{formatDate(delivery.timestamp)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Escuela</p>
                    <p className="font-medium">{delivery.schoolName}</p>
                    <p className="text-sm text-gray-500">{delivery.schoolAddress}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Receptor</p>
                    <p className="font-medium">{delivery.recipientName}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Actividades</p>
                    <p className="font-medium">{delivery.activities}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Hora de entrega</p>
                  <p className="font-medium">{formatTime(delivery.timestamp)}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">ID de ruta</p>
                  <p className="font-mono text-sm">{delivery.routeId}</p>
                </div>
              </div>
            </div>
            
            {delivery.notes && (
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600 mb-1">Notas</p>
                <p className="text-sm bg-gray-50 p-3 rounded-lg italic">
                  💬 {delivery.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Firma digital */}
        {delivery.signature && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <PenTool className="h-5 w-5 mr-2" />
                  Firma Digital
                </div>
                <Button onClick={downloadSignature} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Firma
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <div className="border-2 border-gray-200 rounded-lg p-4 bg-white max-w-md w-full">
                  <img 
                    src={delivery.signature} 
                    alt="Firma digital del receptor"
                    className="w-full h-auto max-h-32 object-contain"
                  />
                </div>
              </div>
              <div className="text-center mt-3">
                <Badge variant="outline" className="text-xs">
                  ✍️ Firmado por {delivery.recipientName}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Foto de entrega */}
        {delivery.photoUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Camera className="h-5 w-5 mr-2" />
                  Foto de Entrega
                </div>
                <Button onClick={downloadPhoto} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Foto
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <img 
                  src={delivery.photoUrl} 
                  alt="Foto de la entrega"
                  className="max-w-full h-auto max-h-96 rounded-lg border shadow-sm"
                />
              </div>
              <div className="text-center mt-3">
                <Badge variant="outline" className="text-xs">
                  📸 Capturada el {formatDate(delivery.timestamp)} a las {formatTime(delivery.timestamp)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Información del sistema */}
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="flex items-center">
              <ExternalLink className="h-5 w-5 mr-2" />
              Información del Informe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">ID de entrega</p>
                <p className="font-mono text-xs bg-gray-50 p-2 rounded">{delivery.deliveryId}</p>
              </div>
              <div>
                <p className="text-gray-600">URL del informe</p>
                <p className="font-mono text-xs bg-gray-50 p-2 rounded break-all">
                  {window.location.href}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button 
                onClick={() => copyToClipboard(window.location.href)} 
                variant="outline" 
                size="sm"
                className="flex-1"
              >
                📋 Copiar URL del informe
              </Button>
              <Button 
                onClick={() => window.open('/admin', '_blank')} 
                variant="outline" 
                size="sm"
                className="flex-1"
              >
                🎛️ Ir al Panel Admin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer para impresión */}
      <div className="hidden print:block mt-8 pt-4 border-t text-center text-xs text-gray-500">
        <p>Informe generado por ActiviRutes - {new Date().toLocaleString('es-ES')}</p>
        <p className="font-mono">{window.location.href}</p>
      </div>
    </div>
  )
} 