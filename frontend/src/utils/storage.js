export const storage = {
  setItem: (key, value) => {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  },
  
  getItem: (key) => {
    try {
      const serialized = localStorage.getItem(key);
      if (serialized === null) return null;
      return JSON.parse(serialized);
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },
  
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  },
  
  // Chat specific methods
  saveMessage: (userId, message) => {
    const key = `chat_${userId}`;
    const messages = storage.getItem(key) || [];
    messages.push(message);
    storage.setItem(key, messages);
    return messages;
  },
  
  getMessages: (userId) => {
    const key = `chat_${userId}`;
    return storage.getItem(key) || [];
  },
  
  clearMessages: (userId) => {
    const key = `chat_${userId}`;
    storage.removeItem(key);
  },
  
  // User preferences
  saveUserPreferences: (userId, preferences) => {
    const key = `user_prefs_${userId}`;
    storage.setItem(key, preferences);
  },
  
  getUserPreferences: (userId) => {
    const key = `user_prefs_${userId}`;
    return storage.getItem(key) || {
      theme: 'light',
      notifications: true,
      soundEnabled: true
    };
  },
  
  // Group storage
  saveGroup: (groupId, groupData) => {
    const key = `group_${groupId}`;
    storage.setItem(key, groupData);
  },
  
  getGroup: (groupId) => {
    const key = `group_${groupId}`;
    return storage.getItem(key);
  },
  
  // Conversation history
  getConversations: () => {
    const conversations = storage.getItem('conversations') || [];
    return conversations;
  },
  
  addConversation: (conversation) => {
    const conversations = storage.getConversations();
    const existingIndex = conversations.findIndex(c => c.userId === conversation.userId);
    if (existingIndex !== -1) {
      conversations[existingIndex] = conversation;
    } else {
      conversations.push(conversation);
    }
    storage.setItem('conversations', conversations);
    return conversations;
  },
  
  updateConversation: (userId, lastMessage) => {
    const conversations = storage.getConversations();
    const conversation = conversations.find(c => c.userId === userId);
    if (conversation) {
      conversation.lastMessage = lastMessage;
      conversation.timestamp = new Date().toISOString();
      storage.setItem('conversations', conversations);
    }
  }
};

export default storage;
