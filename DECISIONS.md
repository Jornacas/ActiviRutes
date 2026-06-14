# DECISIONS · ActiviRutes
Registro append-only de decisiones de arquitectura. No reescribir entradas; solo añadir.

Decisiones iniciales reconstruidas del código y del historial de `CLAUDE.md`, y **verificadas
contra el código el 2026-06-14**. Las que no se pudieron confirmar al 100% llevan nota explícita.

## [2026-06-14] — Google Sheets como única fuente de verdad (sin base de datos)
**Contexto:** la app coordina entregas/recogidas de material a escuelas; los datos los mantienen
operadores en hojas de cálculo.
**Decisión:** no usar BD externa; Google Sheets (hoja "Dades" / proyectos) es la fuente de verdad,
consumida vía CSV export + Google Apps Script.
**Porqué:** los datos ya viven en Sheets y los gestiona personal no técnico; evita infraestructura.
**Consecuencias:** límites de CORS y latencia de Apps Script; obliga a endpoints Next.js como proxy
y a localStorage para media pesada.
**Verificación:** confirmado — `google-apps-script/Code.gs` lee/escribe en Sheets; no hay capa de BD.

## [2026-06-14] — Endpoints Next.js como proxy de Apps Script
**Contexto:** llamar a Apps Script directo desde el navegador choca con CORS.
**Decisión:** exponer rutas Next.js (`/api/deliveries`, `/api/projects`, `/api/geocode`) que llaman
a GAS server-side.
**Porqué:** sortea CORS y centraliza la normalización de datos.
**Consecuencias:** patrón a replicar para Recogidas (`/api/pickups`).
**Verificación:** confirmado — existen `app/api/deliveries`, `app/api/projects`, `app/api/geocode`.

## [2026-06-14] — Media (fotos/firmas) en Google Drive + localStorage, no en Sheets
**Contexto:** Sheets no es apto para blobs; localStorage en móvil tiene cuota limitada.
**Decisión:** subir fotos/firmas a una carpeta Drive concreta (`1CubYYXeUuGBXY9pSbWr5DYkEKQZAIPxP`) y
guardar enlaces en Sheets; datos esenciales comprimidos en localStorage, media completa en informes.
**Porqué:** evita QuotaExceededError en móvil y mantiene Sheets ligero.
**Consecuencias:** auto-limpieza de entregas antiguas en localStorage cuando se llena la cuota.
**Verificación:** confirmado — folder ID presente en `Code.gs`, `app/admin/page.tsx`, `app/informe/`.

## [2026-06-14] — Geocoding con Google Geocoding API (migrado desde Nominatim)
**Contexto:** Nominatim daba precisión pobre en direcciones cortas de Barcelona.
**Decisión:** migrar a Google Geocoding API e incluir el nombre de la escuela en la query.
**Porqué:** mejor precisión ("Escola Catalonia, Perú, 195, Barcelona").
**Consecuencias:** dependencia de API key de Google (variable de entorno).
**Verificación:** confirmado — `app/api/geocode/route.ts:26` usa `maps.googleapis.com/.../geocode`,
sin rastro de Nominatim.

## [2026-06-14] — Modelo unificado de guardado: el proyecto en Sheets es la fuente de verdad
**Contexto:** existían varios flujos de guardado desconectados; adelantados y campos
`startTime`/`turn`/`priority` se perdían al refrescar.
**Decisión:** persistir todo el estado de proyecto en Sheets (`ProyectoEntregas` con columnas
`HoraInicio`, `Turno`, `Prioritario`); `plansByDay` usa `savedReorganization` como fuente de verdad.
**Porqué:** un único modelo coherente entre gestión, editor y transportista.
**Consecuencias:** Apps Script desplegado en v62; el transportista usa `routeId` estable
(`projectId+día`) y progreso persistente en localStorage.
**Verificación:** confirmado — `ProyectoEntregas`/`HoraInicio` aparecen en `Code.gs`, `app/page.tsx`,
`components/route-editor.tsx`, `lib/useProjects.ts`, `app/api/projects/route.ts`.

## [2026-06-14] — Captura de foto: input file nativo, con cámara WebRTC aún presente (migración incompleta)
**Contexto:** WebRTC (`getUserMedia`) fallaba de forma intermitente al capturar foto en smartphones;
el `CLAUDE.md` lo documenta como "switched from WebRTC to native file input".
**Decisión:** usar `<input type="file" accept="image/*">` como vía fiable de captura.
**Porqué:** fiabilidad en móviles reales por encima de control fino de cámara.
**Estado real (verificado):** la migración **NO está completa**. `app/transporter/[routeId]/page.tsx`
mantiene a la vez `startCamera()` con `getUserMedia` (línea ~212) y el `input type="file"` (~467),
con el comentario "Ya no necesitamos la parte compleja del video". Coexisten ambos caminos.
**Consecuencias / deuda técnica:** código de cámara WebRTC duplicado/muerto que conviene consolidar
a un único flujo (file-input) o documentar el fallback de forma explícita. **Pendiente de decidir.**

## [2026-06-14] — Recogidas = proyecto `tipo:'recogida'` reutilizando el stack de Entregas (no módulo paralelo)
**Contexto:** el `PLAN_RECOGIDAS_ADMIN.md` (anterior al refactor de proyectos de abril 2026) proponía
un módulo paralelo: endpoint `/api/pickups` + `getPickups` sobre la hoja base con lista plana y filtros
hoy/próximas/histórico por columna K (FINAL CURS). Pero el código ya evolucionó a un sistema de
proyectos con `tipo: 'entrega' | 'recogida'` (hoja `Proyectos`, `getProjects(tipo)`), y `ProyectoEntregas`
es compartido. Seguir el plan literal habría creado arquitectura duplicada e incoherente.
**Decisión:** Recogidas se implementa como proyecto `tipo:'recogida'` reutilizando TODO el stack de
Entregas: `DeliveryModule` (parametrizado con prop `mode`), `generateDeliveryPlan`, el editor de rutas
(`type:'pickup'`/`projectId`), `ProyectoEntregas` y el transportista. Se descarta `/api/pickups`.
**Clave de reutilización:** `generateDeliveryPlan` ancla la planificación en `courseStart`. Para
recogidas se construyen los datos (`processPickupData`) con `courseStart = FINAL CURS`, de modo que la
elegibilidad "solo se recoge a partir de FINAL CURS" cae directamente del motor existente sin duplicarlo.
**Porqué:** una única fuente de verdad y un solo componente que mantener; coherente con el modelo
unificado de guardado y con la filosofía "reutilizar parametrizado, no duplicar".
**Consecuencias:** se sustituye el tab Recogidas primitivo (jueves/viernes por `lastActivityDay`).
`numBultos`/`denominacionBultos` son manuales en UI (placeholder) con soporte en estructura/API
(columnas nuevas en `ProyectoEntregas` → requiere redeploy GAS). El transportista relabela
"Entregar"→"Recoger" según `tipo` del proyecto.
**Decidido con Jordi** (2026-06-14): opción "Reusar proyectos" + bultos "Manual en UI".
