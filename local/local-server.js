// Local Development WebSocket Server
// local-server.js

const express = require('express');
const { WebSocketServer } = require('ws');
const { createServer } = require('http');
const cors = require('cors');
const os = require('os');
const qrcode = require('qrcode-terminal');

const app = express();
const server = createServer(app);

// Configuration
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// Enable CORS for all origins (development only)
app.use(cors({
    origin: true,
    credentials: true
}));

// Serve static files (for testing)
app.use(express.static('public'));

// Get local IP addresses
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    
    Object.keys(interfaces).forEach(interfaceName => {
        interfaces[interfaceName].forEach(interface => {
            if (interface.family === 'IPv4' && !interface.internal) {
                ips.push(interface.address);
            }
        });
    });
    
    return ips;
}

// Development endpoints
app.get('/', (req, res) => {
    const localIPs = getLocalIPs();
    const urls = localIPs.map(ip => `http://${ip}:${PORT}`);
    
    res.json({
        status: 'Local WebSocket Server Running',
        websocketUrl: urls.map(url => url.replace('http', 'ws') + '/ws'),
        httpUrls: urls,
        connections: wss.clients.size,
        rooms: Array.from(rooms.keys()),
        uptime: process.uptime()
    });
});

// QR Code endpoint for easy mobile connection
app.get('/qr', (req, res) => {
    const localIPs = getLocalIPs();
    const wsUrl = `ws://${localIPs[0]}:${PORT}/ws`;
    
    // Generate QR code in terminal
    console.log('\n📱 Scan this QR code on your phone:');
    qrcode.generate(wsUrl, { small: true });
    
    res.json({ 
        url: wsUrl,
        message: 'QR code generated in terminal' 
    });
});

// Room and connection management
const rooms = new Map();
const connections = new Map();
const deviceMetrics = {
    totalConnections: 0,
    currentConnections: 0,
    messagesSent: 0,
    messagesReceived: 0
};

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
    ws.clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    connections.set(sessionId, ws);
    deviceMetrics.totalConnections++;
    deviceMetrics.currentConnections++;
    
    // Colorful console logging
    console.log(`\n🔗 NEW CONNECTION:`);
    console.log(`   📱 Device: ${deviceType}`);
    console.log(`   🆔 Session: ${sessionId}`);
    console.log(`   🌐 IP: ${ws.clientIP}`);
    console.log(`   🏠 Room: ${roomId || 'None'}`);
    console.log(`   👥 Total: ${deviceMetrics.currentConnections} active`);
    
    // Auto-join room if specified
    if (roomId) {
        joinRoom(ws, roomId);
    }
    
    // Message handling
    ws.on('message', (data) => {
        deviceMetrics.messagesReceived++;
        try {
            const message = JSON.parse(data.toString());
            handleMessage(ws, message);
        } catch (error) {
            console.error('❌ Message error:', error);
            sendError(ws, 'Invalid message format');
        }
    });
    
    // Keepalive
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    // Cleanup on disconnect
    ws.on('close', (code, reason) => {
        deviceMetrics.currentConnections--;
        console.log(`\n❌ DISCONNECT: ${deviceType} (${sessionId}) - Code: ${code}`);
        console.log(`   👥 Remaining: ${deviceMetrics.currentConnections} active`);
        cleanup(ws);
    });
    
    ws.on('error', (error) => {
        console.error(`🚨 WebSocket error for ${sessionId}:`, error);
        cleanup(ws);
    });
    
    // Send welcome with connection info
    send(ws, {
        type: 'connected',
        sessionId,
        deviceType,
        serverTime: Date.now(),
        serverInfo: {
            version: '1.0.0-dev',
            environment: 'local',
            uptime: process.uptime()
        }
    });
});

// Enhanced message handling with logging
function handleMessage(ws, message) {
    console.log(`📨 ${ws.deviceType} (${ws.sessionId}): ${message.type}`);
    
    switch (message.type) {
        case 'join_room':
            joinRoom(ws, message.roomId);
            break;
            
        case 'create_room':
            const roomId = generateRoomId();
            joinRoom(ws, roomId);
            send(ws, { type: 'room_created', roomId });
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
            
        case 'get_stats':
            sendStats(ws);
            break;
            
        default:
            console.log(`❓ Unknown message: ${message.type}`);
            sendError(ws, `Unknown message type: ${message.type}`);
    }
}

// Enhanced room management with detailed logging
function joinRoom(ws, roomId) {
    if (ws.roomId) {
        leaveRoom(ws);
    }
    
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            id: roomId,
            created: Date.now(),
            participants: new Map()
        });
        console.log(`🏠 ROOM CREATED: ${roomId}`);
    }
    
    const room = rooms.get(roomId);
    room.participants.set(ws.sessionId, {
        ws,
        deviceType: ws.deviceType,
        joinedAt: Date.now()
    });
    
    ws.roomId = roomId;
    
    const participants = Array.from(room.participants.values()).map(p => ({
        sessionId: p.ws.sessionId,
        deviceType: p.ws.deviceType,
        joinedAt: p.joinedAt
    }));
    
    console.log(`🏠 ROOM JOIN: ${ws.deviceType} → ${roomId}`);
    console.log(`   👥 Participants: ${participants.map(p => p.deviceType).join(', ')}`);
    
    // Send room confirmation
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
    
    // Check for successful pairing
    const hasPhone = participants.some(p => p.deviceType === 'mobile');
    const hasVR = participants.some(p => p.deviceType === 'vr');
    
    if (hasPhone && hasVR) {
        console.log(`🎉 SUCCESSFUL PAIRING in room ${roomId}!`);
        broadcastToRoom(roomId, {
            type: 'pairing_success',
            devices: participants.map(p => p.deviceType)
        });
    }
}

function leaveRoom(ws) {
    if (!ws.roomId || !rooms.has(ws.roomId)) return;
    
    const room = rooms.get(ws.roomId);
    room.participants.delete(ws.sessionId);
    
    console.log(`�� ROOM LEAVE: ${ws.deviceType} ← ${ws.roomId}`);
    
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
        console.log(`🗑️  ROOM DELETED: ${ws.roomId} (empty)`);
    }
    
    ws.roomId = null;
}

// Pose data with performance metrics
function handlePoseData(ws, message) {
    const now = Date.now();
    const latency = now - (message.timestamp || now);
    
    deviceMetrics.messagesSent++;
    
    if (ws.roomId) {
        // Add server metrics
        const enhancedMessage = {
            ...message,
            serverMetrics: {
                receivedAt: now,
                latency: latency,
                processingTime: Date.now() - now
            }
        };
        
        broadcastToRoom(ws.roomId, enhancedMessage, ws.sessionId);
        
        // Log high-frequency data occasionally
        if (deviceMetrics.messagesSent % 100 === 0) {
            console.log(`📊 Pose data: ${deviceMetrics.messagesSent} messages, avg latency: ${latency}ms`);
        }
    }
}

// Development statistics
function sendStats(ws) {
    const stats = {
        type: 'stats',
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            platform: process.platform,
            nodeVersion: process.version
        },
        connections: {
            current: deviceMetrics.currentConnections,
            total: deviceMetrics.totalConnections,
            rooms: rooms.size
        },
        messages: {
            sent: deviceMetrics.messagesSent,
            received: deviceMetrics.messagesReceived
        },
        rooms: Array.from(rooms.entries()).map(([id, room]) => ({
            id,
            participants: room.participants.size,
            created: room.created
        }))
    };
    
    send(ws, stats);
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
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function generateRoomId() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Keepalive
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

// Start server with network info
server.listen(PORT, HOST, () => {
    const localIPs = getLocalIPs();
    
    console.log('\n🚀 LOCAL WEBSOCKET SERVER STARTED');
    console.log('=====================================');
    console.log(`📍 Host: ${HOST}:${PORT}`);
    console.log('🌐 Access URLs:');
    
    localIPs.forEach(ip => {
        console.log(`   📱 Mobile/VR: ws://${ip}:${PORT}/ws`);
        console.log(`   🌍 Browser:   http://${ip}:${PORT}`);
    });
    
    console.log('\n📲 Quick Connect:');
    console.log(`   curl http://localhost:${PORT}/qr  # Generate QR code`);
    console.log('\n⚡ Development Features:');
    console.log('   • Real-time connection logging');
    console.log('   • Room management with pairing detection');
    console.log('   • Performance metrics and statistics');
    console.log('   • Cross-device compatibility testing');
    console.log('\n✨ Ready for device connections!\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down server...');
    
    // Close all connections
    wss.clients.forEach(ws => {
        ws.close(1001, 'Server shutting down');
    });
    
    server.close(() => {
        console.log('✅ Server closed gracefully');
        process.exit(0);
    });
});

module.exports = { app, server };