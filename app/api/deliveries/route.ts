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

    // 🎯 SOLUCIÓN DEFINITIVA: Procesar datos con acceso directo por headers
    const deliveries = data.data.map((row: any) => {
      // 🚨 DEBUG CRÍTICO: Solo primera fila para ver headers
      if (row.rowIndex === 2) {
        console.log('🔍 PRIMERA FILA COMPLETA:', JSON.stringify(row))
        console.log('🔍 HEADERS DISPONIBLES:', Object.keys(row))
        console.log('🔍 VALORES PRIMERA FILA:', Object.values(row))
      }

      // ✅ NUEVO: usar timestamp precalculado desde Apps Script si existe
      const timestampFromAppsScript = row['TIMESTAMP'] || row['timestamp'] || ''

      // 🎯 SOLUCIÓN DEFINITIVA: Acceso directo por headers de Google Sheets
      const dateStr = row['FECHA'] || row['Fecha'] || row['fecha'] || ''
      const timeStr = row['HORA'] || row['Hora'] || row['hora'] || ''

      let timestamp = timestampFromAppsScript

      // Si Apps Script no envió timestamp válido, intentamos procesar localmente
      if (!timestampFromAppsScript) {
        // Procesamiento robusto de fecha y hora
        timestamp = new Date().toISOString()
        try {
          if (dateStr && timeStr) {
            const rawDate = String(dateStr).trim()
            const rawTime = String(timeStr).trim()

            let finalDate: Date | null = null
            if (rawDate.includes('/') && rawTime.includes(':')) {
              const [d, m, y] = rawDate.split('/')
              const [h, min] = rawTime.split(':')
              const isoString = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${h.padStart(2,'0')}:${min.padStart(2,'0')}:00`
              finalDate = new Date(isoString)
            }
            if ((!finalDate || isNaN(finalDate.getTime())) && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
              const [d, m, y] = rawDate.split('/')
              const [h, min] = rawTime.split(':')
              const isoString = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${h.padStart(2,'0')}:${min.padStart(2,'0')}:00`
              finalDate = new Date(isoString)
            }
            if (!finalDate || isNaN(finalDate.getTime())) {
              finalDate = new Date(`${rawDate} ${rawTime}`)
            }
            if (finalDate && !isNaN(finalDate.getTime()) && finalDate.getFullYear() >= 2020) {
              timestamp = finalDate.toISOString()
            }
          }
        } catch {}
      }

      return {
        deliveryId: `sheets_${row.rowIndex}`,
        timestamp,
        routeId: row['RUTA_ID'] || row['Ruta_ID'] || row['ruta_id'] || 'N/A',
        schoolName: row['ESCUELA'] || row['Escuela'] || row['escuela'] || 'Desconocida',
        schoolAddress: row['DIRECCION'] || row['Direccion'] || row['direccion'] || '',
        activities: row['ACTIVIDADES'] || row['Actividades'] || row['actividades'] || '',
        recipientName: row['RECEPTOR'] || row['Receptor'] || row['receptor'] || '',
        notes: row['NOTAS'] || row['Notas'] || row['notas'] || '',
        signature: (row['TIENE_FIRMA'] || row['Tiene_Firma'] || row['tiene_firma']) === 'SÍ' ? 'Disponible en Google Drive' : undefined,
        photoUrl: (row['TIENE_FOTO'] || row['Tiene_Foto'] || row['tiene_foto']) === 'SÍ' ? 'Disponible en Google Drive' : undefined,
        reportUrl: row['LINK_INFORME'] || row['Link_Informe'] || row['link_informe'] || '',
        status: 'completed' as const,
        source: 'sheets',
        signatureUrl: row['URL_FIRMA'] || row['Url_Firma'] || row['url_firma'] || '',
        photoUrlDrive: row['URL_FOTO'] || row['Url_Foto'] || row['url_foto'] || ''
      }
    })

    console.log(`✅ ${deliveries.length} entregas procesadas para el admin`)

    return NextResponse.json({
      status: 'success',
      deliveries: deliveries, // ✅ Cambiar 'data' por 'deliveries' para consistencia
      data: deliveries, // Mantener 'data' para compatibilidad con Admin
      message: `${deliveries.length} entregas obtenidas desde Google Sheets`,
      lastUpdate: new Date().toISOString(),
      source: 'google_sheets',
      // 🚨 DEBUG TEMPORAL: Incluir estructura de primera fila en respuesta
      debugInfo: data.data[0] ? {
        firstRowKeys: Object.keys(data.data[0]),
        firstRowValues: Object.values(data.data[0]),
        sampleRow: data.data[0]
      } : null
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

    console.log('📊 Status response de Google Apps Script:', response.status)

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