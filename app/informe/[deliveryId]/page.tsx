"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  MapPin, 
  User, 
  Package, 
  Calendar,
  Clock,
  CheckCircle2,
  ArrowLeft
} from "lucide-react"

interface DeliveryData {
  deliveryId: string
  schoolName: string
  contactPerson: string
  address: string
  timestamp: string
  signature?: string
  signatureUrl?: string
  photo?: string
  photoUrlDrive?: string
  status: string
  deliveredBy: string
  notes?: string
}

export default function InformePage({ params }: { params: { deliveryId: string } }) {
  const [delivery, setDelivery] = useState<DeliveryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDelivery() {
      try {
        // Primero intentar localStorage
        const localData = localStorage.getItem('adminDeliveries')
        if (localData) {
          const deliveries = JSON.parse(localData)
          const found = deliveries.find((d: DeliveryData) => d.deliveryId === params.deliveryId)
          if (found) {
            setDelivery(found)
            setLoading(false)
            return
          }
        }

        // Si no está en localStorage, cargar desde API
        const response = await fetch('/api/deliveries')
        if (response.ok) {
          const data = await response.json()
          if (data.status === 'success') {
            const found = data.deliveries.find((d: DeliveryData) => d.deliveryId === params.deliveryId)
            if (found) {
              setDelivery(found)
            }
          }
        }
      } catch (error) {
        console.error('Error cargando entrega:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDelivery()
  }, [params.deliveryId])

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-lg">Cargando informe...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!delivery) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-lg text-red-600">Entrega no encontrada</div>
            <Button 
              onClick={() => window.history.back()} 
              className="mt-4"
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getDirectGoogleDriveUrl = (url: string, forEmbed: boolean = false) => {
    if (!url) return url;

    if (url.startsWith('data:image/')) {
      return url;
    }

    let fileId = '';

    if (url.includes('/file/d/')) {
      fileId = url.split('/d/')[1].split('/')[0];
    } else if (url.includes('id=')) {
      fileId = url.split('id=')[1].split('&')[0];
    }

    if (fileId) {
      if (forEmbed) {
        return `https://lh3.googleusercontent.com/d/${fileId}=w800`;
      } else {
        return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
      }
    }

    return url;
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <Button 
          onClick={() => window.history.back()} 
          variant="outline"
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">Informe de Entrega</h1>
        <p className="text-gray-600">ID: {delivery.deliveryId}</p>
      </div>

      <div className="grid gap-6">
        {/* Información Principal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Información de la Entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{delivery.schoolName}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span>{delivery.contactPerson}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span>{delivery.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span>{new Date(delivery.timestamp).toLocaleDateString('es-ES')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span>{new Date(delivery.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <Badge variant="outline" className="bg-green-50">
                {delivery.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span>Entregado por: {delivery.deliveredBy}</span>
            </div>
            {delivery.notes && (
              <div className="p-3 bg-gray-50 rounded">
                <strong>Notas:</strong> {delivery.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documentación Visual */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Firma */}
          {(delivery.signatureUrl || (delivery.signature && delivery.signature.startsWith('http'))) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  ✍️ Firma de Recepción
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded text-center">
                  <img
                    src={getDirectGoogleDriveUrl(delivery.signatureUrl || delivery.signature || '', true)}
                    alt="Firma de recepción"
                    className="max-w-full h-auto mx-auto rounded border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="text-gray-500 py-8">✍️<br>Firma disponible<br><small>Click para ver</small></div>';
                        parent.onclick = () => window.open(getDirectGoogleDriveUrl(delivery.signatureUrl || delivery.signature || '', false), '_blank');
                        parent.style.cursor = 'pointer';
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Foto */}
          {(delivery.photoUrlDrive || (delivery.photo && delivery.photo.startsWith('http'))) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📸 Fotografía de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded text-center">
                  <img
                    src={getDirectGoogleDriveUrl(delivery.photoUrlDrive || delivery.photo || '', true)}
                    alt="Fotografía de entrega"
                    className="max-w-full h-auto mx-auto rounded border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="text-gray-500 py-8">📸<br>Foto disponible<br><small>Click para ver</small></div>';
                        parent.onclick = () => window.open(getDirectGoogleDriveUrl(delivery.photoUrlDrive || delivery.photo || '', false), '_blank');
                        parent.style.cursor = 'pointer';
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
} 