import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState({});
  const { user, token } = useAuth();
  const socketRef = useRef(null);
  const messageHandlersRef = useRef(new Map());

  useEffect(() => {
    if (user && token && !socketRef.current) {
      const newSocket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });

      newSocket.on('connect', () => {
        console.log('Connected to socket server');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected from socket server:', reason);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

      newSocket.on('user:joined', (data) => {
        toast.info(`${data.username} joined the network`);
        setOnlineUsers(prev => {
          if (prev.find(u => u.userId === data.userId)) return prev;
          return [...prev, data];
        });
      });

      newSocket.on('user:left', (data) => {
        toast.info(`${data.username} left the network`);
        setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
      });

      newSocket.on('online:users', (users) => {
        const filtered = users.filter(u => u.id !== user?.id);
        setOnlineUsers(filtered);
      });

      // Global message handler - receives messages even when not in chat
      newSocket.on('message:private', (data) => {
        console.log('Private message received:', data);
        
        // Store unread message
        setUnreadMessages(prev => {
          const userMessages = prev[data.senderId] || [];
          return {
            ...prev,
            [data.senderId]: [...userMessages, data]
          };
        });
        
        // Show notification
        toast.info(`${data.senderUsername}: ${data.content.substring(0, 50)}`);
        
        // Play notification sound
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(e => console.log('Audio play failed:', e));
        } catch (e) {}
        
        // Call any registered handlers for this sender
        const handlers = messageHandlersRef.current.get(data.senderId);
        if (handlers) {
          handlers.forEach(handler => handler(data));
        }
      });

      newSocket.on('message:group', (data) => {
        console.log('Group message received:', data);
        
        toast.info(`${data.senderUsername} sent a message in group`);
        
        // Play notification sound
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(e => console.log('Audio play failed:', e));
        } catch (e) {}
        
        // Call group handlers
        const handlers = messageHandlersRef.current.get(`group_${data.groupId}`);
        if (handlers) {
          handlers.forEach(handler => handler(data));
        }
      });

      newSocket.on('call:incoming', (data) => {
        setIncomingCall(data);
        toast.info(`Incoming call from ${data.callerUsername}`);
        
        // Play ringtone
        try {
          const audio = new Audio('/ringtone.mp3');
          audio.loop = true;
          audio.volume = 0.7;
          audio.play().catch(e => console.log('Ringtone play failed:', e));
          window.currentRingtone = audio;
        } catch (e) {}
      });

      newSocket.on('call:answered', (data) => {
        if (window.currentRingtone) {
          window.currentRingtone.pause();
          window.currentRingtone = null;
        }
        toast.success('Call answered');
      });

      newSocket.on('call:rejected', (data) => {
        if (window.currentRingtone) {
          window.currentRingtone.pause();
          window.currentRingtone = null;
        }
        toast.info('Call was rejected');
        setIncomingCall(null);
      });

      newSocket.on('call:ended', (data) => {
        if (window.currentRingtone) {
          window.currentRingtone.pause();
          window.currentRingtone = null;
        }
        setIncomingCall(null);
        toast.info('Call ended');
      });

      newSocket.on('error', (error) => {
        toast.error(error.message);
      });

      socketRef.current = newSocket;
      setSocket(newSocket);

      // Start network discovery
      const discoveryInterval = startDiscovery(newSocket);

      return () => {
        if (discoveryInterval) clearInterval(discoveryInterval);
        if (socketRef.current) {
          socketRef.current.close();
          socketRef.current = null;
        }
        if (window.currentRingtone) {
          window.currentRingtone.pause();
          window.currentRingtone = null;
        }
      };
    }
  }, [user, token]);

  const startDiscovery = (socket) => {
    const getLocalIP = () => {
      return new Promise((resolve) => {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(() => {});
        pc.onicecandidate = (ice) => {
          if (!ice || !ice.candidate || !ice.candidate.candidate) return;
          const ipMatch = ice.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
          if (ipMatch) {
            pc.close();
            resolve(ipMatch[0]);
          }
        };
        setTimeout(() => {
          pc.close();
          resolve('127.0.0.1');
        }, 2000);
      });
    };

    const broadcast = () => {
      if (socket && socket.connected) {
        getLocalIP().then(ip => {
          socket.emit('discovery:broadcast', {
            ip,
            port: 5000
          });
        });
      }
    };

    broadcast();
    const interval = setInterval(broadcast, 5000);
    
    return interval;
  };

  const registerMessageHandler = (userId, handler) => {
    if (!messageHandlersRef.current.has(userId)) {
      messageHandlersRef.current.set(userId, new Set());
    }
    messageHandlersRef.current.get(userId).add(handler);
    
    return () => {
      const handlers = messageHandlersRef.current.get(userId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          messageHandlersRef.current.delete(userId);
        }
      }
    };
  };

  const registerGroupHandler = (groupId, handler) => {
    const key = `group_${groupId}`;
    if (!messageHandlersRef.current.has(key)) {
      messageHandlersRef.current.set(key, new Set());
    }
    messageHandlersRef.current.get(key).add(handler);
    
    return () => {
      const handlers = messageHandlersRef.current.get(key);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          messageHandlersRef.current.delete(key);
        }
      }
    };
  };

  const sendPrivateMessage = (receiverId, content) => {
    if (socket && socket.connected && receiverId) {
      socket.emit('message:private', { receiverId, content });
    } else {
      toast.error('Not connected to chat server');
    }
  };

  const sendGroupMessage = (groupId, content) => {
    if (socket && socket.connected && groupId) {
      socket.emit('message:group', { groupId, content });
    }
  };

  const startTyping = (receiverId) => {
    if (socket && socket.connected && receiverId) {
      socket.emit('typing:start', { receiverId });
    }
  };

  const stopTyping = (receiverId) => {
    if (socket && socket.connected && receiverId) {
      socket.emit('typing:stop', { receiverId });
    }
  };

  const markAsRead = (messageId, senderId) => {
    if (socket && socket.connected) {
      socket.emit('message:read', { messageId, senderId });
    }
  };

  const initiateCall = (receiverId, offer) => {
    if (socket && socket.connected && receiverId) {
      socket.emit('call:offer', { receiverId, offer });
    }
  };

  const answerCall = (callId, answer) => {
    if (socket && socket.connected) {
      socket.emit('call:answer', { callId, answer });
      if (window.currentRingtone) {
        window.currentRingtone.pause();
        window.currentRingtone = null;
      }
    }
  };

  const rejectCall = (callId) => {
    if (socket && socket.connected) {
      socket.emit('call:reject', { callId });
      if (window.currentRingtone) {
        window.currentRingtone.pause();
        window.currentRingtone = null;
      }
      setIncomingCall(null);
    }
  };

  const endCall = (callId) => {
    if (socket && socket.connected) {
      socket.emit('call:end', { callId });
    }
    if (window.currentRingtone) {
      window.currentRingtone.pause();
      window.currentRingtone = null;
    }
  };

  const clearUnreadMessages = (userId) => {
    setUnreadMessages(prev => {
      const newState = { ...prev };
      delete newState[userId];
      return newState;
    });
  };

  const getUnreadCount = (userId) => {
    return unreadMessages[userId]?.length || 0;
  };

  const value = {
    socket,
    onlineUsers,
    incomingCall,
    unreadMessages,
    sendPrivateMessage,
    sendGroupMessage,
    startTyping,
    stopTyping,
    markAsRead,
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    registerMessageHandler,
    registerGroupHandler,
    clearUnreadMessages,
    getUnreadCount,
    setIncomingCall
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
