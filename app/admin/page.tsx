"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  RefreshCw, 
  Search, 
  Copy, 
  Trash2, 
  Download,
  Calendar,
  MapPin,
  User,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  Wifi,
  WifiOff
} from "lucide-react"

// Configuración de Google Sheets (igual que en el transportista)
const GOOGLE_SHEETS_CONFIG = {
  SHEET_ID: "1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I",
  DELIVERIES_SHEET_NAME: "Entregas",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbz__Y99LWani6uG87sM30fEKozuZsz6YpD94dgXMtboYYZFW1E6epJRS1sjKBtNyRkN/exec"
}

// Tipos para las entregas
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
  signatureUrl?: string // URL directa de Google Drive
  photoUrlDrive?: string // URL directa de Google Drive
  status: 'completed' | 'in-progress' | 'pending'
  source?: 'localStorage' | 'sheets'
}

interface DeliveryIndex {
  [deliveryId: string]: {
    timestamp: string
    status: string
    schoolName: string
    quickPreview: string
  }
}

export default function AdminPage() {
  const [deliveries, setDeliveries] = useState<DeliveryData[]>([])
  const [filteredDeliveries, setFilteredDeliveries] = useState<DeliveryData[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [dataSource, setDataSource] = useState<'local' | 'sheets'>('sheets')
  const [isConnectedToSheets, setIsConnectedToSheets] = useState(false)
  const [selectedDeliveries, setSelectedDeliveries] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [isClient, setIsClient] = useState(false) // Nuevo estado para controlar hidratación

  // Efecto para marcar cuando estamos en el cliente
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Función para sincronizar datos de Sheets a localStorage
  const syncSheetsDataToLocalStorage = (sheetsDeliveries: DeliveryData[]) => {
    try {
      console.log('🔄 Sincronizando datos de Sheets a localStorage...')
      
      sheetsDeliveries.forEach(delivery => {
        // Solo sincronizar datos básicos de Google Sheets (sin imágenes)
        // Para mantener compatibilidad con informes individuales
        const basicDeliveryData = {
          deliveryId: delivery.deliveryId,
          timestamp: delivery.timestamp,
          routeId: delivery.routeId,
          schoolName: delivery.schoolName,
          schoolAddress: delivery.schoolAddress,
          recipientName: delivery.recipientName,
          activities: delivery.activities,
          notes: delivery.notes,
          status: delivery.status,
          source: 'sheets_sync', // Marcar como sincronizado desde Sheets
          signature: delivery.signature ? 'Disponible en dispositivo original' : undefined,
          photoUrl: delivery.photoUrl ? 'Disponible en dispositivo original' : undefined
        }
        
        const key = `delivery_${delivery.deliveryId}`
        localStorage.setItem(key, JSON.stringify(basicDeliveryData))
      })
      
      console.log(`✅ ${sheetsDeliveries.length} entregas sincronizadas a localStorage (datos básicos)`)
    } catch (error) {
      console.warn('⚠️ Error sincronizando a localStorage:', error)
    }
  }

  // Cargar entregas desde Google Sheets VÍA ENDPOINT NEXTJS
  const loadDeliveriesFromSheets = async () => {
    setIsLoading(true)
    
    try {
      console.log('📊 Cargando entregas desde Google Sheets vía endpoint...')
      
      // Usar nuestro endpoint de Next.js que evita CORS
      const response = await fetch('/api/deliveries', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('📥 Respuesta del endpoint:', result.status, result.message)
      
      if (result.status === 'success') {
        console.log(`✅ ${result.data.length} entregas obtenidas desde Google Sheets`)
        
        // Ordenar datos de Google Sheets (más recientes primero)
        const sortedDeliveries = result.data.sort((a: DeliveryData, b: DeliveryData) => {
          const dateA = new Date(a.timestamp).getTime()
          const dateB = new Date(b.timestamp).getTime()
          return dateB - dateA // Descendente: más recientes primero
        })
        
        // Sincronizar con localStorage para que los informes funcionen
        syncSheetsDataToLocalStorage(sortedDeliveries)
        
        setDeliveries(sortedDeliveries)
        setIsConnectedToSheets(true)
        setLastUpdate(new Date())
      } else {
        throw new Error(result.message || 'Error desconocido del endpoint')
      }
      
    } catch (error) {
      console.error('❌ Error conectando con Google Sheets:', error)
      setIsConnectedToSheets(false)
      console.log('🔄 Fallback: Cargando datos locales...')
      // Fallback a datos locales
      loadDeliveriesFromLocalStorage()
    } finally {
      setIsLoading(false)
    }
  }

  // Cargar entregas desde localStorage (función renombrada para claridad)
  const loadDeliveriesFromLocalStorage = () => {
    try {
      const allKeys = Object.keys(localStorage)
      const deliveryKeys = allKeys.filter(key => key.startsWith('delivery_'))
      
      const loadedDeliveries: DeliveryData[] = []
      
      deliveryKeys.forEach(key => {
        try {
          const deliveryData = JSON.parse(localStorage.getItem(key) || '{}')
          
          // Detectar si son datos comprimidos (nuevo formato) o normales (formato anterior)
          const isCompressed = deliveryData.i && deliveryData.t // Si tiene 'i' y 't' es formato comprimido
          
          let normalizedDelivery: DeliveryData
          
          if (isCompressed) {
            // Descomprimir datos del nuevo formato
            normalizedDelivery = {
              deliveryId: deliveryData.i,
              timestamp: deliveryData.t,
              routeId: deliveryData.r || 'N/A',
              schoolName: deliveryData.s || 'Desconocida',
              schoolAddress: deliveryData.a || '',
              recipientName: deliveryData.n || '',
              activities: deliveryData.c || '',
              notes: deliveryData.o || '',
              signature: deliveryData.gd || (deliveryData.g === 'Y' ? 'Disponible' : undefined),
              photoUrl: deliveryData.pd || (deliveryData.p === 'Y' ? 'Disponible' : undefined),
              status: 'completed'
            }
          } else if (deliveryData.deliveryId) {
            // Formato anterior (compatibilidad)
            normalizedDelivery = {
              deliveryId: deliveryData.deliveryId,
              timestamp: deliveryData.timestamp,
              routeId: deliveryData.routeId || 'N/A',
              schoolName: deliveryData.schoolName || 'Desconocida',
              schoolAddress: deliveryData.schoolAddress || '',
              recipientName: deliveryData.recipientName || '',
              activities: deliveryData.activities || '',
              notes: deliveryData.notes || '',
              signature: deliveryData.signature,
              photoUrl: deliveryData.photoUrl,
              status: 'completed'
            }
          } else {
            return // Saltar si no tiene formato válido
          }
          
          loadedDeliveries.push(normalizedDelivery)
        } catch (error) {
          console.warn(`Error cargando entrega ${key}:`, error)
        }
      })
      
      // Ordenar por timestamp (más recientes PRIMERO - arriba)
      loadedDeliveries.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime()
        const dateB = new Date(b.timestamp).getTime()
        return dateB - dateA // Descendente: más recientes primero
      })
      
      setDeliveries(loadedDeliveries)
      setLastUpdate(new Date())
      
      console.log(`📊 Cargadas ${loadedDeliveries.length} entregas desde localStorage`)
      
    } catch (error) {
      console.error('Error cargando entregas locales:', error)
    }
  }

  // Función principal de carga (decide la fuente)
  const loadDeliveries = () => {
    if (dataSource === 'sheets') {
      loadDeliveriesFromSheets()
    } else {
      setIsLoading(true)
      loadDeliveriesFromLocalStorage()
      setIsLoading(false)
    }
  }

  // Aplicar filtros
  useEffect(() => {
    let filtered = deliveries

    // Filtro por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(delivery => 
        delivery.schoolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.activities.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtro por fecha
    if (selectedDate) {
      filtered = filtered.filter(delivery => 
        delivery.timestamp.startsWith(selectedDate)
      )
    }

    // Filtro por estado
    if (statusFilter !== "all") {
      filtered = filtered.filter(delivery => delivery.status === statusFilter)
    }

    // Ordenar por fecha más reciente primero
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime()
      const dateB = new Date(b.timestamp).getTime()
      return dateB - dateA // Orden descendente (más reciente primero)
    })

    setFilteredDeliveries(filtered)
  }, [deliveries, searchTerm, selectedDate, statusFilter])

  // Cargar datos al montar el componente
  useEffect(() => {
    loadDeliveries()
    
    // Escuchar eventos de nuevas entregas
    const handleNewDelivery = (event: CustomEvent) => {
      console.log('🔔 Nueva entrega recibida en Admin:', event.detail)
      loadDeliveries() // Recargar lista
    }
    
    window.addEventListener('deliveryCompleted', handleNewDelivery as EventListener)
    
    return () => {
      window.removeEventListener('deliveryCompleted', handleNewDelivery as EventListener)
    }
  }, [])

  // Estadísticas
  const stats = {
    total: deliveries.length,
    completed: deliveries.filter(d => d.status === 'completed').length,
    inProgress: deliveries.filter(d => d.status === 'in-progress').length,
    pending: deliveries.filter(d => d.status === 'pending').length
  }

  // Copiar datos de entrega
  const copyDeliveryData = (delivery: DeliveryData) => {
    const csvRow = [
      new Date(delivery.timestamp).toLocaleDateString('es-ES'),
      new Date(delivery.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      delivery.schoolName,
      delivery.schoolAddress,
      delivery.recipientName,
      delivery.activities,
      delivery.notes,
      delivery.signature ? 'SÍ' : 'NO',
      delivery.photoUrl ? 'SÍ' : 'NO'
    ].map(field => `"${field}"`).join(',')
    
    navigator.clipboard.writeText(csvRow).then(() => {
      alert('✅ Datos copiados al portapapeles')
    })
  }

  // Manejar selección individual
  const handleSelectDelivery = (deliveryId: string, checked: boolean) => {
    const newSelected = new Set(selectedDeliveries)
    if (checked) {
      newSelected.add(deliveryId)
    } else {
      newSelected.delete(deliveryId)
    }
    setSelectedDeliveries(newSelected)
    setSelectAll(newSelected.size === filteredDeliveries.length && filteredDeliveries.length > 0)
  }

  // Manejar seleccionar/deseleccionar todo
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredDeliveries.map(d => d.deliveryId))
      setSelectedDeliveries(allIds)
    } else {
      setSelectedDeliveries(new Set())
    }
    setSelectAll(checked)
  }

  // Eliminar entrega individual
  const deleteDelivery = (deliveryId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta entrega?')) {
      console.log('🗑️ Eliminando entrega:', deliveryId)

      // Buscar la entrega para determinar el origen
      const deliveryToDelete = deliveries.find(d => d.deliveryId === deliveryId)
      
      if (deliveryToDelete?.source === 'sheets') {
        console.log('⚠️ Esta entrega viene de Google Sheets y no se puede eliminar desde aquí')
        alert('Esta entrega viene de Google Sheets y no se puede eliminar desde el admin. Se eliminará del Google Sheets directamente.')
      } else {
        // Intentar eliminar con diferentes formatos de clave localStorage
        const possibleKeys = [
          `delivery_${deliveryId}`,
          deliveryId.startsWith('del_') ? `delivery_${deliveryId}` : `delivery_del_${deliveryId}`,
          deliveryId.replace('sheets_', 'del_')
        ]
        
        let removed = false
        possibleKeys.forEach(key => {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key)
            console.log(`🗑️ Eliminado localStorage key: ${key}`)
            removed = true
          }
        })
        
        if (!removed) {
          console.warn('⚠️ No se encontró la entrega en localStorage, eliminando solo del estado')
        }
      }

      // Actualizar estado inmediatamente (no esperar a loadDeliveries)
      setDeliveries(prev => prev.filter(d => d.deliveryId !== deliveryId))

      // Limpiar selección si estaba seleccionada
      setSelectedDeliveries(prev => {
        const newSelected = new Set(prev)
        newSelected.delete(deliveryId)
        return newSelected
      })

      // Actualizar selectAll si es necesario
      setSelectAll(false)

      console.log('✅ Entrega eliminada y estado actualizado')
    }
  }

  // Eliminar entregas seleccionadas
  const deleteSelectedDeliveries = () => {
    if (selectedDeliveries.size === 0) {
      alert('No hay entregas seleccionadas')
      return
    }

    const selectedArray = Array.from(selectedDeliveries)
    const sheetsEntries = selectedArray.filter(id => {
      const delivery = deliveries.find(d => d.deliveryId === id)
      return delivery?.source === 'sheets'
    })

    if (sheetsEntries.length > 0) {
      alert(`${sheetsEntries.length} de las entregas seleccionadas vienen de Google Sheets y no se pueden eliminar desde aquí.`)
    }

    if (confirm(`¿Estás seguro de que quieres eliminar ${selectedDeliveries.size} entregas seleccionadas?`)) {
      console.log('🗑️ Eliminando entregas seleccionadas:', selectedArray)

      // Remover de localStorage (intentar diferentes formatos)
      selectedDeliveries.forEach(deliveryId => {
        const possibleKeys = [
          `delivery_${deliveryId}`,
          deliveryId.startsWith('del_') ? `delivery_${deliveryId}` : `delivery_del_${deliveryId}`,
          deliveryId.replace('sheets_', 'del_')
        ]
        
        possibleKeys.forEach(key => {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key)
            console.log(`🗑️ Eliminado localStorage key: ${key}`)
          }
        })
      })

      // Actualizar estado inmediatamente (filtrar entregas eliminadas)
      setDeliveries(prev => prev.filter(d => !selectedDeliveries.has(d.deliveryId)))

      // Limpiar selecciones
      setSelectedDeliveries(new Set())
      setSelectAll(false)

      console.log('✅ Entregas eliminadas y estado actualizado')
      alert(`✅ ${selectedDeliveries.size} entregas eliminadas`)
    }
  }

  // Exportar todas las entregas
  const exportAllDeliveries = () => {
    const csvHeader = 'Fecha,Hora,Escuela,Dirección,Receptor,Actividades,Notas,Tiene Firma,Tiene Foto'
    const csvRows = filteredDeliveries.map(delivery => {
      return [
        new Date(delivery.timestamp).toLocaleDateString('es-ES'),
        new Date(delivery.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        delivery.schoolName,
        delivery.schoolAddress,
        delivery.recipientName,
        delivery.activities,
        delivery.notes,
        delivery.signature ? 'SÍ' : 'NO',
        delivery.photoUrl ? 'SÍ' : 'NO'
      ].map(field => `"${field}"`).join(',')
    })
    
    const csvContent = [csvHeader, ...csvRows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `entregas_activirutes_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Limpiar entregas antiguas
  const cleanOldDeliveries = () => {
    const daysToKeep = prompt('¿Cuántos días de entregas quieres mantener? (Las más antiguas se eliminarán)')
    if (!daysToKeep) return
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysToKeep))
    
    const keysToDelete = Object.keys(localStorage)
      .filter(key => key.startsWith('delivery_'))
      .filter(key => {
        try {
          const delivery = JSON.parse(localStorage.getItem(key) || '{}')
          return new Date(delivery.timestamp) < cutoffDate
        } catch {
          return false
        }
      })
    
    if (keysToDelete.length === 0) {
      alert('No hay entregas antiguas para eliminar')
      return
    }
    
    if (confirm(`Se eliminarán ${keysToDelete.length} entregas anteriores a ${cutoffDate.toLocaleDateString('es-ES')}. ¿Continuar?`)) {
      keysToDelete.forEach(key => localStorage.removeItem(key))
      loadDeliveries()
      alert(`✅ ${keysToDelete.length} entregas antiguas eliminadas`)
    }
  }

  // Función para hacer públicas las imágenes existentes
  const makeImagesPublic = async () => {
    if (!confirm('¿Hacer públicas todas las imágenes en Google Drive?\n\nEsto configurará automáticamente todas las imágenes de la carpeta como públicas.')) {
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 Iniciando proceso para hacer públicas las imágenes...');
      
      const response = await fetch('/api/deliveries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'makeImagesPublic'
        })
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const result = await response.json();
      console.log('📥 Resultado:', result);

      if (result.status === 'success') {
        alert(`✅ Proceso completado!\n\n${result.message}\n\nAhora las imágenes deberían verse en los previews.`);
        // Recargar entregas para ver si ahora funcionan las imágenes
        loadDeliveries();
      } else {
        throw new Error(result.message || 'Error desconocido');
      }

    } catch (error) {
      console.error('❌ Error:', error);
      alert(`❌ Error haciendo públicas las imágenes:\n\n${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'in-progress':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-gray-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completada</Badge>
      case 'in-progress':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">En curso</Badge>
      case 'pending':
        return <Badge variant="outline">Pendiente</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  // Función para convertir URLs de Google Drive a URLs directas
  const getDirectGoogleDriveUrl = (url: string, forEmbed: boolean = false) => {
    if (!url) return url;
    
    // Para URLs base64 (datos locales), devolverlas tal como están
    if (url.startsWith('data:image/')) {
      return url;
    }
    
    // Extraer file ID de cualquier formato de Google Drive
    let fileId = '';
    
    if (url.includes('/file/d/')) {
      fileId = url.split('/d/')[1].split('/')[0];
    } else if (url.includes('id=')) {
      fileId = url.split('id=')[1].split('&')[0];
    }
    
    if (fileId) {
      if (forEmbed) {
        // Para embebido en <img> tags: usar el formato que mejor funciona
        // Intentamos primero con el formato directo de Google Drive
        return `https://lh3.googleusercontent.com/d/${fileId}=w400`;
      } else {
        // Para abrir en ventana nueva: usar formato view (este ya funciona)
        return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
      }
    }
    
    return url; // Para cualquier otro formato
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            Panel de Admin
            {dataSource === 'sheets' && (
              <Badge variant="outline" className="flex items-center gap-1">
                {isConnectedToSheets ? (
                  <>
                    <Wifi className="h-3 w-3 text-green-600" />
                    <span className="text-green-600">Google Sheets</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-red-600" />
                    <span className="text-red-600">Desconectado</span>
                  </>
                )}
              </Badge>
            )}
            {dataSource === 'local' && (
              <Badge variant="outline" className="text-blue-600">
                📱 Datos Locales
              </Badge>
            )}
          </h1>
          <p className="text-gray-600">Gestión de entregas ActiviRutes</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Selector de fuente de datos */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Fuente:</label>
            <select
              value={dataSource}
              onChange={(e) => {
                setDataSource(e.target.value as 'local' | 'sheets')
                // Recargar automáticamente al cambiar fuente
                setTimeout(() => loadDeliveries(), 100)
              }}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white"
              title="Seleccionar fuente de datos"
            >
              <option value="local">📱 Datos Locales</option>
              <option value="sheets">📊 Google Sheets</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-500 border-l pl-3">
                          <span>Última actualización: {isClient ? lastUpdate.toLocaleTimeString('es-ES') : 'Cargando...'}</span>
            <Button
              onClick={loadDeliveries}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completadas</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">En curso</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pendientes</p>
                <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y acciones */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              {/* Búsqueda */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por escuela, receptor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              {/* Filtro de fecha */}
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
              
              {/* Filtro de estado */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                title="Filtrar por estado de entrega"
              >
                <option value="all">Todos los estados</option>
                <option value="completed">Completadas</option>
                <option value="in-progress">En curso</option>
                <option value="pending">Pendientes</option>
              </select>
            </div>
            
            {/* Acciones masivas */}
            <div className="flex gap-2 items-center">
              {/* Checkbox seleccionar todo */}
              {filteredDeliveries.length > 0 && (
                <div className="flex items-center gap-2 mr-2 px-2 py-1 bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded"
                    aria-label="Seleccionar todas las entregas"
                  />
                  <span className="text-xs text-gray-600">
                    Todo ({selectedDeliveries.size}/{filteredDeliveries.length})
                  </span>
                </div>
              )}
              
              {selectedDeliveries.size > 0 && (
                <Button 
                  onClick={deleteSelectedDeliveries} 
                  variant="outline" 
                  size="sm"
                  className="bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar {selectedDeliveries.size}
                </Button>
              )}
              
              <Button onClick={exportAllDeliveries} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
              <Button onClick={cleanOldDeliveries} variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Limpiar antiguas
              </Button>
              <Button onClick={makeImagesPublic} variant="outline" size="sm" disabled={isLoading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Publicar Imágenes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de entregas */}
      <div className="space-y-4">
        {filteredDeliveries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay entregas</h3>
              <p className="text-gray-600">
                {deliveries.length === 0 
                  ? "Aún no se han registrado entregas."
                  : "No hay entregas que coincidan con los filtros aplicados."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredDeliveries.map((delivery) => (
            <Card key={delivery.deliveryId} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Checkbox individual */}
                    <input
                      type="checkbox"
                      checked={selectedDeliveries.has(delivery.deliveryId)}
                      onChange={(e) => handleSelectDelivery(delivery.deliveryId, e.target.checked)}
                      className="rounded"
                      aria-label={`Seleccionar entrega ${delivery.schoolName}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(delivery.status)}
                        <h3 className="font-medium text-gray-900">{delivery.schoolName}</h3>
                        {getStatusBadge(delivery.status)}
                        <span className="text-sm text-gray-500">
                          {isClient ? 
                            `${new Date(delivery.timestamp).toLocaleDateString('es-ES')} - ${new Date(delivery.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` 
                            : 'Cargando...'
                          }
                        </span>
                      </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {delivery.schoolAddress}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {delivery.recipientName}
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {delivery.activities}
                      </div>
                    </div>
                    
                      {delivery.notes && (
                        <p className="text-sm text-gray-600 mt-2 italic">
                          💬 {delivery.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {/* Badges de imágenes con preview */}
                    {(delivery.signature || delivery.signatureUrl) && (
                      <div className="relative group">
                        <Badge 
                          variant="outline" 
                          className="text-xs cursor-pointer hover:bg-blue-50"
                          onClick={() => {
                            // Buscar URL de firma correcta
                            const url = delivery.signatureUrl || 
                                       (delivery.signature && delivery.signature.startsWith('http') ? delivery.signature : null);
                            if (url) {
                              window.open(getDirectGoogleDriveUrl(url, false), '_blank');
                            }
                          }}
                        >
                          ✍️ Firma
                        </Badge>
                        {/* Mostrar preview para cualquier URL de firma disponible */}
                        {(delivery.signatureUrl || (delivery.signature && delivery.signature.startsWith('http'))) && (
                          <div className="absolute hidden group-hover:block z-50 top-8 left-0 bg-white border rounded shadow-lg p-1 max-w-40">
                            <div className="relative w-24 h-16 bg-gray-100 rounded flex items-center justify-center">
                              <img 
                                src={getDirectGoogleDriveUrl(delivery.signatureUrl || delivery.signature || '', true)} 
                                alt="Preview firma" 
                                className="w-24 h-16 object-contain rounded absolute top-0 left-0"
                                onError={(e) => { 
                                  console.log('❌ Error preview firma:', e.currentTarget.src);
                                  e.currentTarget.style.display = 'none';
                                  const placeholder = e.currentTarget.nextSibling as HTMLElement;
                                  if (placeholder) placeholder.style.display = 'flex';
                                }}
                                                                  onLoad={(e) => {
                                    console.log('✅ Preview firma cargado correctamente');
                                    const placeholder = e.currentTarget.nextSibling as HTMLElement;
                                    if (placeholder) placeholder.style.display = 'none';
                                  }}
                              />
                              <div className="text-xs text-gray-500 text-center hidden flex-col items-center justify-center w-full h-full">
                                <div>✍️</div>
                                <div>Firma</div>
                                <div className="text-xs">Disponible</div>
                              </div>
                            </div>
                            <div className="text-xs text-center text-gray-500 mt-1">Click para ver completa</div>
                          </div>
                        )}
                      </div>
                    )}
                    {(delivery.photoUrl || delivery.photoUrlDrive) && (
                      <div className="relative group">
                        <Badge 
                          variant="outline" 
                          className="text-xs cursor-pointer hover:bg-green-50"
                          onClick={() => {
                            // Buscar URL de foto correcta
                            const url = delivery.photoUrlDrive || 
                                       (delivery.photoUrl && delivery.photoUrl.startsWith('http') ? delivery.photoUrl : null);
                            if (url) {
                              window.open(getDirectGoogleDriveUrl(url, false), '_blank');
                            }
                          }}
                        >
                          📸 Foto
                        </Badge>
                        {/* Mostrar preview para cualquier URL de foto disponible */}
                        {(delivery.photoUrlDrive || (delivery.photoUrl && delivery.photoUrl.startsWith('http'))) && (
                          <div className="absolute hidden group-hover:block z-50 top-8 left-0 bg-white border rounded shadow-lg p-1 max-w-40">
                            <div className="relative w-24 h-16 bg-gray-100 rounded flex items-center justify-center">
                              <img 
                                src={getDirectGoogleDriveUrl(delivery.photoUrlDrive || delivery.photoUrl || '', true)} 
                                alt="Preview foto" 
                                className="w-24 h-16 object-contain rounded absolute top-0 left-0"
                                onError={(e) => { 
                                  console.log('❌ Error preview foto:', e.currentTarget.src);
                                  e.currentTarget.style.display = 'none';
                                  const placeholder = e.currentTarget.nextSibling as HTMLElement;
                                  if (placeholder) placeholder.style.display = 'flex';
                                }}
                                onLoad={(e) => {
                                  console.log('✅ Preview foto cargado correctamente');
                                  const placeholder = e.currentTarget.nextSibling as HTMLElement;
                                  if (placeholder) placeholder.style.display = 'none';
                                }}
                              />
                              <div className="text-xs text-gray-500 text-center hidden flex-col items-center justify-center w-full h-full">
                                <div>📸</div>
                                <div>Foto</div>
                                <div className="text-xs">Disponible</div>
                              </div>
                            </div>
                            <div className="text-xs text-center text-gray-500 mt-1">Click para ver completa</div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-1">
                      <Button
                        onClick={() => copyDeliveryData(delivery)}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => deleteDelivery(delivery.deliveryId)}
                        variant="outline"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
      {/* Información adicional */}
      {filteredDeliveries.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Mostrando {filteredDeliveries.length} de {deliveries.length} entregas
        </div>
      )}
      
      {/* Información sobre la fuente de datos */}
      {dataSource === 'sheets' && (
        <Card className={isConnectedToSheets ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {isConnectedToSheets ? (
                <Wifi className="h-5 w-5 text-green-600 mt-0.5" />
              ) : (
                <WifiOff className="h-5 w-5 text-yellow-600 mt-0.5" />
              )}
              <div className="text-sm">
                {isConnectedToSheets ? (
                  <>
                    <h4 className="font-medium text-green-900 mb-1">✅ Conectado a Google Sheets</h4>
                    <p className="text-green-800 mb-2">
                      Datos sincronizados desde Google Sheets. Las entregas de todos los transportistas 
                      aparecen aquí automáticamente cuando se confirman.
                    </p>
                    <div className="text-xs text-green-700">
                      <p>📊 Hoja: {GOOGLE_SHEETS_CONFIG.DELIVERIES_SHEET_NAME}</p>
                      <p>🔄 Sincronización: Automática vía Next.js API</p>
                      <p>📱 Fotos/Firmas: Disponibles en dispositivos originales</p>
                      <p>🔗 Informes: Generados dinámicamente</p>
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="font-medium text-yellow-900 mb-1">⚠️ Problema de conexión</h4>
                    <p className="text-yellow-800 mb-2">
                      No se pudo conectar con Google Sheets. Mostrando datos locales como respaldo.
                    </p>
                    <div className="text-xs text-yellow-700">
                      <p>🔄 Solución: Presiona "Actualizar" para reintentar</p>
                      <p>📱 Alternativa: Cambia a "Datos Locales"</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {dataSource === 'local' && deliveries.length > 0 && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <h4 className="font-medium text-yellow-900 mb-1">Datos Locales</h4>
                <p className="text-yellow-800 mb-2">
                  Mostrando entregas almacenadas localmente en este dispositivo.
                  Para ver datos de todos los transportistas, cambiar a "Google Sheets".
                </p>
                <div className="text-xs text-yellow-700">
                  <p>💾 Fuente: localStorage del navegador</p>
                  <p>🔄 Sincronización: Manual</p>
                  <p>📱 Alcance: Solo este dispositivo</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 