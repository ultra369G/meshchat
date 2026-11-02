#!/bin/bash
echo "Starting MeshChat Server..."
cd backend
node src/index.js &
BACKEND_PID=$!
echo "Backend started on port 5000"
echo "Open browser and go to: http://localhost:3000"
wait $BACKEND_PID
