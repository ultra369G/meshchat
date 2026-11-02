const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class Message {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.senderId = data.sender_id || data.senderId;
    this.receiverId = data.receiver_id || data.receiverId;
    this.content = data.content;
    this.filePath = data.file_path || data.filePath;
    this.fileType = data.file_type || data.fileType;
    this.encryptedContent = data.encrypted_content || data.encryptedContent;
    this.isRead = data.is_read || data.isRead || 0;
    this.isDelivered = data.is_delivered || data.isDelivered || 0;
    this.createdAt = data.created_at || data.createdAt || new Date();
    this.expiresAt = data.expires_at || data.expiresAt;
  }

  static async create(messageData) {
    const message = new Message(messageData);
    const expiresAt = new Date(Date.now() + parseInt(process.env.MESSAGE_EXPIRY)).toISOString();
    
    await db.saveMessage({
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content,
      filePath: message.filePath,
      fileType: message.fileType,
      encryptedContent: message.encryptedContent,
      expiresAt
    });
    return message;
  }

  static async findByReceiver(receiverId) {
    const messages = await db.getUnreadMessages(receiverId);
    return messages.map(m => new Message(m));
  }

  async markAsRead() {
    await db.markMessageAsRead(this.id);
    this.isRead = 1;
  }

  async markAsDelivered() {
    await db.markMessageAsDelivered(this.id);
    this.isDelivered = 1;
  }

  toJSON() {
    return {
      id: this.id,
      senderId: this.senderId,
      receiverId: this.receiverId,
      content: this.content,
      filePath: this.filePath,
      fileType: this.fileType,
      isRead: this.isRead === 1,
      isDelivered: this.isDelivered === 1,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt
    };
  }
}

module.exports = Message;
