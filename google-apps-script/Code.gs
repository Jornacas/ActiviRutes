/**
 * ActiviRutes - Google Apps Script para recibir datos de entregas
 * Este script recibe datos POST de la aplicación ActiviRutes y los guarda en Google Sheets
 */

/**
 * Función helper para crear respuestas JSON (Google Apps Script no soporta setHeaders)
 */
function createJSONResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Maneja las peticiones GET (info del API)
 */
function doGet(e) {
  return createJSONResponse({
    status: 'success',
    message: 'ActiviRutes API ready',
    timestamp: new Date().toISOString(),
    version: '2.1',
    note: 'CORS manejado automáticamente por Google Apps Script'
  });
}

function doPost(e) {
  try {
    console.log('📥 Recibiendo datos POST de ActiviRutes');
    console.log('📊 Contenido recibido:', e.postData.contents);
    
    // Parsear los datos JSON recibidos
    const data = JSON.parse(e.postData.contents);
    console.log('✅ Datos parseados correctamente:', data);
    
    // Procesar según la acción solicitada
    if (data.action === 'addDelivery') {
      return addDeliveryToSheet(data.data, data.images);
    }
    
    if (data.action === 'getDeliveries') {
      return getDeliveriesFromSheet(data.sheetName);
    }
    
    if (data.action === 'uploadImage') {
      return uploadImageToDrive(data.imageData, data.fileName, data.type);
    }
    
    // Acción no reconocida
    console.error('❌ Acción no válida:', data.action);
    return createJSONResponse({
      status: 'error', 
      message: 'Acción no válida: ' + data.action
    });
      
  } catch (error) {
    console.error('❌ Error procesando POST:', error.toString());
    return createJSONResponse({
      status: 'error', 
      message: 'Error procesando datos: ' + error.toString()
    });
  }
}

/**
 * Función para subir imágenes a Google Drive
 */
function uploadImageToDrive(base64Data, fileName, imageType) {
  try {
    console.log('📤 INICIANDO subida imagen a Google Drive:', fileName, imageType);
    console.log('📊 Tamaño datos base64:', base64Data ? base64Data.length : 'null');

    // Validar datos de entrada
    if (!base64Data) {
      throw new Error('Datos base64 vacíos o null');
    }

    if (!fileName) {
      throw new Error('Nombre de archivo vacío');
    }

    // Usar tu carpeta específica de Google Drive
    const FOLDER_ID = '1CubYYXeUuGBXY9pSbWr5DYkEKQZAIPxP';
    console.log('📂 Intentando acceder a carpeta ID:', FOLDER_ID);

    let folder;
    try {
      folder = DriveApp.getFolderById(FOLDER_ID);
      console.log('✅ Carpeta accesible:', folder.getName());
      console.log('📊 Archivos existentes en carpeta:', folder.getFiles().hasNext());
    } catch (folderError) {
      console.error('❌ ERROR CRÍTICO: No se pudo acceder a la carpeta:', FOLDER_ID);
      console.error('❌ Detalles error carpeta:', folderError.toString());
      throw new Error('Carpeta de destino no accesible: ' + folderError.toString());
    }
    
    // Convertir base64 a blob
    console.log('🔄 Procesando datos base64...');

    let base64Clean;
    if (base64Data.includes(',')) {
      base64Clean = base64Data.split(',')[1]; // Remover "data:image/...;base64,"
      console.log('✅ Header base64 removido');
    } else {
      base64Clean = base64Data;
      console.log('⚠️ Datos base64 sin header detectado');
    }

    console.log('📊 Tamaño base64 limpio:', base64Clean.length);

    try {
      const binaryData = Utilities.base64Decode(base64Clean);
      console.log('✅ Decodificación base64 exitosa');

      const blob = Utilities.newBlob(binaryData, 'image/jpeg', fileName);
      console.log('✅ Blob creado:', blob.getSize(), 'bytes');

      // Subir archivo a Drive
      console.log('📤 Creando archivo en Google Drive...');
      const file = folder.createFile(blob);
      console.log('✅ Archivo creado con ID:', file.getId());

      // Hacer el archivo público para visualización
      console.log('🔓 Configurando permisos públicos...');
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      console.log('✅ Permisos configurados');

      // Obtener URL pública
      const fileId = file.getId();
      const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;
      const directUrl = `https://drive.google.com/uc?id=${fileId}`; // URL directa para imágenes

      console.log('✅ Imagen subida exitosamente!');
      console.log('📂 URL vista:', fileUrl);
      console.log('📷 URL directa:', directUrl);

      return createJSONResponse({
        status: 'success',
        message: 'Imagen subida correctamente',
        fileId: fileId,
        fileUrl: fileUrl,
        directUrl: directUrl,
        fileName: fileName
      });

    } catch (conversionError) {
      console.error('❌ Error en conversión/subida:', conversionError.toString());
      throw new Error('Error procesando imagen: ' + conversionError.toString());
    }
    
  } catch (error) {
    console.error('❌ Error subiendo imagen:', error.toString());
    return createJSONResponse({
      status: 'error',
      message: 'Error subiendo imagen: ' + error.toString()
    });
  }
}

function addDeliveryToSheet(rowData, images) {
  try {
    // Configuración del Google Sheet
    const SHEET_ID = '1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I';
    const SHEET_NAME = 'ENTREGAS';
    
    console.log('📋 Abriendo Google Sheet ID:', SHEET_ID);
    console.log('📊 Datos a insertar:', rowData);
    console.log('📸 Imágenes recibidas:', images ? Object.keys(images) : 'ninguna');
    
    // Procesar imágenes si existen
    let signatureUrl = '';
    let photoUrl = '';
    
    if (images) {
      // Subir firma si existe
      if (images.signature) {
        console.log('📝 Procesando firma...');
        try {
          const signatureFileName = `firma_${Date.now()}.jpg`;
          const signatureResult = uploadImageToDrive(images.signature, signatureFileName, 'signature');
          const signatureData = JSON.parse(signatureResult.getContent());
          if (signatureData.status === 'success') {
            signatureUrl = signatureData.directUrl;
            console.log('✅ Firma subida:', signatureUrl);
          } else {
            console.error('❌ Error en respuesta firma:', signatureData.message);
          }
        } catch (signatureError) {
          console.error('❌ Error crítico subiendo firma:', signatureError.toString());
        }
      }
      
      // Subir foto si existe
      if (images.photo) {
        console.log('📸 Procesando foto...');
        try {
          const photoFileName = `foto_${Date.now()}.jpg`;
          const photoResult = uploadImageToDrive(images.photo, photoFileName, 'photo');
          const photoData = JSON.parse(photoResult.getContent());
          if (photoData.status === 'success') {
            photoUrl = photoData.directUrl;
            console.log('✅ Foto subida:', photoUrl);
          } else {
            console.error('❌ Error en respuesta foto:', photoData.message);
          }
        } catch (photoError) {
          console.error('❌ Error crítico subiendo foto:', photoError.toString());
        }
      }
    }
    
    // Abrir el spreadsheet y la hoja específica
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`No se encontró la hoja "${SHEET_NAME}" en el spreadsheet`);
    }
    
    console.log('✅ Hoja encontrada:', SHEET_NAME);
    
    // Actualizar rowData con URLs de imágenes
    // Estructura: FECHA | HORA | RUTA_ID | ESCUELA | DIRECCION | ACTIVIDADES | RECEPTOR | NOTAS | TIENE_FIRMA | TIENE_FOTO | LINK_INFORME | URL_FIRMA | URL_FOTO
    const updatedRowData = [
      ...rowData.slice(0, 11), // Datos originales hasta LINK_INFORME
      signatureUrl, // URL_FIRMA
      photoUrl     // URL_FOTO
    ];
    
    // Verificar headers y actualizar si es necesario
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    console.log('📋 Headers actuales:', headers);
    
    // Si no existen las columnas de URLs, añadirlas
    if (headers.length < 13) {
      const newHeaders = [
        'FECHA', 'HORA', 'RUTA_ID', 'ESCUELA', 'DIRECCION', 'ACTIVIDADES', 
        'RECEPTOR', 'NOTAS', 'TIENE_FIRMA', 'TIENE_FOTO', 'LINK_INFORME', 
        'URL_FIRMA', 'URL_FOTO'
      ];
      sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
      console.log('📋 Headers actualizados con URLs de imágenes');
    }
    
    // Insertar los datos como nueva fila
    sheet.appendRow(updatedRowData);
    
    const timestamp = new Date().toISOString();
    console.log('✅ Datos insertados exitosamente en', timestamp);
    
    // Respuesta de éxito
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Datos agregados correctamente a la hoja ENTREGAS',
        timestamp: timestamp,
        rowData: updatedRowData,
        sheetName: SHEET_NAME,
        signatureUrl: signatureUrl,
        photoUrl: photoUrl
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
 * Función de prueba para Google Drive upload
 */
function testGoogleDriveUpload() {
  console.log('🧪 Iniciando prueba de subida a Google Drive...');

  // Crear una imagen de prueba pequeña (1x1 pixel PNG en base64)
  const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const testFileName = `prueba_${Date.now()}.png`;

  try {
    console.log('📤 Subiendo imagen de prueba:', testFileName);

    const result = uploadImageToDrive(testImageBase64, testFileName, 'test');
    const resultData = JSON.parse(result.getContent());

    console.log('📥 Resultado:', resultData);

    if (resultData.status === 'success') {
      console.log('✅ ÉXITO: Imagen subida correctamente');
      console.log('📂 URL vista:', resultData.fileUrl);
      console.log('📷 URL directa:', resultData.directUrl);

      // Verificar que el archivo existe en Drive
      try {
        const file = DriveApp.getFileById(resultData.fileId);
        console.log('✅ Archivo verificado en Drive:', file.getName(), file.getSize(), 'bytes');

        // Eliminar archivo de prueba
        file.setTrashed(true);
        console.log('🗑️ Archivo de prueba eliminado');

        return {
          success: true,
          message: 'Prueba de Google Drive completada exitosamente',
          fileUrl: resultData.fileUrl,
          directUrl: resultData.directUrl
        };
      } catch (verifyError) {
        console.error('❌ Error verificando archivo:', verifyError.toString());
        return {
          success: false,
          message: 'Error verificando archivo: ' + verifyError.toString()
        };
      }
    } else {
      console.error('❌ Error en upload:', resultData.message);
      return {
        success: false,
        message: resultData.message
      };
    }

  } catch (error) {
    console.error('❌ Error en prueba:', error.toString());
    return {
      success: false,
      message: error.toString()
    };
  }
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
      return createJSONResponse({
        status: 'error',
        message: 'Hoja no encontrada: ' + sheetName
      });
    }
    
    // Obtener todos los datos de la hoja
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      // Solo hay header o está vacía
      console.log('ℹ️ No hay entregas en la hoja');
      return createJSONResponse({
        status: 'success',
        data: [],
        message: 'No hay entregas registradas'
      });
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
    
    return createJSONResponse({
      status: 'success',
      data: deliveries,
      message: `${deliveries.length} entregas obtenidas`,
      headers: headers,
      lastUpdate: new Date().toISOString()
    });
      
  } catch (error) {
    console.error('❌ Error obteniendo entregas:', error.toString());
    return createJSONResponse({
      status: 'error',
      message: 'Error obteniendo entregas: ' + error.toString()
    });
  }
}