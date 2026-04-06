/**
 * ActiviRutes - Google Apps Script para recibir datos de entregas
 * VERSION CON LOGGING A SHEETS Y GOOGLE DRIVE STORAGE
 */

function createJSONResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// NUEVA FUNCIÓN: Escribir logs a una hoja de Sheets
function logToSheet(message, data = null) {
  try {
    const SHEET_ID = '1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I';
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);

    // Crear hoja de logs si no existe
    let logSheet = spreadsheet.getSheetByName('LOGS_DEBUG');
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('LOGS_DEBUG');
      logSheet.getRange(1, 1, 1, 3).setValues([['TIMESTAMP', 'MESSAGE', 'DATA']]);
    }

    const timestamp = new Date().toISOString();
    const dataStr = data ? JSON.stringify(data) : '';

    logSheet.appendRow([timestamp, message, dataStr]);
  } catch (error) {
    // Si falla el logging, no hacer nada para no romper la función principal
  }
}

// ✅ NUEVA FUNCIÓN: Construir timestamp ISO a partir de FECHA y HORA de Sheets
function buildTimestampISO(dateCell, timeCell) {
  try {
    const tz = 'Europe/Madrid';

    // Normalizar fecha
    let year, month, day;
    if (dateCell instanceof Date) {
      year = dateCell.getFullYear();
      month = dateCell.getMonth() + 1;
      day = dateCell.getDate();
    } else {
      const rawDate = String(dateCell || '').trim();
      if (rawDate.includes('/')) {
        const [d, m, y] = rawDate.split('/');
        day = parseInt(d, 10);
        month = parseInt(m, 10);
        year = parseInt(y, 10);
      } else if (rawDate.includes('-')) {
        const [y, m, d] = rawDate.split('-');
        day = parseInt(d, 10);
        month = parseInt(m, 10);
        year = parseInt(y, 10);
      }
    }

    // Normalizar hora
    let hour = 12, minute = 0, second = 0;
    if (timeCell instanceof Date) {
      hour = timeCell.getHours();
      minute = timeCell.getMinutes();
      second = timeCell.getSeconds();
    } else {
      const rawTime = String(timeCell || '').trim();
      if (rawTime.includes(':')) {
        const parts = rawTime.split(':');
        hour = parseInt(parts[0] || '0', 10);
        minute = parseInt(parts[1] || '0', 10);
        second = parseInt(parts[2] || '0', 10);
      } else if (/^\d{4}$/.test(rawTime)) {
        hour = parseInt(rawTime.slice(0, 2), 10);
        minute = parseInt(rawTime.slice(2), 10);
      } else if (/^\d{3}$/.test(rawTime)) {
        hour = parseInt(rawTime.slice(0, 1), 10);
        minute = parseInt(rawTime.slice(1), 10);
      }
    }

    if (!year || !month || !day) return '';

    // Crear fecha en UTC para obtener ISO estable
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    return date.toISOString();
  } catch (e) {
    logToSheet('❌ buildTimestampISO error', e.toString());
    return '';
  }
}

// NUEVA FUNCIÓN: Subir imagen a Google Drive
function uploadImageToDrive(base64Data, fileName, folderId) {
  try {
    logToSheet('📤 INICIO uploadImageToDrive', { fileName, folderId });

    // Verificar que tenemos datos
    if (!base64Data || !fileName) {
      logToSheet('❌ Datos incompletos para subida', { base64Data: !!base64Data, fileName });
      return null;
    }

    // Limpiar el base64 (remover data:image/jpeg;base64, si existe)
    let cleanBase64 = base64Data;
    if (base64Data.includes('data:image')) {
      cleanBase64 = base64Data.split(',')[1];
    }

    // Convertir base64 a blob
    const bytes = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(bytes, 'image/jpeg', fileName);

    logToSheet('📤 Blob creado', { size: bytes.length, name: fileName });

    // Obtener la carpeta de destino
    const folder = DriveApp.getFolderById(folderId);
    
    // Subir el archivo
    const file = folder.createFile(blob);
    
    // Hacer el archivo público para lectura - COMPLETAMENTE PÚBLICO
    try {
      file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
      logToSheet('🌐 Archivo configurado como público en internet');
    } catch (publicError) {
      // Si falla el acceso público completo, intentar con enlace
      logToSheet('⚠️ No se pudo hacer público en internet, usando enlace público');
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
    
    // Generar URLs útiles para visualización directa
    const fileId = file.getId();
    const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
    const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
    
    logToSheet('✅ Imagen subida exitosamente', { 
      fileId: fileId, 
      viewUrl: viewUrl,
      directUrl: directUrl,
      size: file.getSize()
    });

    return {
      fileId: fileId,
      url: viewUrl,
      directUrl: directUrl,
      name: fileName,
      size: file.getSize()
    };

  } catch (error) {
    logToSheet('❌ ERROR subiendo imagen', { 
      error: error.toString(),
      fileName,
      stack: error.stack
    });
    return null;
  }
}

function doGet(e) {
  logToSheet('🚨 doGet ejecutado');

  return createJSONResponse({
    status: 'success',
    message: 'ActiviRutes API ready - WITH SHEET LOGGING & DRIVE STORAGE',
    timestamp: new Date().toISOString(),
    version: '3.0'
  });
}

function doPost(e) {
  try {
    logToSheet('🚨 NUEVO POST recibido');
    logToSheet('🚨 POST contenido', e.postData.contents);

    const data = JSON.parse(e.postData.contents);
    logToSheet('🚨 Datos parseados', data);

    // === ACCIONES LEGACY ===
    if (data.action === 'addDelivery') {
      return addDeliveryToSheet(data.data, data.images);
    }

    if (data.action === 'getDeliveries') {
      return getDeliveriesFromSheet(data.sheetName);
    }

    if (data.action === 'makeImagesPublic') {
      return createJSONResponse(makeExistingImagesPublic());
    }

    // === ACCIONES DE PROYECTOS ===
    if (data.action === 'createProject') {
      return createProject(data.projectData);
    }

    if (data.action === 'getProjects') {
      return getProjects(data.tipo);
    }

    if (data.action === 'getProject') {
      return getProject(data.projectId);
    }

    if (data.action === 'deleteProject') {
      return deleteProject(data.projectId);
    }

    if (data.action === 'saveProjectDeliveries') {
      return saveProjectDeliveries(data.projectId, data.deliveries);
    }

    if (data.action === 'getProjectDeliveries') {
      return getProjectDeliveries(data.projectId);
    }

    if (data.action === 'updateDeliveryStatus') {
      return updateDeliveryStatus(
        data.projectId,
        data.centro,
        data.status,
        data.fechaEntrega,
        data.notas
      );
    }

    if (data.action === 'updateMultipleDeliveries') {
      return updateMultipleDeliveries(
        data.projectId,
        data.centros,
        data.status,
        data.fechaEntrega
      );
    }

    if (data.action === 'updateProject') {
      return updateProject(data.projectId, data.updates);
    }

    if (data.action === 'getProjectRoute') {
      return getProjectRoute(data.projectId, data.dia);
    }

    logToSheet('❌ Acción no válida', data.action);
    return createJSONResponse({
      status: 'error',
      message: 'Acción no válida'
    });

  } catch (error) {
    logToSheet('❌ ERROR en doPost', error.toString());
    return createJSONResponse({
      status: 'error',
      message: 'Error: ' + error.toString()
    });
  }
}

function addDeliveryToSheet(rowData, images) {
  try {
    logToSheet('🚨 INICIO addDeliveryToSheet');
    logToSheet('🚨 rowData recibido', rowData);
    logToSheet('🚨 images recibido', images ? Object.keys(images) : 'ninguna');

    // Configuración de Google Drive
    const DRIVE_FOLDER_ID = '1CubYYXeUuGBXY9pSbWr5DYkEKQZAIPxP';
    const SHEET_ID = '1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I';
    const SHEET_NAME = 'ENTREGAS';

    // Procesar imágenes si existen
    let photoUrl = '';
    let signatureUrl = '';

    if (images) {
      const timestamp = Date.now();

      // Procesar foto
      if (images.photo) {
        logToSheet('📸 Procesando foto');
        const photoResult = uploadImageToDrive(
          images.photo, 
          `foto_${timestamp}.jpg`, 
          DRIVE_FOLDER_ID
        );
        if (photoResult) {
          photoUrl = photoResult.directUrl; // Usar URL directa para visualización
          logToSheet('✅ Foto subida', { viewUrl: photoResult.url, directUrl: photoResult.directUrl });
        }
      }

      // Procesar firma
      if (images.signature) {
        logToSheet('✍️ Procesando firma');
        const signatureResult = uploadImageToDrive(
          images.signature, 
          `firma_${timestamp}.jpg`, 
          DRIVE_FOLDER_ID
        );
        if (signatureResult) {
          signatureUrl = signatureResult.directUrl; // Usar URL directa para visualización
          logToSheet('✅ Firma subida', { viewUrl: signatureResult.url, directUrl: signatureResult.directUrl });
        }
      }
    }

    // Agregar URLs de imágenes al final del array de datos
    const finalRowData = [...rowData, photoUrl, signatureUrl];

    // Guardar en Google Sheets
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error(`No se encontró la hoja "${SHEET_NAME}"`);
    }

    logToSheet('🚨 Insertando en Sheets con URLs', { 
      photoUrl, 
      signatureUrl,
      totalColumns: finalRowData.length 
    });
    
    sheet.appendRow(finalRowData);

    const timestamp = new Date().toISOString();
    logToSheet('🚨 ÉXITO - Datos e imágenes insertados', timestamp);

    return createJSONResponse({
      status: 'success',
      message: 'Datos e imágenes agregados correctamente',
      timestamp: timestamp,
      rowData: finalRowData,
      imagesProcessed: {
        photo: !!photoUrl,
        signature: !!signatureUrl,
        photoUrl,
        signatureUrl
      }
    });

  } catch (error) {
    logToSheet('❌ ERROR insertando', error.toString());
    return createJSONResponse({
      status: 'error',
      message: 'Error: ' + error.toString()
    });
  }
}

// FUNCIÓN DE PRUEBA
function testSheetLogging() {
  logToSheet('🧪 PRUEBA MANUAL DE LOGGING');
  logToSheet('🧪 Timestamp', new Date().toISOString());
  logToSheet('🧪 Datos de prueba', { test: true, number: 123 });

  return 'Logging test completed - check LOGS_DEBUG sheet';
}

// FUNCIÓN DE PRUEBA PARA GOOGLE DRIVE
function testDriveUpload() {
  try {
    logToSheet('🧪 INICIO TEST DRIVE UPLOAD');
    
    // Crear una imagen de prueba (1x1 pixel rojo en base64)
    const testBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxAAPwA/8A8A';
    
    const result = uploadImageToDrive(
      testBase64,
      'test_image.jpg',
      '1CubYYXeUuGBXY9pSbWr5DYkEKQZAIPxP'
    );
    
    logToSheet('🧪 RESULTADO TEST DRIVE', result);
    
    return `Test completed. Result: ${JSON.stringify(result)}`;
    
  } catch (error) {
    logToSheet('❌ ERROR TEST DRIVE', error.toString());
    return `Test failed: ${error.toString()}`;
  }
}

// FUNCIÓN PARA HACER PÚBLICAS LAS IMÁGENES EXISTENTES
function makeExistingImagesPublic() {
  try {
    const DRIVE_FOLDER_ID = '1CubYYXeUuGBXY9pSbWr5DYkEKQZAIPxP';
    logToSheet('🔄 Iniciando proceso para hacer públicas imágenes existentes');
    
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const files = folder.getFiles();
    
    let processedCount = 0;
    let errorCount = 0;
    
    while (files.hasNext()) {
      const file = files.next();
      
      try {
        // Intentar hacer completamente público
        file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
        logToSheet(`✅ Archivo ${file.getName()} configurado como público`, { fileId: file.getId() });
        processedCount++;
      } catch (error) {
        try {
          // Si falla, intentar con enlace público
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          logToSheet(`⚠️ Archivo ${file.getName()} configurado con enlace público`, { fileId: file.getId() });
          processedCount++;
        } catch (error2) {
          logToSheet(`❌ Error configurando ${file.getName()}`, { 
            fileId: file.getId(),
            error: error2.toString() 
          });
          errorCount++;
        }
      }
    }
    
    logToSheet('🎉 Proceso completado', { 
      processed: processedCount, 
      errors: errorCount 
    });
    
    return {
      status: 'success',
      processed: processedCount,
      errors: errorCount,
      message: `${processedCount} archivos procesados, ${errorCount} errores`
    };
    
  } catch (error) {
    logToSheet('❌ ERROR en makeExistingImagesPublic', error.toString());
    return {
      status: 'error',
      message: error.toString()
    };
  }
}

// ============================================
// SISTEMA DE PROYECTOS - ENTREGAS Y RECOGIDAS
// ============================================

const SHEET_ID = '1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I';

// Crear hojas de proyectos si no existen
function initProjectSheets() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);

  // Hoja de Proyectos (9 columnas)
  let projectsSheet = spreadsheet.getSheetByName('Proyectos');
  if (!projectsSheet) {
    projectsSheet = spreadsheet.insertSheet('Proyectos');
    projectsSheet.getRange(1, 1, 1, 9).setValues([[
      'ID', 'Tipo', 'Modo', 'FechaInicio', 'FechaFin', 'Actividades', 'Estado', 'FechaCreacion', 'Festivos'
    ]]);
    logToSheet('✅ Hoja Proyectos creada (v2)');
  } else {
    // Migrar: añadir columna Festivos si no existe
    var headers = projectsSheet.getRange(1, 1, 1, 9).getValues()[0];
    if (!headers[8] || headers[8] !== 'Festivos') {
      projectsSheet.getRange(1, 9).setValue('Festivos');
    }
  }

  // Hoja de Entregas del Proyecto (10 columnas)
  let deliveriesSheet = spreadsheet.getSheetByName('ProyectoEntregas');
  if (!deliveriesSheet) {
    deliveriesSheet = spreadsheet.insertSheet('ProyectoEntregas');
    deliveriesSheet.getRange(1, 1, 1, 10).setValues([[
      'ProyectoID', 'Centro', 'Direccion', 'FechaPlanificada', 'DiaPlanificado',
      'FechaEntrega', 'Estado', 'Actividades', 'Notas', 'Orden'
    ]]);
    logToSheet('✅ Hoja ProyectoEntregas creada (v2)');
  } else {
    // Migrar: añadir columna Orden si no existe
    var dHeaders = deliveriesSheet.getRange(1, 1, 1, 10).getValues()[0];
    if (!dHeaders[9] || dHeaders[9] !== 'Orden') {
      deliveriesSheet.getRange(1, 10).setValue('Orden');
    }
  }

  return { projectsSheet, deliveriesSheet };
}

// Crear un nuevo proyecto
function createProject(projectData) {
  try {
    logToSheet('🚀 Creando proyecto', projectData);

    const { projectsSheet } = initProjectSheets();

    // Generar ID único
    const projectId = 'P' + Date.now();

    const festivos = Array.isArray(projectData.festivos) ? JSON.stringify(projectData.festivos) : '[]';

    const row = [
      projectId,
      projectData.tipo,           // 'entrega' o 'recogida'
      projectData.modo,           // 'trimestral' o 'inicio-curso'
      projectData.fechaInicio,    // YYYY-MM-DD
      projectData.fechaFin,       // YYYY-MM-DD
      projectData.actividades.join(','),  // 'TC,CO,DX,JC'
      'activo',
      new Date().toISOString(),
      festivos                    // JSON array de fechas festivas
    ];

    projectsSheet.appendRow(row);

    logToSheet('✅ Proyecto creado', { projectId });

    return createJSONResponse({
      status: 'success',
      projectId: projectId,
      message: 'Proyecto creado correctamente'
    });

  } catch (error) {
    logToSheet('❌ Error creando proyecto', error.toString());
    return createJSONResponse({
      status: 'error',
      message: 'Error creando proyecto: ' + error.toString()
    });
  }
}

// Obtener todos los proyectos (o filtrar por tipo)
function getProjects(tipo = null) {
  try {
    logToSheet('📋 Obteniendo proyectos', { tipo });

    const { projectsSheet } = initProjectSheets();

    const lastRow = projectsSheet.getLastRow();
    if (lastRow <= 1) {
      return createJSONResponse({
        status: 'success',
        data: [],
        message: 'No hay proyectos'
      });
    }

    const data = projectsSheet.getRange(2, 1, lastRow - 1, 9).getValues();

    let projects = data.map(row => ({
      id: row[0],
      tipo: row[1],
      modo: row[2],
      fechaInicio: row[3],
      fechaFin: row[4],
      actividades: row[5] ? row[5].split(',') : [],
      estado: row[6],
      fechaCreacion: row[7],
      festivos: (() => { try { return JSON.parse(row[8] || '[]'); } catch(e) { return []; } })()
    }));

    // Filtrar por tipo si se especifica
    if (tipo) {
      projects = projects.filter(p => p.tipo === tipo);
    }

    // Filtrar solo activos por defecto
    projects = projects.filter(p => p.estado === 'activo');

    logToSheet('✅ Proyectos obtenidos', { count: projects.length });

    return createJSONResponse({
      status: 'success',
      data: projects,
      message: `${projects.length} proyectos obtenidos`
    });

  } catch (error) {
    logToSheet('❌ Error obteniendo proyectos', error.toString());
    return createJSONResponse({
      status: 'error',
      message: 'Error obteniendo proyectos: ' + error.toString()
    });
  }
}

// Obtener un proyecto específico
function getProject(projectId) {
  try {
    const { projectsSheet } = initProjectSheets();

    const lastRow = projectsSheet.getLastRow();
    if (lastRow <= 1) {
      return createJSONResponse({
        status: 'error',
        message: 'Proyecto no encontrado'
      });
    }

    const data = projectsSheet.getRange(2, 1, lastRow - 1, 9).getValues();
    const row = data.find(r => r[0] === projectId);

    if (!row) {
      return createJSONResponse({
        status: 'error',
        message: 'Proyecto no encontrado'
      });
    }

    return createJSONResponse({
      status: 'success',
      data: {
        id: row[0],
        tipo: row[1],
        modo: row[2],
        fechaInicio: row[3],
        fechaFin: row[4],
        actividades: row[5] ? row[5].split(',') : [],
        estado: row[6],
        fechaCreacion: row[7],
        festivos: (() => { try { return JSON.parse(row[8] || '[]'); } catch(e) { return []; } })()
      }
    });

  } catch (error) {
    return createJSONResponse({
      status: 'error',
      message: 'Error: ' + error.toString()
    });
  }
}

// Guardar entregas de un proyecto (batch)
function saveProjectDeliveries(projectId, deliveries) {
  try {
    logToSheet('💾 Guardando entregas del proyecto', { projectId, count: deliveries.length });

    const { deliveriesSheet } = initProjectSheets();

    // Primero, eliminar entregas existentes de este proyecto para evitar duplicados
    const lastRowBefore = deliveriesSheet.getLastRow();
    if (lastRowBefore > 1) {
      const existingData = deliveriesSheet.getRange(2, 1, lastRowBefore - 1, 1).getValues();
      // Eliminar filas del proyecto de abajo hacia arriba
      for (var i = existingData.length - 1; i >= 0; i--) {
        if (existingData[i][0] === projectId) {
          deliveriesSheet.deleteRow(i + 2);
        }
      }
    }

    // Preparar filas para insertar (10 columnas)
    const rows = deliveries.map((d, index) => [
      projectId,
      d.centro,
      d.direccion || '',
      d.fechaPlanificada || '',  // YYYY-MM-DD
      d.diaPlanificado,          // 'Dilluns', 'Dimarts', etc.
      d.fechaEntrega || '',      // vacío si pendiente
      d.estado || 'pendiente',   // 'pendiente', 'entregado', 'adelantado'
      Array.isArray(d.actividades) ? d.actividades.join(',') : d.actividades,
      d.notas || '',
      d.orden != null ? d.orden : index + 1  // Orden dentro del día
    ]);

    // Insertar todas las filas
    if (rows.length > 0) {
      deliveriesSheet.getRange(
        deliveriesSheet.getLastRow() + 1,
        1,
        rows.length,
        10
      ).setValues(rows);
    }

    logToSheet('✅ Entregas guardadas', { count: rows.length });

    return createJSONResponse({
      status: 'success',
      message: `${rows.length} entregas guardadas`,
      count: rows.length
    });

  } catch (error) {
    logToSheet('❌ Error guardando entregas', error.toString());
    return createJSONResponse({
      status: 'error',
      message: 'Error: ' + error.toString()
    });
  }
}

// Obtener entregas de un proyecto
function getProjectDeliveries(projectId) {
  try {
    logToSheet('📋 Obteniendo entregas del proyecto', projectId);

    const { deliveriesSheet } = initProjectSheets();

    const lastRow = deliveriesSheet.getLastRow();
    if (lastRow <= 1) {
      return createJSONResponse({
        status: 'success',
        data: [],
        message: 'No hay entregas'
      });
    }

    const data = deliveriesSheet.getRange(2, 1, lastRow - 1, 10).getValues();

    // Filtrar por proyecto y mapear
    const deliveries = data
      .filter(row => row[0] === projectId)
      .map(row => ({
        proyectoId: row[0],
        centro: row[1],
        direccion: row[2],
        fechaPlanificada: row[3],
        diaPlanificado: row[4],
        fechaEntrega: row[5],
        estado: row[6],
        actividades: row[7] ? String(row[7]).split(',') : [],
        notas: row[8],
        orden: row[9] || 0
      }))
      // Ordenar por día y luego por orden dentro del día
      .sort((a, b) => {
        var dayOrder = { 'Dilluns': 1, 'Dimarts': 2, 'Dimecres': 3, 'Dijous': 4, 'Divendres': 5 };
        var dayDiff = (dayOrder[a.diaPlanificado] || 99) - (dayOrder[b.diaPlanificado] || 99);
        if (dayDiff !== 0) return dayDiff;
        return (a.orden || 0) - (b.orden || 0);
      });

    logToSheet('✅ Entregas obtenidas', { count: deliveries.length });

    return createJSONResponse({
      status: 'success',
      data: deliveries,
      message: `${deliveries.length} entregas del proyecto`
    });

  } catch (error) {
    logToSheet('❌ Error obteniendo entregas', error.toString());
    return createJSONResponse({
      status: 'error',
      message: 'Error: ' + error.toString()
    });
  }
}

// Actualizar estado de una entrega
function updateDeliveryStatus(projectId, centro, newStatus, fechaEntrega = null, notas = null) {
  try {
    logToSheet('🔄 Actualizando estado entrega', { projectId, centro, newStatus });

    const { deliveriesSheet } = initProjectSheets();

    const lastRow = deliveriesSheet.getLastRow();
    if (lastRow <= 1) {
      return createJSONResponse({
        status: 'error',
        message: 'No hay entregas'
      });
    }

    const data = deliveriesSheet.getRange(2, 1, lastRow - 1, 9).getValues();

    // Buscar la fila del centro en este proyecto
    let rowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === projectId && data[i][1] === centro) {
        rowIndex = i + 2; // +2 porque empezamos en fila 2 y arrays en 0
        break;
      }
    }

    if (rowIndex === -1) {
      return createJSONResponse({
        status: 'error',
        message: 'Entrega no encontrada'
      });
    }

    // Actualizar estado (columna 7)
    deliveriesSheet.getRange(rowIndex, 7).setValue(newStatus);

    // Actualizar fecha de entrega si se proporciona (columna 6)
    if (fechaEntrega) {
      deliveriesSheet.getRange(rowIndex, 6).setValue(fechaEntrega);
    }

    // Actualizar notas si se proporcionan (columna 9)
    if (notas) {
      deliveriesSheet.getRange(rowIndex, 9).setValue(notas);
    }

    logToSheet('✅ Estado actualizado', { rowIndex, newStatus });

    return createJSONResponse({
      status: 'success',
      message: 'Estado actualizado correctamente',
      rowIndex: rowIndex
    });

  } catch (error) {
    logToSheet('❌ Error actualizando estado', error.toString());
    return createJSONResponse({
      status: 'error',
      message: 'Error: ' + error.toString()
    });
  }
}

// Actualizar múltiples entregas a la vez (para marcar ruta completa)
function updateMultipleDeliveries(projectId, centros, newStatus, fechaEntrega) {
  try {
    logToSheet('🔄 Actualizando múltiples entregas', { projectId, count: centros.length, newStatus });

    let updated = 0;
    let errors = 0;

    for (const centro of centros) {
      const result = JSON.parse(updateDeliveryStatus(projectId, centro, newStatus, fechaEntrega).getContent());
      if (result.status === 'success') {
        updated++;
      } else {
        errors++;
      }
    }

    logToSheet('✅ Actualización múltiple completada', { updated, errors });

    return createJSONResponse({
      status: 'success',
      message: `${updated} entregas actualizadas, ${errors} errores`,
      updated: updated,
      errors: errors
    });

  } catch (error) {
    logToSheet('❌ Error en actualización múltiple', error.toString());
    return createJSONResponse({
      status: 'error',
      message: 'Error: ' + error.toString()
    });
  }
}

// Eliminar proyecto (marcar como inactivo)
function deleteProject(projectId) {
  try {
    logToSheet('🗑️ Eliminando proyecto', projectId);

    const { projectsSheet } = initProjectSheets();

    const lastRow = projectsSheet.getLastRow();
    if (lastRow <= 1) {
      return createJSONResponse({
        status: 'error',
        message: 'Proyecto no encontrado'
      });
    }

    const data = projectsSheet.getRange(2, 1, lastRow - 1, 8).getValues();

    // Buscar la fila del proyecto
    let rowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === projectId) {
        rowIndex = i + 2;
        break;
      }
    }

    if (rowIndex === -1) {
      return createJSONResponse({
        status: 'error',
        message: 'Proyecto no encontrado'
      });
    }

    // Marcar como inactivo (columna 7)
    projectsSheet.getRange(rowIndex, 7).setValue('eliminado');

    logToSheet('✅ Proyecto eliminado', { projectId, rowIndex });

    return createJSONResponse({
      status: 'success',
      message: 'Proyecto eliminado correctamente'
    });

  } catch (error) {
    logToSheet('❌ Error eliminando proyecto', error.toString());
    return createJSONResponse({
      status: 'error',
      message: 'Error: ' + error.toString()
    });
  }
}

// Actualizar proyecto (festivos, actividades, etc.)
function updateProject(projectId, updates) {
  try {
    logToSheet('🔄 Actualizando proyecto', { projectId, updates: Object.keys(updates) });

    const { projectsSheet } = initProjectSheets();
    const lastRow = projectsSheet.getLastRow();
    if (lastRow <= 1) {
      return createJSONResponse({ status: 'error', message: 'Proyecto no encontrado' });
    }

    const data = projectsSheet.getRange(2, 1, lastRow - 1, 9).getValues();
    var rowIndex = -1;
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === projectId) { rowIndex = i + 2; break; }
    }

    if (rowIndex === -1) {
      return createJSONResponse({ status: 'error', message: 'Proyecto no encontrado' });
    }

    // Actualizar campos que vengan en updates
    if (updates.festivos !== undefined) {
      var festivosStr = Array.isArray(updates.festivos) ? JSON.stringify(updates.festivos) : updates.festivos;
      projectsSheet.getRange(rowIndex, 9).setValue(festivosStr);
    }
    if (updates.actividades !== undefined) {
      var actStr = Array.isArray(updates.actividades) ? updates.actividades.join(',') : updates.actividades;
      projectsSheet.getRange(rowIndex, 6).setValue(actStr);
    }
    if (updates.modo !== undefined) {
      projectsSheet.getRange(rowIndex, 3).setValue(updates.modo);
    }
    if (updates.fechaInicio !== undefined) {
      projectsSheet.getRange(rowIndex, 4).setValue(updates.fechaInicio);
    }
    if (updates.fechaFin !== undefined) {
      projectsSheet.getRange(rowIndex, 5).setValue(updates.fechaFin);
    }

    logToSheet('✅ Proyecto actualizado', { projectId, rowIndex });
    return createJSONResponse({ status: 'success', message: 'Proyecto actualizado' });

  } catch (error) {
    logToSheet('❌ Error actualizando proyecto', error.toString());
    return createJSONResponse({ status: 'error', message: 'Error: ' + error.toString() });
  }
}

// Obtener ruta de un proyecto por día (para transportista)
function getProjectRoute(projectId, dia) {
  try {
    logToSheet('🚚 Obteniendo ruta', { projectId, dia });

    const { deliveriesSheet } = initProjectSheets();
    const lastRow = deliveriesSheet.getLastRow();
    if (lastRow <= 1) {
      return createJSONResponse({ status: 'success', data: [], message: 'Sin entregas' });
    }

    const data = deliveriesSheet.getRange(2, 1, lastRow - 1, 10).getValues();

    var items = data
      .filter(function(row) { return row[0] === projectId && row[4] === dia; })
      .map(function(row) {
        return {
          centro: row[1],
          direccion: row[2],
          diaPlanificado: row[4],
          estado: row[6],
          actividades: row[7] ? String(row[7]).split(',') : [],
          orden: row[9] || 0
        };
      })
      .sort(function(a, b) { return (a.orden || 0) - (b.orden || 0); });

    logToSheet('✅ Ruta obtenida', { projectId, dia, count: items.length });
    return createJSONResponse({ status: 'success', data: items });

  } catch (error) {
    logToSheet('❌ Error obteniendo ruta', error.toString());
    return createJSONResponse({ status: 'error', message: 'Error: ' + error.toString() });
  }
}

// Función simplificada para obtener entregas
function getDeliveriesFromSheet(sheetName = 'ENTREGAS') {
  try {
    logToSheet('🚨 getDeliveriesFromSheet iniciado', sheetName);

    const SHEET_ID = '1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I';
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      logToSheet('❌ Hoja no encontrada', sheetName);
      return createJSONResponse({
        status: 'error',
        message: 'Hoja no encontrada: ' + sheetName
      });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      logToSheet('ℹ️ No hay entregas en la hoja');
      return createJSONResponse({
        status: 'success',
        data: [],
        message: 'No hay entregas registradas'
      });
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const dataRange = sheet.getRange(2, 1, lastRow - 1, headers.length);
    const rows = dataRange.getValues();

    // Índices útiles
    const dateIdx = headers.findIndex(h => ['FECHA', 'Fecha', 'fecha'].indexOf(h) !== -1);
    const timeIdx = headers.findIndex(h => ['HORA', 'Hora', 'hora'].indexOf(h) !== -1);

    const deliveries = rows.map((row, index) => {
      const delivery = {};
      headers.forEach((header, colIndex) => {
        delivery[header] = row[colIndex] || '';
      });

      // Calcular timestamp ISO desde FECHA y HORA
      const dateCell = dateIdx >= 0 ? row[dateIdx] : '';
      const timeCell = timeIdx >= 0 ? row[timeIdx] : '';
      const timestampISO = buildTimestampISO(dateCell, timeCell);

      delivery['TIMESTAMP'] = timestampISO; // Puede ser '' si no se pudo construir
      delivery['FECHA_STR'] = (dateCell instanceof Date)
        ? Utilities.formatDate(dateCell, 'Europe/Madrid', 'dd/MM/yyyy')
        : String(dateCell || '');
      delivery['HORA_STR'] = (timeCell instanceof Date)
        ? Utilities.formatDate(timeCell, 'Europe/Madrid', 'HH:mm:ss')
        : String(timeCell || '');

      delivery.rowIndex = index + 2;
      return delivery;
    });

    logToSheet('✅ Entregas obtenidas exitosamente', deliveries.length);

    return createJSONResponse({
      status: 'success',
      data: deliveries,
      message: `${deliveries.length} entregas obtenidas`,
      headers: headers,
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    logToSheet('❌ Error obteniendo entregas', error.toString());
    return createJSONResponse({
      status: 'error',
      message: 'Error obteniendo entregas: ' + error.toString()
    });
  }
}