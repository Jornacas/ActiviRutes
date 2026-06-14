## Plan de trabajo: Admin y módulo de Recogidas (siguiente sesión)

### 1) Limpieza rápida en Admin
- **Eliminar “Fuente: + desplegable”**
  - Siempre cargaremos datos desde Google Sheets → no tiene sentido seleccionar otra fuente.
  - Acciones:
    - Quitar UI del selector en `app/admin/page.tsx` (y cualquier estado/efecto asociado).
    - Revisar que el endpoint usado sea `GET /api/deliveries` (ya unificado) y que no quede lógica muerta.

---

### 2) Rediseño completo de “Recogidas” (paridad con “Entregas”)
- **Objetivo:** Que “Recogidas” tenga el mismo look&feel, flujos y capacidades que “Entregas” (creación/edición de rutas, filtros, ordenación, badges, etc.), con reglas propias.

#### 2.1. Fuente de datos y reglas de negocio
- **Hoja Base (Google Sheets)**: usar columna **K = “FINAL CURS”** como fecha de elegibilidad de recogida.
- **Regla principal:** los materiales **solo se pueden recoger a partir de “FINAL CURS” (incluida)**, nunca antes.
- **Zonas de filtro (Admin):**
  - **Disponibles hoy**: `FINAL CURS <= hoy` (timezone `Europe/Madrid`).
  - **Próximas**: `FINAL CURS > hoy`.
  - **Histórico**: recogidas ya realizadas (una vez se registre la recogida efectiva).
- **Ordenación por defecto:** más recientes primero según `timestamp` (o `FINAL CURS` cuando no exista `timestamp`).

#### 2.2. Modelo de datos (paridad + campos nuevos)
- Igual al de “Entregas” con los campos adicionales:
  - **numBultos**: número de bultos a recoger por actividad.
  - **denominacionBultos**: denominación de los bultos (p. ej., “Cajas A4”, “Paneles TC”, etc.).
- Nota: **fuente de `numBultos` y `denominacionBultos`** por definir. De momento: placeholder en UI + soporte en estructura/API para integrarlo después.

Ejemplo de objeto (Admin/UI):
```ts
{
  pickupId: string,
  schoolName: string,
  schoolAddress: string,
  activities: string, // igual que entregas
  notes?: string,
  finalCursDate: string, // ISO derivado de columna K
  timestamp?: string, // registro real de recogida (cuando se complete)
  numBultos?: number,
  denominacionBultos?: string,
  status: 'pending' | 'scheduled' | 'picked',
  routeId?: string
}
```

#### 2.3. UI/UX (paridad visual con Entregas)
- Tarjetas con misma estructura, badges y acciones.
- Filtros por estado/fecha (disponibles hoy / próximas / histórico).
- Botones para añadir a ruta, crear ruta, editar ruta (mismo patrón).
- Vista de ruta del transportista idéntica, cambiando textos (“Recoger” en lugar de “Entregar”).

#### 2.4. Endpoints y Apps Script
- **Nuevo endpoint Next.js:** `GET /api/pickups` (similar a `/api/deliveries`).
  - Llama a Apps Script con `action: 'getPickups'`.
  - Normaliza datos, genera `finalCursDate` (ISO) desde columna K si Apps Script no lo envía.
  - Expone `pickups` (y `data` por compatibilidad, como en entregas).
- **Apps Script (`Code.gs`)**:
  - Nueva acción `getPickups` → leer de Hoja Base y mapear columnas, especialmente **K: FINAL CURS**.
  - Calcular en origen: `FINAL_CURS_ISO` (y opcional `TIMESTAMP` cuando se registre recogida real), mismo helper `buildTimestampISO` si aplica.
  - Mantener consistencia de claves (mayúsculas) y añadir `rowIndex`.

#### 2.5. Creación/edición de rutas de Recogida
- Reutilizar el componente de editor de rutas (`components/route-editor.tsx`) parametrizable para “recogida/entrega”.
- Campo adicional por item de ruta: `numBultos` y `denominacionBultos`.
- Persistencia en Sheets al confirmar recogida (similar a entregas, con su acción Apps Script `addPickup`).

---

### 3) Validaciones y filtros
- **Elegibilidad por fecha:** bloquear acciones de recogida si `hoy < FINAL CURS`.
- **Visual:** etiqueta/badge “Disponible a partir del DD/MM/YYYY” para futuras.
- **Filtros combinables:** estado + franja temporal.
- **Timezone:** usar `Europe/Madrid` en todas las comparaciones y formateos.

---

### 4) Plan de implementación (iterativo)
1. **Admin limpieza rápida** (eliminar “Fuente”).
2. **API + Apps Script base de Recogidas** (`getPickups`).
3. **Listado UI Recogidas** con filtros por `FINAL CURS` y ordenación.
4. **Paridad visual** con Entregas; componentes compartidos.
5. **Editor de ruta reutilizable** (modo recogidas).
6. **Soporte de `numBultos` y `denominacionBultos`** en UI y estructura (placeholder si fuente no definida).
7. **Transporte Recogidas** (misma vista, textos adaptados y flujos “Recoger”).
8. **Registro de recogida** (Apps Script `addPickup`) + generación de `timestamp` en origen.
9. **QA y ajustes**.

---

### 5) Dependencias y decisiones pendientes
- **Fuente exacta de `numBultos` y `denominacionBultos`** (otra hoja, base externa o manual en UI).
- **Nombre de hoja/s** para Recogidas (confirmar pestaña en Sheets).
- **Formato final de columnas** del nuevo flujo (para fijar mapping estable).

---

### 6) Riesgos
- Cambios de estructura en Sheets rompan el mapping.
- Duplicación de lógica si no unificamos componentes (entregas/recogidas).
- Tiempos de despliegue Apps Script.

---

### 7) Checklist de QA
- **Filtros por fecha** (hoy/próximas/histórico) respetan “FINAL CURS”.
- **Bloqueo de acciones** antes de `FINAL CURS`.
- **Ordenación correcta** (más recientes primero).
- **Rutas**: creación y edición funcionan como en Entregas.
- **Transportista**: recorrido completo sin límites de paradas.
- **Campos nuevos** visibles y persistentes (`numBultos`, `denominacionBultos`).

---

Nota: cuando definas la fuente de `numBultos` y `denominacionBultos`, integramos el mapping y cerramos el diseño de ficha. 