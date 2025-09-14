/**
 * ActiviRutes - Google Apps Script para recibir datos de entregas
 * Este script recibe datos POST de la aplicación ActiviRutes y los guarda en Google Sheets
 */

function doPost(e) {
  try {
    console.log('📥 Recibiendo datos POST de ActiviRutes');
    console.log('📊 Contenido recibido:', e.postData.contents);
    
    // Parsear los datos JSON recibidos
    const data = JSON.parse(e.postData.contents);
    console.log('✅ Datos parseados correctamente:', data);
    
    // Procesar según la acción solicitada
    if (data.action === 'addDelivery') {
      return addDeliveryToSheet(data.data);
    }
    
    if (data.action === 'getDeliveries') {
      return getDeliveriesFromSheet(data.sheetName);
    }
    
    // Acción no reconocida
    console.error('❌ Acción no válida:', data.action);
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error', 
        message: 'Acción no válida: ' + data.action
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('❌ Error procesando POST:', error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error', 
        message: 'Error procesando datos: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function addDeliveryToSheet(rowData) {
  try {
    // Configuración del Google Sheet
    const SHEET_ID = '1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I';
    const SHEET_NAME = 'ENTREGAS';
    
    console.log('📋 Abriendo Google Sheet ID:', SHEET_ID);
    console.log('📊 Datos a insertar:', rowData);
    
    // Abrir el spreadsheet y la hoja específica
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`No se encontró la hoja "${SHEET_NAME}" en el spreadsheet`);
    }
    
    console.log('✅ Hoja encontrada:', SHEET_NAME);
    
    // Verificar headers (opcional - para debug)
    const headers = sheet.getRange(1, 1, 1, 10).getValues()[0];
    console.log('📋 Headers actuales:', headers);
    
    // Insertar los datos como nueva fila
    // Los datos vienen en el orden correcto:
    // FECHA | HORA | RUTA_ID | ESCUELA | DIRECCION | ACTIVIDADES | RECEPTOR | NOTAS | TIENE_FIRMA | TIENE_FOTO
    sheet.appendRow(rowData);
    
    const timestamp = new Date().toISOString();
    console.log('✅ Datos insertados exitosamente en', timestamp);
    
    // Respuesta de éxito
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Datos agregados correctamente a la hoja ENTREGAS',
        timestamp: timestamp,
        rowData: rowData,
        sheetName: SHEET_NAME
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('❌ Error insertando datos:', error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Error insertando datos: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Función de prueba - puedes ejecutarla manualmente desde el editor
 */
function testAddDelivery() {
  console.log('🧪 Ejecutando prueba manual...');
  
  const testData = [
    new Date().toLocaleDateString('es-ES'),  // FECHA
    new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), // HORA
    'test-route-' + Date.now(),              // RUTA_ID
    'Escola de Prueba Manual',               // ESCUELA
    'Carrer de Prueba, 123, Barcelona',     // DIRECCION
    'Material TC, Material CO',             // ACTIVIDADES
    'Receptor de Prueba Manual',            // RECEPTOR
    'Prueba ejecutada manualmente desde Google Apps Script', // NOTAS
    'SÍ',                                   // TIENE_FIRMA
    'SÍ'                                    // TIENE_FOTO
  ];
  
  console.log('📊 Datos de prueba:', testData);
  
  const result = addDeliveryToSheet(testData);
  const resultText = result.getContent();
  const resultData = JSON.parse(resultText);
  
  console.log('📊 Resultado de la prueba:', resultData);
  
  if (resultData.status === 'success') {
    console.log('✅ Prueba exitosa! Revisa tu hoja ENTREGAS');
  } else {
    console.log('❌ Error en la prueba:', resultData.message);
  }
  
  return resultData;
}

/**
 * Función para obtener información del spreadsheet (debug)
 */
function getSheetInfo() {
  const SHEET_ID = '1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I';
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheets = spreadsheet.getSheets();
    
    console.log('📊 Información del Spreadsheet:');
    console.log('📋 Nombre:', spreadsheet.getName());
    console.log('📊 Hojas disponibles:', sheets.map(s => s.getName()));
    
    const entregasSheet = spreadsheet.getSheetByName('ENTREGAS');
    if (entregasSheet) {
      const headers = entregasSheet.getRange(1, 1, 1, 10).getValues()[0];
      const rowCount = entregasSheet.getLastRow();
      console.log('📋 Headers ENTREGAS:', headers);
      console.log('📊 Total de filas:', rowCount);
    }
    
    return {
      name: spreadsheet.getName(),
      sheets: sheets.map(s => s.getName()),
      entregas: entregasSheet ? {
        headers: entregasSheet.getRange(1, 1, 1, 10).getValues()[0],
        rowCount: entregasSheet.getLastRow()
      } : null
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo info:', error.toString());
    return { error: error.toString() };
  }
}

/**
 * Obtiene todas las entregas de la hoja especificada
 */
function getDeliveriesFromSheet(sheetName = 'Entregas') {
  try {
    const SHEET_ID = '1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I';
    
    console.log('📊 Obteniendo entregas de la hoja:', sheetName);
    
    // Abrir el spreadsheet y la hoja específica
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      console.error('❌ Hoja no encontrada:', sheetName);
      return ContentService
        .createTextOutput(JSON.stringify({
          status: 'error',
          message: 'Hoja no encontrada: ' + sheetName
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Obtener todos los datos de la hoja
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      // Solo hay header o está vacía
      console.log('ℹ️ No hay entregas en la hoja');
      return ContentService
        .createTextOutput(JSON.stringify({
          status: 'success',
          data: [],
          message: 'No hay entregas registradas'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Obtener encabezados (primera fila)
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    console.log('📋 Encabezados encontrados:', headers);
    
    // Obtener todos los datos (excluyendo header)
    const dataRange = sheet.getRange(2, 1, lastRow - 1, headers.length);
    const rows = dataRange.getValues();
    
    // Convertir a objetos estructurados
    const deliveries = rows.map((row, index) => {
      const delivery = {};
      headers.forEach((header, colIndex) => {
        delivery[header] = row[colIndex] || '';
      });
      delivery.rowIndex = index + 2; // +2 porque empezamos en fila 2 y los índices son 1-based
      return delivery;
    });
    
    console.log(`✅ ${deliveries.length} entregas obtenidas exitosamente`);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        data: deliveries,
        message: `${deliveries.length} entregas obtenidas`,
        headers: headers,
        lastUpdate: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('❌ Error obteniendo entregas:', error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Error obteniendo entregas: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}