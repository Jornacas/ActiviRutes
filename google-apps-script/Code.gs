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

    if (data.action === 'addDelivery') {
      return addDeliveryToSheet(data.data, data.images);
    }

    if (data.action === 'getDeliveries') {
      return getDeliveriesFromSheet(data.sheetName);
    }

    if (data.action === 'makeImagesPublic') {
      return createJSONResponse(makeExistingImagesPublic());
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