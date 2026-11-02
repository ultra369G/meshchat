const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

class User {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.username = data.username;
    this.realName = data.real_name || data.realName;
    this.email = data.email;
    this.passwordHash = data.password_hash || data.passwordHash;
    this.avatarData = data.avatar_data || data.avatarData;
    this.avatarColor = data.avatar_color || data.avatarColor || '#4CAF50';
    this.publicKey = data.public_key || data.publicKey;
    this.privateKey = data.private_key || data.privateKey;
    this.createdAt = data.created_at || data.createdAt;
    this.lastSeen = data.last_seen || data.lastSeen;
    this.isOnline = data.is_online || data.isOnline || 0;
    this.currentIp = data.current_ip || data.currentIp;
    this.currentPort = data.current_port || data.currentPort;
  }

  static async create(userData) {
    const user = new User(userData);
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(userData.password, salt);
    
    await db.db.run(
      `INSERT INTO users (id, username, real_name, email, password_hash, avatar_data, avatar_color, public_key, private_key) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.username, user.realName, user.email, hash, user.avatarData, user.avatarColor, user.publicKey, user.privateKey]
    );
    return user;
  }

  static async findByUsername(username) {
    const data = await db.getUserByUsername(username);
    return data ? new User(data) : null;
  }

  static async findById(id) {
    const data = await db.getUserById(id);
    return data ? new User(data) : null;
  }

  static async findByEmail(email) {
    const data = await db.getUserByEmail(email);
    return data ? new User(data) : null;
  }

  async updateOnlineStatus(isOnline, ip = null, port = null) {
    await db.updateUserOnlineStatus(this.id, isOnline, ip, port);
    this.isOnline = isOnline;
    this.lastSeen = new Date();
    if (ip) this.currentIp = ip;
    if (port) this.currentPort = port;
  }

  async updateAvatar(avatarData, avatarColor) {
    await db.db.run(
      'UPDATE users SET avatar_data = ?, avatar_color = ? WHERE id = ?',
      [avatarData, avatarColor, this.id]
    );
    this.avatarData = avatarData;
    this.avatarColor = avatarColor;
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      realName: this.realName,
      email: this.email,
      avatarData: this.avatarData,
      avatarColor: this.avatarColor,
      isOnline: this.isOnline === 1,
      lastSeen: this.lastSeen
    };
  }
}

module.exports = User;
