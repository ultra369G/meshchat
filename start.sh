#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}MeshChat Server Starting${NC}"
echo -e "${BLUE}=========================================${NC}"

# Get local IP
IP=$(ip addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v 127.0.0.1 | grep -v 172.17 | head -1)

if [ -z "$IP" ]; then
    IP="localhost"
fi

echo -e "${GREEN}Local Access:${NC} http://localhost:3000"
echo -e "${GREEN}Network Access:${NC} http://$IP:3000"
echo ""
echo -e "${BLUE}Share the Network URL with other devices on the same network${NC}"
echo -e "${BLUE}=========================================${NC}"

# Navigate to backend and start
cd backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${RED}Installing backend dependencies...${NC}"
    npm install
fi

# Create database directory
mkdir -p database
chmod 755 database

# Seed database if needed
if [ ! -f "database/meshchat.db" ]; then
    echo -e "${GREEN}Seeding database...${NC}"
    npm run seed
fi

# Start backend
echo -e "${GREEN}Starting backend server...${NC}"
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Navigate to frontend
cd ../frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${RED}Installing frontend dependencies...${NC}"
    npm install
fi

# Start frontend
echo -e "${GREEN}Starting frontend server...${NC}"
BROWSER=none npm start &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}✅ Servers started!${NC}"
echo -e "${BLUE}Press Ctrl+C to stop all servers${NC}"
echo -e "${BLUE}=========================================${NC}"

# Wait for user to press Ctrl+C
trap "echo -e '${RED}Stopping servers...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT

wait
