const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const encryption = require('../utils/encryption');

module.exports = (io, db) => {
  const activeCalls = new Map();
  const userSockets = new Map();

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch (err) {
      console.error('Socket auth error:', err);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.username} (${socket.userId})`);
    
    userSockets.set(socket.userId, socket);
    
    try {
      await db.updateUserOnlineStatus(socket.userId, true, socket.handshake.address, 5000);
    } catch (error) {
      console.error('Failed to update user status:', error);
    }
    
    socket.broadcast.emit('user:joined', {
      userId: socket.userId,
      username: socket.username
    });

    try {
      const onlineUsers = await db.getOnlineUsers();
      const filtered = onlineUsers.filter(u => u.id !== socket.userId);
      socket.emit('online:users', filtered);
    } catch (error) {
      console.error('Failed to get online users:', error);
    }

    // Handle private messages
    socket.on('message:private', async (data) => {
      try {
        const { receiverId, content, type, fileName, fileType } = data;
        
        if (!receiverId || !content) {
          socket.emit('error', { message: 'Invalid message data' });
          return;
        }
        
        const messageId = uuidv4();
        const expiresAt = new Date(Date.now() + parseInt(process.env.MESSAGE_EXPIRY || 86400000)).toISOString();
        
        // Ensure content is string for encryption
        let contentString = content;
        if (typeof content === 'object') {
          contentString = JSON.stringify(content);
        }
        
        const encryptedContent = encryption.encrypt(contentString);
        
        const receiver = await db.getUserById(receiverId);
        if (!receiver) {
          socket.emit('error', { message: 'Receiver not found' });
          return;
        }
        
        await db.saveMessage({
          id: messageId,
          senderId: socket.userId,
          receiverId: receiverId,
          content: contentString,
          type: type || 'text',
          encryptedContent: JSON.stringify(encryptedContent),
          expiresAt
        });

        const receiverSocket = userSockets.get(receiverId);
        if (receiverSocket && receiverSocket.connected) {
          receiverSocket.emit('message:private', {
            id: messageId,
            senderId: socket.userId,
            senderUsername: socket.username,
            content: contentString,
            type: type || 'text',
            fileName: fileName,
            fileType: fileType,
            timestamp: new Date().toISOString(),
            isDelivered: true
          });
          
          await db.markMessageAsDelivered(messageId);
          socket.emit('message:delivered', { messageId });
        } else {
          socket.emit('message:queued', { messageId });
        }
      } catch (error) {
        console.error('Private message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle group messages
    socket.on('message:group', async (data) => {
      try {
        const { groupId, content, type, fileName, fileType } = data;
        
        if (!groupId || !content) {
          socket.emit('error', { message: 'Invalid group message data' });
          return;
        }
        
        const messageId = uuidv4();
        const expiresAt = new Date(Date.now() + parseInt(process.env.MESSAGE_EXPIRY || 86400000)).toISOString();
        
        const members = await db.getGroupMembers(groupId);
        const isMember = members.some(m => m.id === socket.userId);
        
        if (!isMember) {
          socket.emit('error', { message: 'You are not a member of this group' });
          return;
        }
        
        // Store content as JSON string if it's an object (for images/files)
        let contentToStore = content;
        let messageType = type || 'text';
        
        if (typeof content === 'object') {
          contentToStore = JSON.stringify(content);
          messageType = content.type || type || 'text';
        }
        
        await db.saveGroupMessage({
          id: messageId,
          groupId: groupId,
          senderId: socket.userId,
          content: contentToStore,
          type: messageType,
          expiresAt
        });

        // Broadcast to all group members
        members.forEach(member => {
          if (member.id !== socket.userId) {
            const memberSocket = userSockets.get(member.id);
            if (memberSocket && memberSocket.connected) {
              memberSocket.emit('message:group', {
                id: messageId,
                groupId: groupId,
                senderId: socket.userId,
                senderUsername: socket.username,
                content: contentToStore,
                type: messageType,
                fileName: fileName,
                fileType: fileType,
                timestamp: new Date().toISOString()
              });
            }
          }
        });
        
        socket.emit('message:delivered', { messageId });
      } catch (error) {
        console.error('Group message error:', error);
        socket.emit('error', { message: 'Failed to send group message' });
      }
    });

    // Typing indicators
    socket.on('typing:start', (data) => {
      const { receiverId } = data;
      const receiverSocket = userSockets.get(receiverId);
      if (receiverSocket && receiverSocket.connected) {
        receiverSocket.emit('typing:start', {
          userId: socket.userId,
          username: socket.username
        });
      }
    });

    socket.on('typing:stop', (data) => {
      const { receiverId } = data;
      const receiverSocket = userSockets.get(receiverId);
      if (receiverSocket && receiverSocket.connected) {
        receiverSocket.emit('typing:stop', {
          userId: socket.userId,
          username: socket.username
        });
      }
    });

    socket.on('group:typing', async (data) => {
      const { groupId, isTyping } = data;
      try {
        const members = await db.getGroupMembers(groupId);
        members.forEach(member => {
          if (member.id !== socket.userId) {
            const memberSocket = userSockets.get(member.id);
            if (memberSocket && memberSocket.connected) {
              memberSocket.emit('group:typing', {
                groupId: groupId,
                userId: socket.userId,
                username: socket.username,
                isTyping: isTyping
              });
            }
          }
        });
      } catch (error) {
        console.error('Group typing error:', error);
      }
    });

    // Message read receipts
    socket.on('message:read', async (data) => {
      try {
        const { messageId, senderId } = data;
        await db.markMessageAsRead(messageId);
        
        const senderSocket = userSockets.get(senderId);
        if (senderSocket && senderSocket.connected) {
          senderSocket.emit('message:read', {
            messageId: messageId,
            readerId: socket.userId
          });
        }
      } catch (error) {
        console.error('Mark message read error:', error);
      }
    });

    // Network discovery
    socket.on('discovery:broadcast', async (data) => {
      try {
        await db.registerHost(socket.userId, data.ip, data.port);
        const activeHosts = await db.getActiveHosts();
        const hostUsers = activeHosts.filter(h => h.user_id !== socket.userId);
        socket.emit('discovery:hosts', hostUsers);
      } catch (error) {
        console.error('Discovery broadcast error:', error);
      }
    });

    // Group creation
    socket.on('group:create', async (data) => {
      try {
        const groupId = uuidv4();
        await db.createGroup({
          id: groupId,
          name: data.name,
          creatorId: socket.userId,
          avatarData: data.avatarData
        });

        const membersToAdd = data.members || [];
        for (const memberId of membersToAdd) {
          if (memberId !== socket.userId) {
            await db.addUserToGroup(groupId, memberId);
          }
        }

        const group = await db.getGroupById(groupId);
        const members = await db.getGroupMembers(groupId);
        
        members.forEach(member => {
          const memberSocket = userSockets.get(member.id);
          if (memberSocket && memberSocket.connected) {
            memberSocket.emit('group:created', {
              groupId,
              name: data.name,
              members,
              group
            });
          }
        });
        
        socket.emit('group:created', { groupId, name: data.name, members, group });
      } catch (error) {
        console.error('Group creation error:', error);
        socket.emit('error', { message: 'Failed to create group' });
      }
    });

    socket.on('group:join', async (data) => {
      try {
        await db.addUserToGroup(data.groupId, socket.userId);
        const members = await db.getGroupMembers(data.groupId);
        
        members.forEach(member => {
          const memberSocket = userSockets.get(member.id);
          if (memberSocket && memberSocket.connected) {
            memberSocket.emit('group:user-joined', {
              groupId: data.groupId,
              user: {
                id: socket.userId,
                username: socket.username
              }
            });
          }
        });
        
        const group = await db.getGroupById(data.groupId);
        const messages = await db.getGroupMessages(data.groupId, 50);
        
        socket.emit('group:data', {
          group,
          members,
          messages: messages.reverse()
        });
      } catch (error) {
        console.error('Group join error:', error);
      }
    });

    socket.on('group:leave', async (data) => {
      try {
        await db.removeUserFromGroup(data.groupId, socket.userId);
        const members = await db.getGroupMembers(data.groupId);
        
        members.forEach(member => {
          const memberSocket = userSockets.get(member.id);
          if (memberSocket && memberSocket.connected) {
            memberSocket.emit('group:user-left', {
              groupId: data.groupId,
              userId: socket.userId,
              username: socket.username
            });
          }
        });
      } catch (error) {
        console.error('Group leave error:', error);
      }
    });

    // WebRTC Calls
    socket.on('call:offer', (data) => {
      const callId = uuidv4();
      const { receiverId, offer, type } = data;
      
      activeCalls.set(callId, {
        callId,
        callerId: socket.userId,
        receiverId: receiverId,
        status: 'ringing',
        type: type || 'audio',
        startTime: Date.now()
      });

      const receiverSocket = userSockets.get(receiverId);
      if (receiverSocket && receiverSocket.connected) {
        receiverSocket.emit('call:incoming', {
          callId,
          callerId: socket.userId,
          callerUsername: socket.username,
          offer: offer,
          type: type || 'audio'
        });
      }
    });

    socket.on('call:answer', (data) => {
      const { callId, answer } = data;
      const call = activeCalls.get(callId);
      
      if (call) {
        call.status = 'active';
        const callerSocket = userSockets.get(call.callerId);
        if (callerSocket && callerSocket.connected) {
          callerSocket.emit('call:answered', {
            callId: callId,
            answer: answer
          });
        }
      }
    });

    socket.on('call:reject', (data) => {
      const { callId } = data;
      const call = activeCalls.get(callId);
      
      if (call) {
        const callerSocket = userSockets.get(call.callerId);
        if (callerSocket && callerSocket.connected) {
          callerSocket.emit('call:rejected', {
            callId: callId,
            reason: 'rejected'
          });
        }
        activeCalls.delete(callId);
      }
    });

    socket.on('call:ice-candidate', (data) => {
      const { callId, candidate, targetId } = data;
      const targetSocket = userSockets.get(targetId);
      if (targetSocket && targetSocket.connected) {
        targetSocket.emit('call:ice-candidate', {
          callId: callId,
          candidate: candidate
        });
      }
    });

    socket.on('call:end', (data) => {
      const { callId } = data;
      const call = activeCalls.get(callId);
      
      if (call) {
        const otherId = call.callerId === socket.userId ? call.receiverId : call.callerId;
        const otherSocket = userSockets.get(otherId);
        if (otherSocket && otherSocket.connected) {
          otherSocket.emit('call:ended', { 
            callId: callId
          });
        }
        activeCalls.delete(callId);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.username} (${socket.userId})`);
      userSockets.delete(socket.userId);
      
      try {
        await db.updateUserOnlineStatus(socket.userId, false);
      } catch (error) {
        console.error('Failed to update user status on disconnect:', error);
      }
      
      socket.broadcast.emit('user:left', {
        userId: socket.userId,
        username: socket.username
      });

      activeCalls.forEach((call, callId) => {
        if (call.callerId === socket.userId || call.receiverId === socket.userId) {
          const otherId = call.callerId === socket.userId ? call.receiverId : call.callerId;
          const otherSocket = userSockets.get(otherId);
          if (otherSocket && otherSocket.connected) {
            otherSocket.emit('call:ended', { 
              callId: callId,
              reason: 'user_disconnected'
            });
          }
          activeCalls.delete(callId);
        }
      });
    });
  });

  // Cleanup expired messages every minute
  setInterval(async () => {
    try {
      await db.deleteExpiredMessages();
    } catch (error) {
      console.error('Failed to delete expired messages:', error);
    }
  }, 60000);
};
