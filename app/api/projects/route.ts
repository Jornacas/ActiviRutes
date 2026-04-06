import { NextRequest, NextResponse } from 'next/server'

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzSYO-BTf33Qp6VP1L4d0AgAziGyqUnTIvE5DY8aaYYGNPnq8chGbQmmu0Iy9RuH9wg/exec'

// Helper para llamar a Google Apps Script
async function callGAS(action: string, data: Record<string, unknown> = {}) {
  try {
    const payload = JSON.stringify({ action, ...data })

    // POST a GAS - automáticamente sigue redirects
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
    })

    const text = await response.text()

    // Intentar parsear como JSON
    try {
      return JSON.parse(text)
    } catch {
      // Si no es JSON, puede ser un error HTML
      console.error('GAS returned non-JSON:', text.substring(0, 200))
      throw new Error('Google Apps Script returned invalid response')
    }
  } catch (error) {
    console.error('Error calling GAS:', error)
    throw error
  }
}

// GET - Obtener proyectos o entregas de un proyecto
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const projectId = searchParams.get('projectId')
    const tipo = searchParams.get('tipo')

    if (action === 'getProjects') {
      const result = await callGAS('getProjects', { tipo })
      return NextResponse.json(result)
    }

    if (action === 'getProject' && projectId) {
      const result = await callGAS('getProject', { projectId })
      return NextResponse.json(result)
    }

    if (action === 'getProjectDeliveries' && projectId) {
      const result = await callGAS('getProjectDeliveries', { projectId })
      return NextResponse.json(result)
    }

    return NextResponse.json({ status: 'error', message: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST - Crear proyecto, guardar entregas, actualizar estado
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'createProject') {
      const result = await callGAS('createProject', { projectData: body.projectData })
      return NextResponse.json(result)
    }

    if (action === 'saveProjectDeliveries') {
      const result = await callGAS('saveProjectDeliveries', {
        projectId: body.projectId,
        deliveries: body.deliveries
      })
      return NextResponse.json(result)
    }

    if (action === 'updateDeliveryStatus') {
      const result = await callGAS('updateDeliveryStatus', {
        projectId: body.projectId,
        centro: body.centro,
        status: body.status,
        fechaEntrega: body.fechaEntrega,
        notas: body.notas
      })
      return NextResponse.json(result)
    }

    if (action === 'updateMultipleDeliveries') {
      const result = await callGAS('updateMultipleDeliveries', {
        projectId: body.projectId,
        centros: body.centros,
        status: body.status,
        fechaEntrega: body.fechaEntrega
      })
      return NextResponse.json(result)
    }

    if (action === 'deleteProject') {
      const result = await callGAS('deleteProject', { projectId: body.projectId })
      return NextResponse.json(result)
    }

    if (action === 'updateProject') {
      const result = await callGAS('updateProject', {
        projectId: body.projectId,
        updates: body.updates
      })
      return NextResponse.json(result)
    }

    if (action === 'getProjectRoute') {
      const result = await callGAS('getProjectRoute', {
        projectId: body.projectId,
        dia: body.dia
      })
      return NextResponse.json(result)
    }

    return NextResponse.json({ status: 'error', message: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
