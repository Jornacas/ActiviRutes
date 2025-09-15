import { NextRequest, NextResponse } from 'next/server'

// Configuración de Google Sheets (misma que en otros archivos)
const GOOGLE_SHEETS_CONFIG = {
  SHEET_ID: "1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I",
  DELIVERIES_SHEET_NAME: "ENTREGAS", // Nombre correcto de la hoja
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/1kKfY1f8-1xo4Kw1mw_hz8Rdy5NwHhtLhWyoh74yHsEBvUy_HtP9T6GU0/exec"
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
      
      let timestamp = new Date().toISOString() // Fallback
      
      try {
        // Intentar diferentes formatos de fecha de Google Sheets
        if (dateStr && timeStr) {
          // Formato español DD/MM/YYYY
          if (dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/')
            const dateObj = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timeStr}`)
            if (!isNaN(dateObj.getTime())) {
              timestamp = dateObj.toISOString()
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

      // Obtener URLs de Google Drive si están disponibles
      const signatureUrl = row[columns[11]] || '' // URL_FIRMA
      const photoUrl = row[columns[12]] || '' // URL_FOTO

      return {
        deliveryId: `sheets_${row.rowIndex}`, // ID temporal basado en fila
        timestamp: timestamp,
        routeId: row[columns[2]] || 'N/A',
        schoolName: row[columns[3]] || 'Desconocida',
        schoolAddress: row[columns[4]] || '',
        activities: row[columns[5]] || '',
        recipientName: row[columns[6]] || '',
        notes: row[columns[7]] || '',
        signature: signatureUrl || (row[columns[8]] === 'SÍ' ? 'Disponible en Google Drive' : undefined),
        photoUrl: photoUrl || (row[columns[9]] === 'SÍ' ? 'Disponible en Google Drive' : undefined),
        reportUrl: row[columns[10]] || '',
        status: 'completed' as const,
        source: 'sheets', // Marcar que viene de Google Sheets
        signatureUrl: signatureUrl, // URL directa de Google Drive
        photoUrlDrive: photoUrl // URL directa de Google Drive
      }
    })
    
    console.log(`✅ ${deliveries.length} entregas procesadas para el admin`)
    
    return NextResponse.json({
      status: 'success',
      data: deliveries,
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
    console.log('📤 API Endpoint: Enviando entrega a Google Apps Script...')

    const body = await request.json()
    console.log('📊 Datos recibidos:', body)

    // Validar datos mínimos
    if (!body.data || !Array.isArray(body.data)) {
      return NextResponse.json({
        status: 'error',
        message: 'Datos de entrega inválidos'
      }, { status: 400 })
    }

    // Preparar payload para Google Apps Script
    const payload = {
      action: 'addDelivery',
      data: body.data,
      images: body.images || {}
    }

    console.log('📤 Enviando a Google Apps Script:', payload)
    console.log('📸 Imágenes incluidas:', body.images ? Object.keys(body.images) : 'ninguna')

    // DIAGNÓSTICO DETALLADO DE IMÁGENES
    if (body.images) {
      Object.keys(body.images).forEach(key => {
        const image = body.images[key]
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
      console.log('❌ body.images es null/undefined')
    }

    // Hacer request a Google Apps Script CON RESPUESTA VERIFICABLE
    const response = await fetch(GOOGLE_SHEETS_CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    console.log('📡 Status response de Google Apps Script:', response.status)

    if (!response.ok) {
      throw new Error(`Google Apps Script respondió con estado: ${response.status}`)
    }

    const data = await response.json()
    console.log('📥 Respuesta de Google Apps Script:', data)

    if (data.status !== 'success') {
      console.error('❌ Error en Google Apps Script:', data.message)
      return NextResponse.json({
        status: 'error',
        message: data.message || 'Error procesando entrega en Google Apps Script'
      }, { status: 500 })
    }

    console.log('✅ Entrega procesada exitosamente')
    console.log('📂 URLs de imágenes:', {
      signature: data.signatureUrl,
      photo: data.photoUrl
    })

    return NextResponse.json({
      status: 'success',
      message: 'Entrega enviada correctamente',
      data: data,
      signatureUrl: data.signatureUrl,
      photoUrl: data.photoUrl
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