# 🚨 PROBLEMAS PENDIENTES - ActiviRutes

**Fecha**: 14 de septiembre de 2025  
**Estado**: Pendiente para próximo día  
**Prioridad**: Alta  

---

## 📋 PROBLEMAS IDENTIFICADOS

### 1. 🏷️ **Etiquetas creadas no se eliminan**
**Problema**: Al eliminar entregas del admin, las etiquetas/badges permanecen visible
**Impacto**: Interfaz inconsistente, datos fantasma
**Estado**: ❌ Sin resolver
**Prioridad**: Media

**Detalles técnicos**:
- Los checkboxes de selección funcionan
- El borrado de localStorage funciona
- Las etiquetas visuales no se actualizan después del borrado

---

### 2. 📅 **Orden cronológico incorrecto**
**Problema**: Las entregas más antiguas NO aparecen abajo como se requería
**Impacto**: UX confusa, dificultad para encontrar entregas recientes
**Estado**: ❌ Sin resolver
**Prioridad**: Media

**Comportamiento esperado**:
- Entregas MÁS RECIENTES arriba ✅ (funciona)
- Entregas MÁS ANTIGUAS abajo ❌ (no se verifica)

**Archivos afectados**:
- `app/admin/page.tsx` líneas 205-209, 127-131

---

### 3. 📸 **Imágenes no se guardan en Google Drive**
**Problema**: Las fotos/firmas no llegan a la carpeta específica de Google Drive
**Impacto**: CRÍTICO - Funcionalidad principal no operativa
**Estado**: ❌ Sin resolver
**Prioridad**: ALTA

**Detalles**:
- **Carpeta objetivo**: `1CubYYXeUuGBXY9pSbWr5DYkEKQZAIPxP`
- **URL**: https://drive.google.com/drive/folders/1CubYYXeUuGBXY9pSbWr5DYkEKQZAIPxP
- **Estado actual**: Carpeta vacía, no se crean archivos

**Posibles causas**:
- Permisos de Google Apps Script
- Error en la función `uploadImageToDrive`
- Problema de autenticación con Google Drive API
- Configuración incorrecta del Folder ID

---

### 4. 🖼️ **Imágenes no se cargan en la app**
**Problema**: Las fotos/firmas no se muestran en admin ni informes
**Impacto**: CRÍTICO - Sin visualización de evidencias
**Estado**: ❌ Sin resolver  
**Prioridad**: ALTA

**Comportamiento observado**:
- Admin muestra "SÍ" en badges de firma/foto
- Informes no cargan imágenes
- URLs de Google Drive no generadas/accesibles

**Archivos afectados**:
- `app/admin/page.tsx` - Visualización de badges
- `app/informe/[deliveryId]/page.tsx` - Carga de imágenes
- `app/api/deliveries/route.ts` - Procesamiento URLs Drive

---

## 🔧 DIAGNÓSTICO TÉCNICO REQUERIDO

### **Google Apps Script**
- [ ] Verificar permisos de Google Drive API
- [ ] Testear función `uploadImageToDrive` manualmente
- [ ] Revisar logs de ejecución en Apps Script
- [ ] Confirmar acceso a carpeta específica

### **Frontend**
- [ ] Debug de envío de imágenes desde transporter
- [ ] Verificar formato Base64 de las imágenes
- [ ] Revisar respuestas de Google Apps Script
- [ ] Testear carga de URLs en componentes

### **Flujo completo**
- [ ] Trace completo: Smartphone → Apps Script → Drive → Sheets → Admin
- [ ] Verificar cada paso de la cadena de datos
- [ ] Logs detallados en cada etapa

---

## 📝 PLAN DE RESOLUCIÓN (Próximo día)

### **Fase 1: Diagnóstico (30 min)**
1. Revisar Google Apps Script logs
2. Testear función upload manualmente
3. Verificar permisos de carpeta Drive

### **Fase 2: Corrección Google Drive (60 min)**
1. Arreglar función `uploadImageToDrive`
2. Verificar autenticación y permisos
3. Testear subida real de imágenes

### **Fase 3: Frontend fixes (30 min)**
1. Corregir eliminación de etiquetas
2. Verificar ordenación cronológica
3. Mejorar carga de imágenes en UI

### **Fase 4: Testing completo (30 min)**
1. Test end-to-end completo
2. Verificar flujo smartphone → admin
3. Confirmar visualización de imágenes

---

## 🎯 CRITERIOS DE ÉXITO

**Problema resuelto cuando**:
- [ ] Fotos aparecen en carpeta Google Drive específica
- [ ] Admin muestra imágenes desde Drive URLs  
- [ ] Informes cargan fotos/firmas correctamente
- [ ] Etiquetas se eliminan al borrar entregas
- [ ] Orden cronológico es consistente

---

## 📄 ARCHIVOS PRINCIPALES A REVISAR

```
google-apps-script/
└── Code.gs                    # Función uploadImageToDrive

app/
├── transporter/[routeId]/
│   └── page.tsx              # Envío de imágenes
├── admin/
│   └── page.tsx              # Borrado etiquetas + ordenación  
├── informe/[deliveryId]/
│   └── page.tsx              # Carga de imágenes
└── api/deliveries/
    └── route.ts              # Procesamiento URLs Drive
```

---

**⏰ Estimación total de resolución: 2-3 horas**  
**🎯 Objetivo: Sistema 100% funcional con imágenes operativas**

---

*Documento creado automáticamente por Claude Code*  
*Último update: 14 septiembre 2025, 23:45*