import { NextRequest, NextResponse } from 'next/server'

// Configuración de Google Sheets (misma que en otros archivos)
const GOOGLE_SHEETS_CONFIG = {
  SHEET_ID: "1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I",
  DELIVERIES_SHEET_NAME: "ENTREGAS", // Nombre correcto de la hoja
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbz__Y99LWani6uG87sM30fEKozuZsz6YpD94dgXMtboYYZFW1E6epJRS1sjKBtNyRkN/exec"
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 API Endpoint: Obteniendo entregas desde Google Sheets...')
    
    // Crear payload para Google Apps Script
    const payload = {
      action: 'getDeliveries',
      sheetName: GOOGLE_SHEETS_CONFIG.DELIVERIES_SHEET_NAME
    }
    
    console.log('📤 Enviando a Google Apps Script:', payload)
    
    // Hacer request a Google Apps Script
    const response = await fetch(GOOGLE_SHEETS_CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) {
      throw new Error(`Google Apps Script respondió con estado: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('📥 Respuesta de Google Apps Script:', data.status, `${data.data?.length || 0} entregas`)
    
    if (data.status !== 'success') {
      throw new Error(data.message || 'Error desconocido de Google Apps Script')
    }
    
    // Procesar datos para el formato esperado por el admin
    const deliveries = data.data.map((row: any) => {
      // Mapear columnas de Google Sheets a formato del admin
      // Estructura esperada: FECHA | HORA | RUTA_ID | ESCUELA | DIRECCION | ACTIVIDADES | RECEPTOR | NOTAS | TIENE_FIRMA | TIENE_FOTO | LINK_INFORME | URL_FIRMA | URL_FOTO
      const columns = Object.keys(row)
      
      // Procesar fecha y hora de Google Sheets
      const dateStr = row[columns[0]] || ''
      const timeStr = row[columns[1]] || '00:00'
      
      console.log('🔍 DEBUG FECHA - dateStr:', dateStr, 'timeStr:', timeStr)
      
      let timestamp = '2025-01-01T00:00:00.000Z' // Fallback que NO sea fecha actual
      
      try {
        // Intentar diferentes formatos de fecha de Google Sheets
        if (dateStr && timeStr) {
          // Formato español DD/MM/YYYY
          if (dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/')
            console.log('🔧 Partes fecha:', { day, month, year })
            
            // Asegurar formato correcto de hora (añadir segundos si faltan)
            const timeFormatted = timeStr.length === 5 ? `${timeStr}:00` : timeStr
            const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timeFormatted}`
            console.log('🔧 ISO string:', isoString)
            
            const dateObj = new Date(isoString)
            console.log('🔧 dateObj creado:', dateObj, 'isValid:', !isNaN(dateObj.getTime()))
            
            if (!isNaN(dateObj.getTime())) {
              timestamp = dateObj.toISOString()
              console.log('✅ Fecha procesada correctamente:', timestamp)
            } else {
              console.log('❌ Fecha inválida después de procesar')
            }
          }
          // Formato ISO YYYY-MM-DD
          else if (dateStr.includes('-')) {
            const dateObj = new Date(`${dateStr}T${timeStr}`)
            if (!isNaN(dateObj.getTime())) {
              timestamp = dateObj.toISOString()
            }
          }
        }
      } catch (error) {
        console.warn('Error procesando fecha de Google Sheets:', error)
      }
      
      console.log('🎯 Timestamp final usado:', timestamp)

      // Obtener URLs de Google Drive si están disponibles
      const photoUrl = row[columns[11]] || '' // URL_FOTO (columna 11)
      const signatureUrl = row[columns[12]] || '' // URL_FIRMA (columna 12)

      return {
        deliveryId: `sheets_${row.rowIndex}`, // ID temporal basado en fila
        timestamp: timestamp,
        routeId: row[columns[2]] || 'N/A',
        schoolName: row[columns[3]] || 'Desconocida',
        schoolAddress: row[columns[4]] || '',
        activities: row[columns[5]] || '',
        recipientName: row[columns[6]] || '',
        notes: row[columns[7]] || '',
        signature: row[columns[8]] === 'SÍ' ? 'Disponible en Google Drive' : undefined,
        photoUrl: row[columns[9]] === 'SÍ' ? 'Disponible en Google Drive' : undefined,
        reportUrl: row[columns[10]] || '',
        status: 'completed' as const,
        source: 'sheets', // Marcar que viene de Google Sheets
        signatureUrl: signatureUrl, // URL directa de Google Drive para firma
        photoUrlDrive: photoUrl // URL directa de Google Drive para foto
      }
    })
    
    console.log(`✅ ${deliveries.length} entregas procesadas para el admin`)
    
    return NextResponse.json({
      status: 'success',
      deliveries: deliveries, // ✅ Cambiar 'data' por 'deliveries' para consistencia
      data: deliveries, // Mantener 'data' para compatibilidad con Admin
      message: `${deliveries.length} entregas obtenidas desde Google Sheets`,
      lastUpdate: new Date().toISOString(),
      source: 'google_sheets'
    })
    
  } catch (error) {
    console.error('❌ Error en API /api/deliveries:', error)
    
    return NextResponse.json({
      status: 'error',
      message: `Error obteniendo entregas: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      data: []
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📊 API POST: Procesando request con action:', body.action)
    
    // Si es la acción de hacer públicas las imágenes
    if (body.action === 'makeImagesPublic') {
      console.log('🔄 Ejecutando makeImagesPublic...')
      
      const payload = {
        action: 'makeImagesPublic'
      }
      
      const response = await fetch(GOOGLE_SHEETS_CONFIG.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        throw new Error(`Google Apps Script respondió con estado: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('📥 Resultado de makeImagesPublic:', result)
      
      return NextResponse.json(result)
    }
    
    // Si es una entrega normal (acción por defecto)
    const { data: deliveryData, images } = body

    console.log('📤 API Endpoint: Enviando entrega a Google Apps Script...')
    console.log('📊 Datos recibidos:', body)

    // Validar datos mínimos
    if (!deliveryData || !Array.isArray(deliveryData)) {
      return NextResponse.json({
        status: 'error',
        message: 'Datos de entrega inválidos'
      }, { status: 400 })
    }

    // Preparar payload para Google Apps Script
    const payload = {
      action: 'addDelivery',
              data: deliveryData,
      images: images || {}
    }

    console.log('📤 Enviando a Google Apps Script:', payload)
    console.log('📸 Imágenes incluidas:', images ? Object.keys(images) : 'ninguna')

    // DIAGNÓSTICO DETALLADO DE IMÁGENES
    if (images) {
      Object.keys(images).forEach(key => {
        const image = images[key]
        if (image) {
          console.log(`🔍 ${key}:`, {
            length: image.length,
            starts_with: image.substring(0, 50),
            has_base64_header: image.includes('data:image'),
            type: typeof image
          })
        } else {
          console.log(`❌ ${key}: vacía o null`)
        }
      })
    } else {
      console.log('❌ images es null/undefined')
    }

    // Hacer request a Google Apps Script CON RESPUESTA VERIFICABLE
    const response = await fetch(GOOGLE_SHEETS_CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    console.log('�� Status response de Google Apps Script:', response.status)

    if (!response.ok) {
      throw new Error(`Google Apps Script respondió con estado: ${response.status}`)
    }

    const result = await response.json()
    console.log('📥 Respuesta de Google Apps Script:', result)

    if (result.status !== 'success') {
      console.error('❌ Error en Google Apps Script:', result.message)
      return NextResponse.json({
        status: 'error',
        message: result.message || 'Error procesando entrega en Google Apps Script'
      }, { status: 500 })
    }

    console.log('✅ Entrega procesada exitosamente')
    console.log('📂 URLs de imágenes:', {
      signature: result.signatureUrl,
      photo: result.photoUrl
    })

    return NextResponse.json({
      status: 'success',
      message: 'Entrega enviada correctamente',
      data: result,
      signatureUrl: result.imagesProcessed?.signatureUrl,
      photoUrl: result.imagesProcessed?.photoUrl
    })

  } catch (error) {
    console.error('❌ Error en API POST /api/deliveries:', error)

    return NextResponse.json({
      status: 'error',
      message: `Error enviando entrega: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }, { status: 500 })
  }
}

// Permitir CORS para el admin
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}