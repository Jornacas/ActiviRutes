/**
 * ActiviRutes - Google Apps Script para recibir datos de entregas
 * VERSION CON LOGGING A SHEETS
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

function doGet(e) {
  logToSheet('🚨 doGet ejecutado');

  return createJSONResponse({
    status: 'success',
    message: 'ActiviRutes API ready - WITH SHEET LOGGING',
    timestamp: new Date().toISOString(),
    version: '2.2'
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

    // Diagnóstico detallado de imágenes
    if (images) {
      Object.keys(images).forEach(key => {
        const image = images[key];
        if (image) {
          logToSheet(`🔍 ${key} imagen`, {
            length: image.length,
            starts_with: image.substring(0, 50),
            has_base64_header: image.includes('data:image'),
            type: typeof image
          });
        } else {
          logToSheet(`❌ ${key}`, 'vacía o null');
        }
      });
    }

    const SHEET_ID = '1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I';
    const SHEET_NAME = 'ENTREGAS';

    // Por ahora solo guardamos en Sheets SIN imágenes para testing
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error(`No se encontró la hoja "${SHEET_NAME}"`);
    }

    logToSheet('🚨 Insertando en Sheets');
    sheet.appendRow(rowData);

    const timestamp = new Date().toISOString();
    logToSheet('🚨 ÉXITO - Datos insertados', timestamp);

    return createJSONResponse({
      status: 'success',
      message: 'Datos agregados correctamente',
      timestamp: timestamp,
      rowData: rowData,
      imagesReceived: images ? Object.keys(images) : []
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