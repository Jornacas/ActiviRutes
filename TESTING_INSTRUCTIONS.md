# 🧪 INSTRUCCIONES DE TESTING - ActiviRutes

## 📋 RESUMEN DE CAMBIOS IMPLEMENTADOS

### ✅ **SOLUCIONADO: Imágenes en Google Drive**
- ✅ Función `uploadImageToDrive` implementada en Google Apps Script
- ✅ Permisos de Google Drive configurados en `appsscript.json`
- ✅ URLs directas de Google Drive para visualización optimizada
- ✅ Logging detallado de todo el proceso de subida

### ✅ **SOLUCIONADO: Frontend actualizado para Google Drive**
- ✅ Admin panel con previsualizaciones hover de imágenes
- ✅ Informes individuales con imágenes de Google Drive
- ✅ Fallback automático a imágenes locales si Drive falla
- ✅ Botones "Ver Original" para abrir imágenes en Google Drive

### ✅ **MEJORADO: Eliminación de entregas**
- ✅ Detección de origen de datos (localStorage vs Google Sheets)
- ✅ Eliminación robusta con múltiples formatos de clave
- ✅ Limpieza automática de selecciones y etiquetas

---

## 🧪 PLAN DE TESTING PASO A PASO

### **FASE 1: Testing Google Apps Script (10 min)**

#### 1.1 Acceso al Google Apps Script
```
URL: https://script.google.com/d/[TU_SCRIPT_ID]/edit
```

#### 1.2 Ejecutar pruebas manuales
1. **Prueba básica de Drive**:
   - Función: `quickDriveTest()`
   - Verificar: Crear archivo en carpeta Google Drive
   - Resultado esperado: Mensaje de éxito + ID del archivo

2. **Prueba completa del flujo**:
   - Función: `testCompleteFlow()`
   - Verificar: Subida de imágenes + escritura en Sheets
   - Resultado esperado: URLs de Google Drive generadas

#### 1.3 Verificar carpeta Google Drive
```
URL: https://drive.google.com/drive/folders/1CubYYXeUuGBXY9pSbWr5DYkEKQZAIPxP
```
- Debería contener archivos de prueba subidos
- Verificar que los archivos sean públicos y accesibles

#### 1.4 Verificar logs en Google Sheets
- Abrir hoja "LOGS_DEBUG" en el Google Sheets
- Verificar logs detallados de las pruebas
- Buscar mensajes de éxito y URLs generadas

---

### **FASE 2: Testing Frontend Completo (20 min)**

#### 2.1 Testing del flujo transportista → Google Drive
1. **Abrir página transportista**:
   ```
   URL: https://activi-rutes.vercel.app/transporter/test-route-123
   ```

2. **Crear entrega de prueba**:
   - Seleccionar escuela de prueba
   - Dibujar firma en el canvas
   - Tomar foto con la cámara
   - Confirmar entrega

3. **Verificar proceso en background**:
   - Abrir Developer Tools (F12) → Console
   - Buscar logs de envío a Google Apps Script
   - Verificar que incluya imágenes base64

#### 2.2 Testing Admin Panel
1. **Abrir admin panel**:
   ```
   URL: https://activi-rutes.vercel.app/admin
   ```

2. **Cambiar fuente de datos a Google Sheets**:
   - Seleccionar "Google Sheets" en el dropdown
   - Hacer clic en "🔄 Recargar Entregas"

3. **Verificar visualización mejorada**:
   - ✅ Badges de "✍️ Firma" y "📸 Foto" deben ser clicables
   - ✅ Hover sobre badges debe mostrar preview de imágenes
   - ✅ Badges deben mostrar "📂 Google Drive" si vienen de Drive

#### 2.3 Testing Informes Individuales
1. **Acceder a informe**:
   - Desde admin, hacer clic en botón "👁️" (Ver informe)
   - O acceder directamente: `/informe/[deliveryId]`

2. **Verificar imágenes de Google Drive**:
   - ✅ Firmas deben mostrarse desde Google Drive
   - ✅ Fotos deben mostrarse desde Google Drive
   - ✅ Badge "📂 Google Drive" debe aparecer
   - ✅ Botón "Ver Original" debe abrir imagen en Google Drive

#### 2.4 Testing eliminación mejorada
1. **Seleccionar entregas en admin**:
   - Usar checkboxes individuales
   - Usar "Seleccionar todo"

2. **Eliminar entregas**:
   - Individual: Botón "🗑️"
   - Masivo: Botón "Eliminar Seleccionadas"

3. **Verificar comportamiento**:
   - ✅ Etiquetas/badges deben desaparecer inmediatamente
   - ✅ Entregas de Google Sheets deben mostrar advertencia
   - ✅ Estado debe actualizarse correctamente

---

### **FASE 3: Testing de Compatibilidad (10 min)**

#### 3.1 Testing móvil
1. **Abrir desde smartphone**:
   ```
   URL: https://activi-rutes.vercel.app/transporter/test-route-123
   ```

2. **Verificar funcionalidades críticas**:
   - ✅ Cámara funciona correctamente
   - ✅ Firma digital responsive
   - ✅ Envío a Google Drive exitoso
   - ✅ Sin errores de "Application error"

#### 3.2 Testing cross-device
1. **Crear entrega desde móvil**
2. **Verificar sincronización en escritorio**:
   - Admin panel debe mostrar nueva entrega
   - Imágenes deben cargarse desde Google Drive
   - Informe debe ser accesible desde cualquier dispositivo

---

## 🔍 CRITERIOS DE ÉXITO

### ✅ **Google Drive Storage**
- [ ] Imágenes aparecen en carpeta específica de Google Drive
- [ ] Archivos son públicos y accesibles via URL
- [ ] Nombres siguen formato `foto_timestamp.jpg` / `firma_timestamp.jpg`

### ✅ **Frontend Mejorado**
- [ ] Admin muestra previsualizaciones de imágenes
- [ ] Informes cargan imágenes desde Google Drive
- [ ] Fallback a imágenes locales funciona
- [ ] Botones "Ver Original" funcionan

### ✅ **Eliminación Robusta**
- [ ] Etiquetas desaparecen al eliminar entregas
- [ ] Funciona con entregas de diferentes orígenes
- [ ] Selección múltiple funciona correctamente

### ✅ **Compatibilidad**
- [ ] Sistema funciona en móvil y escritorio
- [ ] Sincronización cross-device operativa
- [ ] Sin errores críticos en ningún dispositivo

---

## 🚨 TROUBLESHOOTING

### **Si imágenes no aparecen en Google Drive:**
1. Verificar permisos del Google Apps Script
2. Ejecutar `testCompleteFlow()` manualmente
3. Revisar logs en hoja "LOGS_DEBUG"
4. Verificar que `appsscript.json` incluya permisos de Drive

### **Si admin no muestra imágenes:**
1. Cambiar fuente de datos a "Google Sheets"
2. Verificar URLs en Developer Tools → Network
3. Comprobar que Google Sheets tenga columnas de URLs

### **Si eliminación no funciona:**
1. Abrir Developer Tools → Console
2. Verificar logs de eliminación
3. Comprobar que localStorage se actualice
4. Verificar origen de datos (localStorage vs sheets)

---

## 📈 MÉTRICAS DE RENDIMIENTO

### **Tiempos esperados:**
- Subida de imagen a Google Drive: < 5 segundos
- Carga de admin con imágenes: < 3 segundos
- Eliminación de entregas: < 1 segundo
- Carga de informe individual: < 2 segundos

### **Compatibilidad objetivo:**
- ✅ Chrome/Edge/Safari (escritorio)
- ✅ Chrome/Safari (móvil)
- ✅ Resoluciones desde 320px hasta 4K

---

**🎯 OBJETIVO FINAL:** Sistema 100% operativo con imágenes funcionando correctamente en Google Drive y frontend completamente actualizado.

*Creado el 16 de septiembre de 2025* 