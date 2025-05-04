import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

class EncryptionService {
  private algorithm: string;
  private key: Buffer;
  private iv: Buffer;

  constructor() {
    this.algorithm = 'aes-256-cbc';
    // Use environment variable for the encryption key or generate a secure one
    const secretKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    this.key = Buffer.from(secretKey, 'hex');
    this.iv = crypto.randomBytes(16);
  }

  // Encrypt sensitive data
  encrypt(text: string): { encryptedData: string; iv: string } {
    const cipher = crypto.createCipheriv(this.algorithm, this.key, this.iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return {
      encryptedData: encrypted,
      iv: this.iv.toString('hex')
    };
  }

  // Decrypt sensitive data
  decrypt(encryptedData: string, iv: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex')
    );
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Encrypt specific fields in an object
  encryptFields(data: any, sensitiveFields: string[]): any {
    const encryptedData = { ...data };

    for (const field of sensitiveFields) {
      if (data[field]) {
        const { encryptedData: encrypted, iv } = this.encrypt(
          typeof data[field] === 'string' ? data[field] : JSON.stringify(data[field])
        );
        encryptedData[field] = {
          data: encrypted,
          iv,
          isEncrypted: true
        };
      }
    }

    return encryptedData;
  }

  // Decrypt specific fields in an object
  decryptFields(data: any): any {
    const decryptedData = { ...data };

    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && (value as any).isEncrypted) {
        const { data: encrypted, iv } = value as { data: string; iv: string };
        try {
          const decrypted = this.decrypt(encrypted, iv);
          decryptedData[key] = JSON.parse(decrypted);
        } catch {
          // If JSON.parse fails, it means the decrypted value was a string
          decryptedData[key] = this.decrypt(encrypted, iv);
        }
      }
    }

    return decryptedData;
  }
}

export default new EncryptionService(); 