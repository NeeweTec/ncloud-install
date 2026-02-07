"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = sha256;
exports.sha512 = sha512;
exports.generateRandomBytes = generateRandomBytes;
exports.generateSecureToken = generateSecureToken;
exports.deriveKey = deriveKey;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.secureCompare = secureCompare;
exports.hashFile = hashFile;
exports.generateEntityId = generateEntityId;
exports.generateEnvironmentId = generateEnvironmentId;
exports.generateServiceId = generateServiceId;
exports.generateInstanceId = generateInstanceId;
exports.isValidEntityId = isValidEntityId;
exports.generateUUID = generateUUID;
const node_crypto_1 = require("node:crypto");
const ALGORITHM = 'aes-256-gcm';
const ENCODING = 'hex';
/**
 * Gera hash SHA-256
 */
function sha256(data) {
    return (0, node_crypto_1.createHash)('sha256').update(data).digest('hex');
}
/**
 * Gera hash SHA-512
 */
function sha512(data) {
    return (0, node_crypto_1.createHash)('sha512').update(data).digest('hex');
}
/**
 * Gera bytes aleatórios
 */
function generateRandomBytes(length) {
    return (0, node_crypto_1.randomBytes)(length).toString('hex');
}
/**
 * Gera um token seguro de N caracteres
 */
function generateSecureToken(length = 64) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = (0, node_crypto_1.randomBytes)(length);
    let token = '';
    for (let i = 0; i < length; i++) {
        token += chars[bytes[i] % chars.length];
    }
    return token;
}
/**
 * Deriva uma chave a partir de uma senha
 */
function deriveKey(password, salt) {
    return (0, node_crypto_1.scryptSync)(password, salt, 32);
}
/**
 * Criptografa um texto
 */
function encrypt(text, password) {
    const salt = (0, node_crypto_1.randomBytes)(16);
    const key = deriveKey(password, salt.toString('hex'));
    const iv = (0, node_crypto_1.randomBytes)(12);
    const cipher = (0, node_crypto_1.createCipheriv)(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', ENCODING);
    encrypted += cipher.final(ENCODING);
    const authTag = cipher.getAuthTag();
    // Formato: salt:iv:authTag:encrypted
    return `${salt.toString(ENCODING)}:${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted}`;
}
/**
 * Descriptografa um texto
 */
function decrypt(encryptedData, password) {
    const parts = encryptedData.split(':');
    if (parts.length !== 4) {
        throw new Error('Formato de dados criptografados inválido');
    }
    const [saltHex, ivHex, authTagHex, encrypted] = parts;
    const salt = Buffer.from(saltHex, ENCODING);
    const iv = Buffer.from(ivHex, ENCODING);
    const authTag = Buffer.from(authTagHex, ENCODING);
    const key = deriveKey(password, salt.toString('hex'));
    const decipher = (0, node_crypto_1.createDecipheriv)(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
/**
 * Compara strings de forma segura (timing-safe)
 */
function secureCompare(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    let result = 0;
    for (let i = 0; i < bufA.length; i++) {
        result |= bufA[i] ^ bufB[i];
    }
    return result === 0;
}
/**
 * Gera um hash de arquivo
 */
async function hashFile(filePath) {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(filePath);
    return (0, node_crypto_1.createHash)('sha256').update(content).digest('hex');
}
// ============================================
// GERAÇÃO DE IDs ÚNICOS
// ============================================
/**
 * Gera um ID único e consistente baseado em características da entidade.
 * O mesmo input sempre gera o mesmo output (determinístico).
 * Formato: prefixo_hash12chars
 *
 * @param prefix - Prefixo do ID (ex: 'env', 'svc', 'inst')
 * @param ...parts - Partes que compõem a identidade única
 */
function generateEntityId(prefix, ...parts) {
    const normalizedParts = parts
        .filter(p => p !== undefined && p !== null && p !== '')
        .map(p => String(p).toLowerCase().trim());
    if (normalizedParts.length === 0) {
        // Fallback: gera ID aleatório se não houver partes
        return `${prefix}_${(0, node_crypto_1.randomBytes)(6).toString('hex')}`;
    }
    const combined = normalizedParts.join('|');
    const hash = (0, node_crypto_1.createHash)('sha256').update(combined).digest('hex').substring(0, 12);
    return `${prefix}_${hash}`;
}
/**
 * Gera ID único para um ambiente Protheus.
 * Usa UUID v4 para compatibilidade com o daemon Linux.
 * O UUID é determinístico baseado em: caminho do INI + seção do ambiente
 */
function generateEnvironmentId(iniPath, sectionName) {
    // Normaliza o caminho para consistência entre plataformas
    const normalizedPath = iniPath.replace(/\\/g, '/').toLowerCase();
    const combined = [normalizedPath, sectionName.toLowerCase()].join('|');
    // Gera um UUID v5-like determinístico baseado no hash
    const hash = (0, node_crypto_1.createHash)('sha256').update(combined).digest('hex');
    // Formata como UUID v4 (8-4-4-4-12)
    return [
        hash.substring(0, 8),
        hash.substring(8, 12),
        '4' + hash.substring(13, 16), // Versão 4
        ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20), // Variant
        hash.substring(20, 32)
    ].join('-');
}
/**
 * Gera ID único para um serviço Protheus.
 * Usa UUID v4 para compatibilidade com o daemon Linux.
 * O UUID é determinístico baseado em: caminho do binário + caminho do config + porta
 */
function generateServiceId(binaryPath, configPath, port) {
    const normalizedBinary = binaryPath.replace(/\\/g, '/').toLowerCase();
    const normalizedConfig = configPath.replace(/\\/g, '/').toLowerCase();
    const combined = [normalizedBinary, normalizedConfig, port].filter(Boolean).join('|');
    // Gera um UUID v5-like determinístico baseado no hash
    const hash = (0, node_crypto_1.createHash)('sha256').update(combined).digest('hex');
    // Formata como UUID v4 (8-4-4-4-12)
    return [
        hash.substring(0, 8),
        hash.substring(8, 12),
        '4' + hash.substring(13, 16), // Versão 4
        ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20), // Variant
        hash.substring(20, 32)
    ].join('-');
}
/**
 * Gera ID único para uma instância.
 * Usa UUID v4 para compatibilidade com o daemon Linux.
 * O UUID é determinístico baseado em: nome + tipo
 */
function generateInstanceId(name, type) {
    const combined = [name.toLowerCase(), type.toLowerCase()].join('|');
    // Gera um UUID v5-like determinístico baseado no hash
    const hash = (0, node_crypto_1.createHash)('sha256').update(combined).digest('hex');
    // Formata como UUID v4 (8-4-4-4-12)
    return [
        hash.substring(0, 8),
        hash.substring(8, 12),
        '4' + hash.substring(13, 16), // Versão 4
        ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20), // Variant
        hash.substring(20, 32)
    ].join('-');
}
/**
 * Valida se um ID está no formato esperado (UUID ou legacy hash)
 */
function isValidEntityId(id, prefix) {
    // Formato UUID v4
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(id))
        return true;
    // Formato legacy (prefixo_hash)
    const legacyPattern = prefix
        ? new RegExp(`^${prefix}_[a-f0-9]{12}$`)
        : /^[a-z]+_[a-f0-9]{12}$/;
    return legacyPattern.test(id);
}
/**
 * Gera UUID v4 aleatório (não determinístico)
 */
function generateUUID() {
    const bytes = (0, node_crypto_1.randomBytes)(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Versão 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant
    const hex = bytes.toString('hex');
    return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        hex.substring(12, 16),
        hex.substring(16, 20),
        hex.substring(20, 32)
    ].join('-');
}
//# sourceMappingURL=crypto.js.map