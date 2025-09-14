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
      // Estructura esperada: FECHA | HORA | RUTA_ID | ESCUELA | DIRECCION | ACTIVIDADES | RECEPTOR | NOTAS | TIENE_FIRMA | TIENE_FOTO | LINK_INFORME
      const columns = Object.keys(row)
      
      return {
        deliveryId: `sheets_${row.rowIndex}`, // ID temporal basado en fila
        timestamp: `${row[columns[0]] || ''}T${row[columns[1]] || '00:00'}`, // Combinar fecha y hora
        routeId: row[columns[2]] || 'N/A',
        schoolName: row[columns[3]] || 'Desconocida',
        schoolAddress: row[columns[4]] || '',
        activities: row[columns[5]] || '',
        recipientName: row[columns[6]] || '',
        notes: row[columns[7]] || '',
        signature: row[columns[8]] === 'SÍ' ? 'Disponible en dispositivo' : undefined,
        photoUrl: row[columns[9]] === 'SÍ' ? 'Disponible en dispositivo' : undefined,
        reportUrl: row[columns[10]] || '',
        status: 'completed' as const,
        source: 'sheets' // Marcar que viene de Google Sheets
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