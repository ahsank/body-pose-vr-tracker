// Google Cloud Run WebSocket Server
// server.js

const express = require('express');
const { WebSocketServer } = require('ws');
const { createServer } = require('http');
const cors = require('cors');

const app = express();
const server = createServer(app);

// Enable CORS
app.use(cors({
    origin: true,
    credentials: true
}));

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        connections: wss.clients.size,
        rooms: rooms.size 
    });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
    const metrics = {
        activeConnections: wss.clients.size,
        activeRooms: rooms.size,
        totalMessages: messageCount,
        uptime: process.uptime(),
        memory: process.memoryUsage()
    };
    res.json(metrics);
});

// Room and connection management
const rooms = new Map();
const connections = new Map();
let messageCount = 0;

// WebSocket Server
const wss = new WebSocketServer({ 
    server,
    path: '/ws',
    clientTracking: true
});

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId') || generateId();
    const deviceType = url.searchParams.get('deviceType') || 'unknown';
    const roomId = url.searchParams.get('roomId');
    
    // Connection setup
    ws.sessionId = sessionId;
    ws.deviceType = deviceType;
    ws.roomId = roomId;
    ws.isAlive = true;
    ws.connectedAt = Date.now();
    
    connections.set(sessionId, ws);
    
    console.log(`[${new Date().toISOString()}] Connection: ${deviceType} (${sessionId})`);
    
    // Auto-join room if specified
    if (roomId) {
        joinRoom(ws, roomId);
    }
    
    // Message handling
    ws.on('message', (data) => {
        messageCount++;
        try {
            const message = JSON.parse(data.toString());
            handleMessage(ws, message);
        } catch (error) {
            console.error('Message error:', error);
            sendError(ws, 'Invalid message format');
        }
    });
    
    // Keepalive
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    // Cleanup on disconnect
    ws.on('close', (code, reason) => {
        console.log(`[${new Date().toISOString()}] Disconnect: ${sessionId} (${code})`);
        cleanup(ws);
    });
    
    ws.on('error', (error) => {
        console.error(`WebSocket error for ${sessionId}:`, error);
        cleanup(ws);
    });
    
    // Send welcome
    send(ws, {
        type: 'connected',
        sessionId,
        deviceType,
        serverTime: Date.now(),
        connectionId: generateId()
    });
});

// Message router
function handleMessage(ws, message) {
    switch (message.type) {
        case 'join_room':
            joinRoom(ws, message.roomId);
            break;
            
        case 'leave_room':
            leaveRoom(ws);
            break;
            
        case 'pose_data':
            handlePoseData(ws, message);
            break;
            
        case 'device_register':
            registerDevice(ws, message);
            break;
            
        case 'ping':
            send(ws, { type: 'pong', timestamp: Date.now() });
            break;
            
        case 'sync_request':
            handleSyncRequest(ws, message);
            break;
            
        case 'room_list':
            sendRoomList(ws);
            break;
            
        default:
            sendError(ws, `Unknown message type: ${message.type}`);
    }
}

// Room management
function joinRoom(ws, roomId) {
    // Leave current room first
    if (ws.roomId) {
        leaveRoom(ws);
    }
    
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            id: roomId,
            created: Date.now(),
            participants: new Map()
        });
    }
    
    const room = rooms.get(roomId);
    room.participants.set(ws.sessionId, {
        ws,
        deviceType: ws.deviceType,
        joinedAt: Date.now()
    });
    
    ws.roomId = roomId;
    
    // Get participant list
    const participants = Array.from(room.participants.values()).map(p => ({
        sessionId: p.ws.sessionId,
        deviceType: p.ws.deviceType,
        joinedAt: p.joinedAt
    }));
    
    // Confirm room join
    send(ws, {
        type: 'room_joined',
        roomId,
        participants: participants.filter(p => p.sessionId !== ws.sessionId),
        roomCreated: room.created
    });
    
    // Notify others
    broadcastToRoom(roomId, {
        type: 'participant_joined',
        participant: {
            sessionId: ws.sessionId,
            deviceType: ws.deviceType,
            joinedAt: Date.now()
        }
    }, ws.sessionId);
    
    console.log(`Session ${ws.sessionId} joined room ${roomId}`);
}

function leaveRoom(ws) {
    if (!ws.roomId || !rooms.has(ws.roomId)) return;
    
    const room = rooms.get(ws.roomId);
    room.participants.delete(ws.sessionId);
    
    // Notify others
    broadcastToRoom(ws.roomId, {
        type: 'participant_left',
        participant: {
            sessionId: ws.sessionId,
            deviceType: ws.deviceType
        }
    });
    
    // Clean up empty rooms
    if (room.participants.size === 0) {
        rooms.delete(ws.roomId);
        console.log(`Room ${ws.roomId} deleted (empty)`);
    }
    
    ws.roomId = null;
}

// Pose data handling with rate limiting
const poseDataLimits = new Map();

function handlePoseData(ws, message) {
    // Rate limiting (optional)
    const now = Date.now();
    const sessionLimit = poseDataLimits.get(ws.sessionId) || { count: 0, resetTime: now + 1000 };
    
    if (now > sessionLimit.resetTime) {
        sessionLimit.count = 0;
        sessionLimit.resetTime = now + 1000;
    }
    
    sessionLimit.count++;
    poseDataLimits.set(ws.sessionId, sessionLimit);
    
    // Limit to 30 FPS per session
    if (sessionLimit.count > 30) {
        return;
    }
    
    // Broadcast to room
    if (ws.roomId) {
        broadcastToRoom(ws.roomId, {
            type: 'pose_data',
            sessionId: ws.sessionId,
            deviceType: ws.deviceType,
            timestamp: now,
            landmarks: message.landmarks,
            metadata: {
                ...message.metadata,
                serverReceived: now,
                latency: now - message.timestamp
            }
        }, ws.sessionId);
    }
}

// Device registration
function registerDevice(ws, message) {
    ws.capabilities = message.capabilities;
    ws.deviceInfo = message.deviceInfo;
    
    send(ws, {
        type: 'device_registered',
        sessionId: ws.sessionId,
        capabilities: ws.capabilities
    });
}

// Sync request handling
function handleSyncRequest(ws, message) {
    if (message.targetSession) {
        const target = connections.get(message.targetSession);
        if (target && target.readyState === target.OPEN) {
            send(target, {
                ...message,
                sourceSession: ws.sessionId
            });
        } else {
            sendError(ws, 'Target session not found');
        }
    }
}

// Room list
function sendRoomList(ws) {
    const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
        id,
        created: room.created,
        participants: room.participants.size,
        devices: Array.from(room.participants.values()).map(p => p.deviceType)
    }));
    
    send(ws, {
        type: 'room_list',
        rooms: roomList
    });
}

// Utility functions
function send(ws, message) {
    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

function sendError(ws, message) {
    send(ws, { 
        type: 'error', 
        message,
        timestamp: Date.now()
    });
}

function broadcastToRoom(roomId, message, excludeSession = null) {
    if (!rooms.has(roomId)) return;
    
    const room = rooms.get(roomId);
    const messageStr = JSON.stringify(message);
    
    room.participants.forEach((participant, sessionId) => {
        if (sessionId !== excludeSession && 
            participant.ws.readyState === participant.ws.OPEN) {
            participant.ws.send(messageStr);
        }
    });
}

function cleanup(ws) {
    connections.delete(ws.sessionId);
    leaveRoom(ws);
    poseDataLimits.delete(ws.sessionId);
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Keepalive ping
setInterval(() => {
    wss.clients.forEach(ws => {
        if (!ws.isAlive) {
            ws.terminate();
            return;
        }
        
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

// Periodic cleanup
setInterval(() => {
    // Clear old rate limit data
    const now = Date.now();
    for (const [sessionId, limit] of poseDataLimits) {
        if (now > limit.resetTime + 60000) { // 1 minute old
            poseDataLimits.delete(sessionId);
        }
    }
}, 60000);

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    
    // Close all WebSocket connections
    wss.clients.forEach(ws => {
        ws.close(1001, 'Server shutting down');
    });
    
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Docker configuration
// Dockerfile
const dockerfile = `
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:8080/ || exit 1

# Start server
CMD ["node", "server.js"]
`;

// package.json
const packageJson = {
    "name": "pose-tracker-websocket",
    "version": "1.0.0",
    "main": "server.js",
    "scripts": {
        "start": "node server.js",
        "dev": "nodemon server.js",
        "docker:build": "docker build -t pose-tracker-ws .",
        "docker:run": "docker run -p 8080:8080 pose-tracker-ws"
    },
    "dependencies": {
        "express": "^4.18.2",
        "ws": "^8.14.0",
        "cors": "^2.8.5"
    },
    "devDependencies": {
        "nodemon": "^3.0.1"
    },
    "engines": {
        "node": ">=18.0.0"
    }
};

// Cloud Run deployment
const cloudRunDeploy = `
# Install Google Cloud CLI
# https://cloud.google.com/sdk/docs/install

# Build and deploy to Cloud Run
gcloud run deploy pose-tracker-websocket \\
  --source . \\
  --platform managed \\
  --region us-central1 \\
  --allow-unauthenticated \\
  --port 8080 \\
  --memory 512Mi \\
  --cpu 1 \\
  --timeout 3600 \\
  --concurrency 1000 \\
  --max-instances 10 \\
  --set-env-vars NODE_ENV=production

# Your WebSocket URL will be:
# wss://pose-tracker-websocket-[hash]-uc.a.run.app/ws
`;

module.exports = { app, server };
