import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import OnlineUsers from './components/Users/OnlineUsers';
import ChatWindow from './components/Chat/ChatWindow';
import GroupChat from './components/Group/GroupChat';
import CreateGroup from './components/Group/CreateGroup';
import CallScreen from './components/Calls/CallScreen';
import UserProfile from './components/Profile/UserProfile';

import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import PrivateRoute from './components/PrivateRoute';

import './styles/App.css';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <div className="app">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<PrivateRoute><OnlineUsers /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
            <Route path="/chat/:userId" element={<PrivateRoute><ChatWindow /></PrivateRoute>} />
            <Route path="/group/:groupId" element={<PrivateRoute><GroupChat /></PrivateRoute>} />
            <Route path="/create-group" element={<PrivateRoute><CreateGroup /></PrivateRoute>} />
            <Route path="/call/:callId" element={<PrivateRoute><CallScreen /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <ToastContainer position="bottom-right" autoClose={3000} theme="dark" />
        </div>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
