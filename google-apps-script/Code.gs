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
    
    // Hacer el archivo público para lectura
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
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

    const deliveries = rows.map((row, index) => {
      const delivery = {};
      headers.forEach((header, colIndex) => {
        delivery[header] = row[colIndex] || '';
      });
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