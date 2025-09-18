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
      
      // 🚨 ARREGLO AGRESIVO: Buscar fecha y hora en TODAS las columnas
      console.log('🔍 TODA LA FILA:', JSON.stringify(row))
      console.log('🔍 COLUMNAS DISPONIBLES:', Object.keys(row))
      
      // Buscar fecha en cualquier columna que contenga números y /
      let dateStr = ''
      let timeStr = ''
      
      Object.values(row).forEach((value, index) => {
        const str = String(value || '').trim()
        console.log(`🔍 Columna ${index}: "${str}"`)
        
        // Buscar patrón de fecha DD/MM/YYYY o similar
        if (str.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
          dateStr = str
          console.log(`✅ FECHA encontrada en columna ${index}: "${dateStr}"`)
        }
        
        // Buscar patrón de hora HH:MM
        if (str.match(/\d{1,2}:\d{2}/)) {
          timeStr = str
          console.log(`✅ HORA encontrada en columna ${index}: "${timeStr}"`)
        }
      })
      
      console.log('🎯 FECHA Y HORA FINALES:', {dateStr, timeStr})
      
      // ✅ SOLUCIÓN DIRECTA: Usar fechas reales de las entregas
      let timestamp = '2025-01-01T00:00:00.000Z' // Fallback FIJO para detectar fallos
      
      try {
        if (dateStr && timeStr) {
          console.log('🔧 Datos brutos:', JSON.stringify({dateStr, timeStr}))
          
          // Convertir todo a string y limpiar
          const rawDate = String(dateStr).trim()
          const rawTime = String(timeStr).trim()
          
          // Si la fecha parece válida (contiene números), procesarla
          if (rawDate && rawTime && rawDate.match(/\d/)) {
            // Intentar múltiples formatos
                         const attempts = [
               // Formato DD/MM/YYYY HH:MM (más común en Google Sheets)
               () => {
                 if (rawDate.includes('/')) {
                   const [d, m, y] = rawDate.split('/')
                   
                   // Procesar hora más robustamente
                   let time = rawTime
                   if (rawTime.includes(':')) {
                     // Ya tiene formato HH:MM, añadir segundos si falta
                     time = rawTime.length === 5 ? `${rawTime}:00` : rawTime
                   } else if (rawTime.length === 4) {
                     // Formato HHMM → HH:MM:00
                     time = `${rawTime.slice(0,2)}:${rawTime.slice(2)}:00`
                   } else if (rawTime.length === 3) {
                     // Formato HMM → H:MM:00  
                     time = `${rawTime.slice(0,1)}:${rawTime.slice(1)}:00`
                   } else {
                     // Default si hora es rara
                     time = '12:00:00'
                   }
                   
                   const isoString = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${time}`
                   console.log('🕒 Procesando DD/MM/YYYY:', {rawDate, rawTime, time, isoString})
                   return new Date(isoString)
                 }
               },
               // Formato YYYY-MM-DD HH:MM
               () => {
                 if (rawDate.includes('-')) {
                   let time = rawTime.includes(':') ? rawTime : `${rawTime.slice(0,2)}:${rawTime.slice(2)}`
                   time = time.length === 5 ? `${time}:00` : time
                   const isoString = `${rawDate}T${time}`
                   console.log('🕒 Procesando YYYY-MM-DD:', {rawDate, rawTime, time, isoString})
                   return new Date(isoString)
                 }
               },
               // Parseado directo combinado (Google Sheets a veces envía formato especial)
               () => {
                 const combined = `${rawDate} ${rawTime}`
                 console.log('🕒 Parseado directo:', combined)
                 return new Date(combined)
               }
             ]
            
            for (const attempt of attempts) {
              try {
                const date = attempt()
                if (date && !isNaN(date.getTime()) && date.getFullYear() >= 2020) {
                  timestamp = date.toISOString()
                  console.log('✅ Fecha procesada:', timestamp, 'desde:', {rawDate, rawTime})
                  break
                }
              } catch (e) {
                // Intentar siguiente formato
              }
            }
          }
        }
      } catch (error) {
        console.warn('❌ Error procesando fecha:', error)
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