/**
 * ARCHIVO DE PRUEBA - Google Drive Upload Test
 * Ejecutar esta función manualmente desde el editor de Google Apps Script
 */

function testCompleteFlow() {
  console.log('🧪 INICIANDO PRUEBA COMPLETA DE GOOGLE DRIVE');
  
  try {
    // 1. Probar función de logging
    logToSheet('🧪 INICIO PRUEBA COMPLETA', new Date().toISOString());
    
    // 2. Crear imágenes de prueba (pixel transparente en base64)
    const testPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    const testSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAFfcCIRxwAAAABJRU5ErkJggg==';
    
    // 3. Probar subida individual de foto
    console.log('📸 Probando subida de foto...');
    const photoResult = uploadImageToDrive(
      testPhoto,
      `test_foto_${Date.now()}.png`,
      '1CubYYXeUuGBXY9pSbWr5DYkEKQZAIPxP'
    );
    
    if (!photoResult) {
      throw new Error('❌ Error subiendo foto de prueba');
    }
    
    console.log('✅ Foto subida exitosamente:', photoResult);
    
    // 4. Probar subida individual de firma
    console.log('✍️ Probando subida de firma...');
    const signatureResult = uploadImageToDrive(
      testSignature,
      `test_firma_${Date.now()}.png`,
      '1CubYYXeUuGBXY9pSbWr5DYkEKQZAIPxP'
    );
    
    if (!signatureResult) {
      throw new Error('❌ Error subiendo firma de prueba');
    }
    
    console.log('✅ Firma subida exitosamente:', signatureResult);
    
    // 5. Probar flujo completo de entrega
    console.log('📦 Probando flujo completo de entrega...');
    
    const testRowData = [
      new Date().toLocaleDateString('es-ES'),
      new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      'test-route-' + Date.now(),
      'Escola de Prueba ActiviRutes',
      'Carrer de Prueba, 123, Barcelona',
      'Material TC, Material CO',
      'Receptor de Prueba',
      'Prueba completa del sistema',
      'SÍ',
      'SÍ',
      `https://activi-rutes.vercel.app/informe/test_${Date.now()}`
    ];
    
    const testImages = {
      photo: testPhoto,
      signature: testSignature
    };
    
    const deliveryResult = addDeliveryToSheet(testRowData, testImages);
    console.log('📊 Resultado entrega completa:', deliveryResult);
    
    // 6. Verificar acceso a carpeta
    const folder = DriveApp.getFolderById('1CubYYXeUuGBXY9pSbWr5DYkEKQZAIPxP');
    const files = folder.getFiles();
    let fileCount = 0;
    while (files.hasNext()) {
      files.next();
      fileCount++;
    }
    
    console.log(`📁 Archivos totales en carpeta Google Drive: ${fileCount}`);
    
    logToSheet('✅ PRUEBA COMPLETA EXITOSA', {
      photoUploaded: !!photoResult,
      signatureUploaded: !!signatureResult,
      totalFilesInFolder: fileCount,
      photoUrl: photoResult?.directUrl,
      signatureUrl: signatureResult?.directUrl
    });
    
    return {
      success: true,
      message: 'Prueba completa exitosa',
      photoUrl: photoResult.directUrl,
      signatureUrl: signatureResult.directUrl,
      filesInFolder: fileCount
    };
    
  } catch (error) {
    console.error('❌ ERROR EN PRUEBA COMPLETA:', error);
    logToSheet('❌ ERROR PRUEBA COMPLETA', {
      error: error.toString(),
      stack: error.stack
    });
    
    return {
      success: false,
      error: error.toString()
    };
  }
}

function quickDriveTest() {
  console.log('🚀 PRUEBA RÁPIDA GOOGLE DRIVE');
  
  try {
    // Verificar acceso a la carpeta
    const folder = DriveApp.getFolderById('1CubYYXeUuGBXY9pSbWr5DYkEKQZAIPxP');
    console.log('✅ Acceso a carpeta OK:', folder.getName());
    
    // Crear archivo de prueba simple
    const testBlob = Utilities.newBlob('Prueba ActiviRutes ' + new Date().toISOString(), 'text/plain', 'test.txt');
    const file = folder.createFile(testBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    console.log('✅ Archivo creado:', file.getId());
    console.log('🔗 URL:', `https://drive.google.com/file/d/${file.getId()}/view`);
    
    return `Prueba exitosa. Archivo creado: ${file.getId()}`;
    
  } catch (error) {
    console.error('❌ Error en prueba rápida:', error);
    return `Error: ${error.toString()}`;
  }
}