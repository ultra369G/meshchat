const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../database');

// Get all online users
router.get('/online', auth, async (req, res) => {
  try {
    const onlineUsers = await db.getOnlineUsers();
    const filtered = onlineUsers.filter(u => u.id !== req.userId);
    
    const formatted = filtered.map(u => ({
      userId: u.id,
      id: u.id,
      username: u.username,
      realName: u.real_name,
      real_name: u.real_name,
      avatarData: u.avatar_data,
      avatar_data: u.avatar_data,
      avatarColor: u.avatar_color,
      avatar_color: u.avatar_color,
      isOnline: u.is_online === 1
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({ error: 'Failed to get online users' });
  }
});

// Get user profile
router.get('/profile/:userId', auth, async (req, res) => {
  try {
    const user = await db.getUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      userId: user.id,
      username: user.username,
      realName: user.real_name,
      real_name: user.real_name,
      email: user.email,
      avatarData: user.avatar_data,
      avatar_data: user.avatar_data,
      avatarColor: user.avatar_color,
      avatar_color: user.avatar_color,
      isOnline: user.is_online === 1,
      lastSeen: user.last_seen
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { realName, username, avatarData, avatarColor } = req.body;
    
    if (username) {
      const existingUser = await db.getUserByUsername(username);
      if (existingUser && existingUser.id !== req.userId) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      await db.db.run('UPDATE users SET username = ? WHERE id = ?', [username, req.userId]);
    }
    
    if (realName) {
      await db.db.run('UPDATE users SET real_name = ? WHERE id = ?', [realName, req.userId]);
    }
    
    if (avatarData !== undefined) {
      await db.db.run('UPDATE users SET avatar_data = ? WHERE id = ?', [avatarData, req.userId]);
    }
    
    if (avatarColor) {
      await db.db.run('UPDATE users SET avatar_color = ? WHERE id = ?', [avatarColor, req.userId]);
    }

    const updatedUser = await db.getUserById(req.userId);
    
    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      realName: updatedUser.real_name,
      avatarData: updatedUser.avatar_data,
      avatarColor: updatedUser.avatar_color
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update avatar
router.put('/avatar', auth, async (req, res) => {
  try {
    const { avatarData, avatarColor } = req.body;
    
    await db.db.run(
      'UPDATE users SET avatar_data = ?, avatar_color = ? WHERE id = ?',
      [avatarData, avatarColor, req.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update avatar error:', error);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

// Get user's groups
router.get('/groups', auth, async (req, res) => {
  try {
    const groups = await db.db.all(
      `SELECT g.*, 
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
        (SELECT created_at FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_activity
       FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = ?
       ORDER BY last_activity DESC`,
      [req.userId]
    );
    res.json(groups || []);
  } catch (error) {
    console.error('Get groups error:', error);
    res.json([]);
  }
});

// Get group details
router.get('/groups/:groupId', auth, async (req, res) => {
  try {
    const group = await db.getGroupById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const members = await db.getGroupMembers(req.params.groupId);
    const messages = await db.db.all(
      `SELECT gm.*, u.username as sender_username, u.avatar_data as sender_avatar
       FROM group_messages gm
       JOIN users u ON gm.sender_id = u.id
       WHERE gm.group_id = ?
       ORDER BY gm.created_at ASC
       LIMIT 100`,
      [req.params.groupId]
    );
    
    // Parse message contents properly
    const parsedMessages = messages.map(msg => {
      let content = msg.content;
      let type = msg.type || 'text';
      
      try {
        const parsed = JSON.parse(msg.content);
        if (parsed && typeof parsed === 'object') {
          content = parsed.url || parsed.content || msg.content;
          type = parsed.type || msg.type || 'text';
        }
      } catch (e) {
        // Not JSON, keep as is
      }
      
      return {
        ...msg,
        content: content,
        type: type
      };
    });
    
    res.json({
      ...group,
      members,
      messages: parsedMessages
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to get group' });
  }
});

// Get unread messages
router.get('/messages/unread', auth, async (req, res) => {
  try {
    const messages = await db.getUnreadMessages(req.userId);
    res.json(messages);
  } catch (error) {
    console.error('Get unread messages error:', error);
    res.status(500).json({ error: 'Failed to get unread messages' });
  }
});

// Get network hosts
router.get('/network/hosts', auth, async (req, res) => {
  try {
    const hosts = await db.getActiveHosts();
    res.json(hosts);
  } catch (error) {
    console.error('Get network hosts error:', error);
    res.status(500).json({ error: 'Failed to get network hosts' });
  }
});

module.exports = router;
