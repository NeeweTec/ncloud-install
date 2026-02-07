/**
 * Gera hash SHA-256
 */
export declare function sha256(data: string): string;
/**
 * Gera hash SHA-512
 */
export declare function sha512(data: string): string;
/**
 * Gera bytes aleatórios
 */
export declare function generateRandomBytes(length: number): string;
/**
 * Gera um token seguro de N caracteres
 */
export declare function generateSecureToken(length?: number): string;
/**
 * Deriva uma chave a partir de uma senha
 */
export declare function deriveKey(password: string, salt: string): Buffer;
/**
 * Criptografa um texto
 */
export declare function encrypt(text: string, password: string): string;
/**
 * Descriptografa um texto
 */
export declare function decrypt(encryptedData: string, password: string): string;
/**
 * Compara strings de forma segura (timing-safe)
 */
export declare function secureCompare(a: string, b: string): boolean;
/**
 * Gera um hash de arquivo
 */
export declare function hashFile(filePath: string): Promise<string>;
//# sourceMappingURL=crypto.d.ts.map