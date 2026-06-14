// Formateo de fechas para MOSTRAR al usuario. Formato único en toda la app: dd-MM-yyyy.
// El almacenamiento interno (ISO / yyyy-MM-dd) se mantiene para la lógica y el matching.

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(d.getTime()) ? null : d
}

// "04-06-2026" (cadena vacía si no hay fecha válida)
export function formatDMY(value: Date | string | number | null | undefined): string {
  const d = toDate(value)
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getFullYear()}`
}

// "04-06-2026 09:30"
export function formatDMYTime(value: Date | string | number | null | undefined): string {
  const d = toDate(value)
  if (!d) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${formatDMY(d)} ${hh}:${min}`
}
