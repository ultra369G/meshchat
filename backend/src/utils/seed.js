const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
require('dotenv').config();

async function seed() {
  try {
    await db.initialize();
    
    console.log('Seeding database...');
    
    // Clear existing data
    await db.db.exec(`
      DELETE FROM group_messages;
      DELETE FROM messages;
      DELETE FROM group_members;
      DELETE FROM groups;
      DELETE FROM network_hosts;
      DELETE FROM users;
    `);

    // Hash passwords
    const salt = await bcrypt.genSalt(10);
    const hash1 = await bcrypt.hash('password123', salt);
    const hash2 = await bcrypt.hash('password123', salt);
    const hash3 = await bcrypt.hash('password123', salt);
    const hash4 = await bcrypt.hash('password123', salt);

    // Insert sample users
    const user1 = uuidv4();
    const user2 = uuidv4();
    const user3 = uuidv4();
    const user4 = uuidv4();

    await db.db.run(`
      INSERT INTO users (id, username, real_name, email, password_hash, avatar_color, is_online) VALUES
      (?, 'alice', 'Alice Johnson', 'alice@example.com', ?, '#FF6B6B', 1),
      (?, 'bob', 'Bob Smith', 'bob@example.com', ?, '#4ECDC4', 1),
      (?, 'charlie', 'Charlie Brown', 'charlie@example.com', ?, '#45B7D1', 0),
      (?, 'diana', 'Diana Prince', 'diana@example.com', ?, '#96CEB4', 1)
    `, [user1, hash1, user2, hash2, user3, hash3, user4, hash4]);

    // Create sample group
    const groupId = uuidv4();
    await db.db.run(
      'INSERT INTO groups (id, name, creator_id) VALUES (?, ?, ?)',
      [groupId, 'General Chat', user1]
    );

    // Add group members
    await db.db.run(
      'INSERT INTO group_members (group_id, user_id) VALUES (?, ?), (?, ?), (?, ?)',
      [groupId, user1, groupId, user2, groupId, user3]
    );

    // Insert sample messages
    await db.db.run(
      `INSERT INTO messages (id, sender_id, receiver_id, content, is_read, expires_at) VALUES
       (?, ?, ?, 'Hey Bob, how are you?', 1, datetime("now", "+1 day")),
       (?, ?, ?, 'Hi Alice! I''m good, thanks!', 1, datetime("now", "+1 day")),
       (?, ?, ?, 'Want to chat?', 0, datetime("now", "+1 day"))`,
      [uuidv4(), user1, user2, uuidv4(), user2, user1, uuidv4(), user1, user2]
    );

    // Insert sample network hosts
    await db.db.run(
      `INSERT INTO network_hosts (id, user_id, host_ip, host_port) VALUES
       (?, ?, '192.168.1.101', 5000),
       (?, ?, '192.168.1.102', 5000),
       (?, ?, '192.168.1.104', 5000)`,
      [uuidv4(), user1, uuidv4(), user2, uuidv4(), user4]
    );

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();
