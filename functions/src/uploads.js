/**
 * ✅ OTIMIZADO: Validação Server-side para uploads
 * Arquivo: functions/src/uploads.js
 * 
 * Para implementar no Firebase Functions:
 * 1. Instale as dependências:
 *    npm install --save express multer sharp file-type
 * 2. Configure o storage.rules adequadamente
 * 3. Deploy: firebase deploy --only functions:validateUpload
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sharp = require('sharp');
const fileType = require('file-type');

// Inicializar admin SDK
admin.initializeApp();

// Constantes de validação
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
];

// Função de validação principal
exports.validateUpload = functions.storage.object().onFinalize(async (object) => {
    const filePath = object.name;
    const bucket = admin.storage().bucket(object.bucket);
    const file = bucket.file(filePath);

    try {
        // 1. Verificar tamanho
        if (object.size > MAX_FILE_SIZE) {
            await file.delete();
            throw new Error(`Arquivo muito grande: ${object.size} bytes. Máximo permitido: ${MAX_FILE_SIZE} bytes`);
        }

        // 2. Download do arquivo para memória
        const [buffer] = await file.download();

        // 3. Verificar magic bytes
        const detectedType = await fileType.fromBuffer(buffer);
        if (!detectedType || !ALLOWED_MIME_TYPES.includes(detectedType.mime)) {
            await file.delete();
            throw new Error('Tipo de arquivo não permitido');
        }

        // 4. Verificar se é realmente uma imagem válida
        if (detectedType.mime !== 'image/svg+xml') {
            try {
                await sharp(buffer).metadata();
            } catch (err) {
                await file.delete();
                throw new Error('Arquivo corrompido ou inválido');
            }
        }

        // 5. Verificar por código malicioso em SVGs
        if (detectedType.mime === 'image/svg+xml') {
            const svgContent = buffer.toString('utf8');
            if (svgContent.includes('script') || 
                svgContent.includes('onload') || 
                svgContent.includes('onerror')) {
                await file.delete();
                throw new Error('SVG com conteúdo não permitido detectado');
            }
        }

        // 6. Otimizar imagem se necessário
        if (detectedType.mime !== 'image/svg+xml') {
            const optimized = await sharp(buffer)
                .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85, progressive: true })
                .toBuffer();

            // 7. Salvar versão otimizada
            await file.save(optimized, {
                metadata: {
                    contentType: 'image/jpeg',
                    metadata: {
                        optimized: true,
                        originalSize: object.size,
                        optimizedSize: optimized.length
                    }
                }
            });
        }

        // 8. Atualizar metadados
        await file.setMetadata({
            metadata: {
                validated: true,
                validatedAt: new Date().toISOString()
            }
        });

        // 9. Registrar log de sucesso
        await admin.firestore().collection('uploadLogs').add({
            status: 'success',
            filePath: filePath,
            size: object.size,
            mime: detectedType.mime,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

    } catch (error) {
        // 10. Registrar falha e notificar
        await admin.firestore().collection('uploadLogs').add({
            status: 'error',
            filePath: filePath,
            error: error.message,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});

// Trigger para limpar uploads antigos não validados
exports.cleanupInvalidUploads = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles();
    
    for (const file of files) {
        const [metadata] = await file.getMetadata();
        const created = new Date(metadata.timeCreated);
        const now = new Date();
        const age = now - created;
        
        // Remove arquivos não validados após 24h
        if (age > 24 * 60 * 60 * 1000 && (!metadata.metadata || !metadata.metadata.validated)) {
            await file.delete();
            
            await admin.firestore().collection('uploadLogs').add({
                status: 'cleaned',
                filePath: file.name,
                reason: 'not_validated_in_24h',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
});