const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../../../database/meshchat.db');
  }

  async initialize() {
    // Ensure database directory exists with proper permissions
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true, mode: 0o755 });
    }

    // Ensure database file exists with proper permissions
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, '', { mode: 0o666 });
    }

    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });

    // Enable foreign keys and WAL mode for better concurrency
    await this.db.exec('PRAGMA foreign_keys = ON');
    await this.db.exec('PRAGMA journal_mode = WAL');
    await this.db.exec('PRAGMA synchronous = NORMAL');

    // Create tables
    await this.createTables();
    
    return this.db;
  }

  async createTables() {
    // Users table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        real_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_data TEXT,
        avatar_color TEXT DEFAULT '#4CAF50',
        public_key TEXT,
        private_key TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME,
        is_online INTEGER DEFAULT 0,
        current_ip TEXT,
        current_port INTEGER
      )
    `);

    // Messages table (private messages)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        content TEXT,
        type TEXT DEFAULT 'text',
        file_path TEXT,
        file_type TEXT,
        encrypted_content TEXT,
        is_read INTEGER DEFAULT 0,
        is_delivered INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Groups table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        avatar_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Group members table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS group_members (
        group_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id),
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Group messages table - UPDATED with type column
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS group_messages (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT,
        type TEXT DEFAULT 'text',
        file_path TEXT,
        file_type TEXT,
        encrypted_content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Network hosts table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS network_hosts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        host_ip TEXT NOT NULL,
        host_port INTEGER NOT NULL,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Call logs table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS call_logs (
        id TEXT PRIMARY KEY,
        caller_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        call_type TEXT DEFAULT 'audio',
        duration INTEGER DEFAULT 0,
        status TEXT DEFAULT 'missed',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_online ON users(is_online);
      CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);
      CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, is_read);
      CREATE INDEX IF NOT EXISTS idx_messages_expires ON messages(expires_at);
      CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id);
      CREATE INDEX IF NOT EXISTS idx_group_messages_created ON group_messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_network_hosts_last_seen ON network_hosts(last_seen);
      CREATE INDEX IF NOT EXISTS idx_call_logs_users ON call_logs(caller_id, receiver_id);
      CREATE INDEX IF NOT EXISTS idx_call_logs_started ON call_logs(started_at);
    `);
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }

  // ==================== USER METHODS ====================
  
  async createUser(userData) {
    const { id, username, realName, email, passwordHash, avatarData, avatarColor, publicKey, privateKey } = userData;
    await this.db.run(
      `INSERT INTO users (id, username, real_name, email, password_hash, avatar_data, avatar_color, public_key, private_key) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username, realName, email, passwordHash, avatarData || null, avatarColor, publicKey, privateKey]
    );
    return this.getUserById(id);
  }

  async getUserById(id) {
    return await this.db.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  async getUserByUsername(username) {
    return await this.db.get('SELECT * FROM users WHERE username = ?', [username]);
  }

  async getUserByEmail(email) {
    return await this.db.get('SELECT * FROM users WHERE email = ?', [email]);
  }

  async updateUserOnlineStatus(userId, isOnline, ip = null, port = null) {
    await this.db.run(
      `UPDATE users SET is_online = ?, last_seen = CURRENT_TIMESTAMP, current_ip = ?, current_port = ? 
       WHERE id = ?`,
      [isOnline ? 1 : 0, ip, port, userId]
    );
  }

  async getOnlineUsers() {
    return await this.db.all(
      'SELECT id, username, real_name, avatar_data, avatar_color, is_online FROM users WHERE is_online = 1'
    );
  }

  async updateUserProfile(userId, updates) {
    const fields = [];
    const values = [];
    
    if (updates.username) {
      fields.push('username = ?');
      values.push(updates.username);
    }
    if (updates.realName) {
      fields.push('real_name = ?');
      values.push(updates.realName);
    }
    if (updates.avatarData !== undefined) {
      fields.push('avatar_data = ?');
      values.push(updates.avatarData);
    }
    if (updates.avatarColor) {
      fields.push('avatar_color = ?');
      values.push(updates.avatarColor);
    }
    
    if (fields.length === 0) return null;
    
    values.push(userId);
    await this.db.run(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    return this.getUserById(userId);
  }

  // ==================== PRIVATE MESSAGE METHODS ====================
  
  async saveMessage(messageData) {
    const { id, senderId, receiverId, content, type, filePath, fileType, encryptedContent, expiresAt } = messageData;
    await this.db.run(
      `INSERT INTO messages (id, sender_id, receiver_id, content, type, file_path, file_type, encrypted_content, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, senderId, receiverId, content, type || 'text', filePath, fileType, encryptedContent, expiresAt]
    );
    return this.getMessageById(id);
  }

  async getMessageById(id) {
    return await this.db.get('SELECT * FROM messages WHERE id = ?', [id]);
  }

  async getUnreadMessages(userId) {
    return await this.db.all(
      `SELECT m.*, u.username as sender_username, u.avatar_data as sender_avatar 
       FROM messages m 
       JOIN users u ON m.sender_id = u.id 
       WHERE m.receiver_id = ? AND m.is_read = 0 AND datetime(m.expires_at) > datetime("now")
       ORDER BY m.created_at ASC`,
      [userId]
    );
  }

  async getConversationMessages(userId1, userId2, limit = 50) {
    return await this.db.all(
      `SELECT m.*, u.username as sender_username, u.avatar_data as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [userId1, userId2, userId2, userId1, limit]
    );
  }

  async markMessageAsRead(messageId) {
    await this.db.run('UPDATE messages SET is_read = 1 WHERE id = ?', [messageId]);
  }

  async markMessageAsDelivered(messageId) {
    await this.db.run('UPDATE messages SET is_delivered = 1 WHERE id = ?', [messageId]);
  }

  async deleteExpiredMessages() {
    await this.db.run('DELETE FROM messages WHERE datetime(expires_at) <= datetime("now")');
    await this.db.run('DELETE FROM group_messages WHERE datetime(expires_at) <= datetime("now")');
  }

  // ==================== GROUP METHODS ====================
  
  async createGroup(groupData) {
    const { id, name, creatorId, avatarData } = groupData;
    await this.db.run(
      'INSERT INTO groups (id, name, creator_id, avatar_data) VALUES (?, ?, ?, ?)',
      [id, name, creatorId, avatarData]
    );
    await this.addUserToGroup(id, creatorId);
    return this.getGroupById(id);
  }

  async getGroupById(id) {
    const group = await this.db.get('SELECT * FROM groups WHERE id = ?', [id]);
    if (group) {
      const memberCount = await this.db.get(
        'SELECT COUNT(*) as count FROM group_members WHERE group_id = ?',
        [id]
      );
      group.member_count = memberCount.count;
    }
    return group;
  }

  async getUserGroups(userId) {
    return await this.db.all(
      `SELECT g.*, 
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
        (SELECT created_at FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_activity
       FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = ?
       ORDER BY last_activity DESC`,
      [userId]
    );
  }

  async addUserToGroup(groupId, userId) {
    await this.db.run(
      'INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)',
      [groupId, userId]
    );
  }

  async removeUserFromGroup(groupId, userId) {
    // Check if user is creator - if yes, transfer ownership or delete group
    const group = await this.getGroupById(groupId);
    if (group && group.creator_id === userId) {
      // Find another member to transfer ownership
      const otherMember = await this.db.get(
        'SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ? LIMIT 1',
        [groupId, userId]
      );
      if (otherMember) {
        await this.db.run('UPDATE groups SET creator_id = ? WHERE id = ?', [otherMember.user_id, groupId]);
      } else {
        // No other members, delete group
        await this.db.run('DELETE FROM groups WHERE id = ?', [groupId]);
        return;
      }
    }
    
    await this.db.run(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );
  }

  async getGroupMembers(groupId) {
    return await this.db.all(
      `SELECT u.id, u.username, u.real_name, u.avatar_data, u.avatar_color, u.is_online 
       FROM group_members gm 
       JOIN users u ON gm.user_id = u.id 
       WHERE gm.group_id = ?
       ORDER BY u.username`,
      [groupId]
    );
  }

  async saveGroupMessage(messageData) {
    const { id, groupId, senderId, content, type, filePath, fileType, encryptedContent, expiresAt } = messageData;
    await this.db.run(
      `INSERT INTO group_messages (id, group_id, sender_id, content, type, file_path, file_type, encrypted_content, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, groupId, senderId, content, type || 'text', filePath, fileType, encryptedContent, expiresAt]
    );
    return this.getGroupMessageById(id);
  }

  async getGroupMessageById(id) {
    return await this.db.get('SELECT * FROM group_messages WHERE id = ?', [id]);
  }

  async getGroupMessages(groupId, limit = 50) {
    return await this.db.all(
      `SELECT gm.*, u.username as sender_username, u.avatar_data as sender_avatar
       FROM group_messages gm
       JOIN users u ON gm.sender_id = u.id
       WHERE gm.group_id = ?
       ORDER BY gm.created_at DESC
       LIMIT ?`,
      [groupId, limit]
    );
  }

  // ==================== NETWORK DISCOVERY METHODS ====================
  
  async registerHost(userId, hostIp, hostPort) {
    const crypto = require('crypto');
    const id = crypto.randomBytes(16).toString('hex');
    await this.db.run(
      `INSERT OR REPLACE INTO network_hosts (id, user_id, host_ip, host_port, last_seen) 
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [id, userId, hostIp, hostPort]
    );
  }

  async getActiveHosts() {
    await this.db.run(
      'DELETE FROM network_hosts WHERE datetime(last_seen) <= datetime("now", "-5 minutes")'
    );
    
    return await this.db.all(
      `SELECT nh.*, u.username, u.real_name, u.avatar_data, u.avatar_color 
       FROM network_hosts nh 
       JOIN users u ON nh.user_id = u.id 
       WHERE datetime(nh.last_seen) > datetime("now", "-5 minutes")
       ORDER BY nh.last_seen DESC`,
      []
    );
  }

  async updateHostLastSeen(userId) {
    await this.db.run(
      'UPDATE network_hosts SET last_seen = CURRENT_TIMESTAMP WHERE user_id = ?',
      [userId]
    );
  }

  // ==================== CALL LOG METHODS ====================
  
  async saveCallLog(callData) {
    const { id, callerId, receiverId, callType, duration, status, startedAt, endedAt } = callData;
    await this.db.run(
      `INSERT INTO call_logs (id, caller_id, receiver_id, call_type, duration, status, started_at, ended_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, callerId, receiverId, callType || 'audio', duration || 0, status || 'missed', startedAt || new Date().toISOString(), endedAt]
    );
    return this.getCallLogById(id);
  }

  async getCallLogById(id) {
    return await this.db.get('SELECT * FROM call_logs WHERE id = ?', [id]);
  }

  async getUserCallLogs(userId, limit = 50) {
    return await this.db.all(
      `SELECT cl.*, 
        u1.username as caller_username, u1.avatar_data as caller_avatar,
        u2.username as receiver_username, u2.avatar_data as receiver_avatar
       FROM call_logs cl
       JOIN users u1 ON cl.caller_id = u1.id
       JOIN users u2 ON cl.receiver_id = u2.id
       WHERE cl.caller_id = ? OR cl.receiver_id = ?
       ORDER BY cl.started_at DESC
       LIMIT ?`,
      [userId, userId, limit]
    );
  }

  async updateCallLog(callId, updates) {
    const fields = [];
    const values = [];
    
    if (updates.duration !== undefined) {
      fields.push('duration = ?');
      values.push(updates.duration);
    }
    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.endedAt) {
      fields.push('ended_at = ?');
      values.push(updates.endedAt);
    }
    
    if (fields.length === 0) return null;
    
    values.push(callId);
    await this.db.run(
      `UPDATE call_logs SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    return this.getCallLogById(callId);
  }
}

module.exports = new Database();
