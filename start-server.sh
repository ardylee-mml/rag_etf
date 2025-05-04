#!/bin/bash

# Kill any existing process on port 3000
echo "Checking for existing processes on port 3000..."
PID=$(lsof -t -i:3000)
if [ ! -z "$PID" ]; then
  echo "Found process $PID using port 3000. Killing it..."
  kill -9 $PID
  echo "Process $PID killed."
  sleep 2
else
  echo "No existing process found on port 3000."
fi

# Start the server
echo "Starting server..."
node test-server.js
