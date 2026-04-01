import { useState, useCallback } from 'react'

// Tipos
export interface Project {
  id: string
  tipo: 'entrega' | 'recogida'
  modo: 'trimestral' | 'inicio-curso'
  fechaInicio: string
  fechaFin: string
  actividades: string[]
  estado: 'activo' | 'completado' | 'eliminado'
  fechaCreacion: string
}

export interface ProjectDelivery {
  proyectoId: string
  centro: string
  direccion: string
  fechaPlanificada: string
  diaPlanificado: string
  fechaEntrega: string | null
  estado: 'pendiente' | 'entregado' | 'adelantado'
  actividades: string[]
  notas: string
}

export interface CreateProjectData {
  tipo: 'entrega' | 'recogida'
  modo: 'trimestral' | 'inicio-curso'
  fechaInicio: string
  fechaFin: string
  actividades: string[]
}

export interface DeliveryToSave {
  centro: string
  direccion: string
  fechaPlanificada: string
  diaPlanificado: string
  actividades: string[]
  estado?: 'pendiente'
}

// Hook para gestionar proyectos
export function useProjects() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Obtener todos los proyectos (opcionalmente filtrar por tipo)
  const getProjects = useCallback(async (tipo?: 'entrega' | 'recogida'): Promise<Project[]> => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ action: 'getProjects' })
      if (tipo) params.append('tipo', tipo)

      const response = await fetch(`/api/projects?${params}`)
      const result = await response.json()

      if (result.status === 'success') {
        return result.data || []
      } else {
        throw new Error(result.message)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Obtener un proyecto específico
  const getProject = useCallback(async (projectId: string): Promise<Project | null> => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ action: 'getProject', projectId })
      const response = await fetch(`/api/projects?${params}`)
      const result = await response.json()

      if (result.status === 'success') {
        return result.data
      } else {
        throw new Error(result.message)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Crear un nuevo proyecto
  const createProject = useCallback(async (projectData: CreateProjectData): Promise<string | null> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createProject', projectData })
      })
      const result = await response.json()

      if (result.status === 'success') {
        return result.projectId
      } else {
        throw new Error(result.message)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Eliminar un proyecto
  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteProject', projectId })
      })
      const result = await response.json()

      if (result.status === 'success') {
        return true
      } else {
        throw new Error(result.message)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  // Obtener entregas de un proyecto
  const getProjectDeliveries = useCallback(async (projectId: string): Promise<ProjectDelivery[]> => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ action: 'getProjectDeliveries', projectId })
      const response = await fetch(`/api/projects?${params}`)
      const result = await response.json()

      if (result.status === 'success') {
        return result.data || []
      } else {
        throw new Error(result.message)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Guardar entregas de un proyecto (batch)
  const saveProjectDeliveries = useCallback(async (projectId: string, deliveries: DeliveryToSave[]): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveProjectDeliveries', projectId, deliveries })
      })
      const result = await response.json()

      if (result.status === 'success') {
        return true
      } else {
        throw new Error(result.message)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  // Actualizar estado de una entrega
  const updateDeliveryStatus = useCallback(async (
    projectId: string,
    centro: string,
    status: 'pendiente' | 'entregado' | 'adelantado',
    fechaEntrega?: string,
    notas?: string
  ): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateDeliveryStatus',
          projectId,
          centro,
          status,
          fechaEntrega,
          notas
        })
      })
      const result = await response.json()

      if (result.status === 'success') {
        return true
      } else {
        throw new Error(result.message)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  // Actualizar múltiples entregas (marcar ruta completa)
  const updateMultipleDeliveries = useCallback(async (
    projectId: string,
    centros: string[],
    status: 'pendiente' | 'entregado' | 'adelantado',
    fechaEntrega: string
  ): Promise<{ updated: number; errors: number }> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateMultipleDeliveries',
          projectId,
          centros,
          status,
          fechaEntrega
        })
      })
      const result = await response.json()

      if (result.status === 'success') {
        return { updated: result.updated || 0, errors: result.errors || 0 }
      } else {
        throw new Error(result.message)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return { updated: 0, errors: 0 }
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    getProjects,
    getProject,
    createProject,
    deleteProject,
    getProjectDeliveries,
    saveProjectDeliveries,
    updateDeliveryStatus,
    updateMultipleDeliveries
  }
}
