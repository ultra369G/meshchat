const crypto = require('crypto');
const NodeRSA = require('node-rsa');

class Encryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key-change-this-32-chars!', 'salt', 32);
  }

  generateKeyPair() {
    const key = new NodeRSA({ b: 2048 });
    return {
      publicKey: key.exportKey('public'),
      privateKey: key.exportKey('private')
    };
  }

  encrypt(text) {
    // Ensure text is string
    let stringToEncrypt = text;
    if (typeof text !== 'string') {
      stringToEncrypt = JSON.stringify(text);
    }
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(stringToEncrypt, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('hex'),
      content: encrypted,
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData) {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  }

  hash(data) {
    return crypto.createHash('sha256').update(String(data)).digest('hex');
  }

  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }
}

module.exports = new Encryption();
