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

// Permitir CORS para el admin
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}