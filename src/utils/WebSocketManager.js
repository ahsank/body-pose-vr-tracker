// Enhanced WebSocketManager with cloud service support
export class WebSocketManager {
    constructor() {
        this.ws = null
        this.isConnected = false
        this.reconnectAttempts = 0
        this.maxReconnectAttempts = 5
        this.reconnectDelay = 1000
        this.sessionId = this.generateSessionId()
        this.deviceType = this.detectDeviceType()
        
        // Cloud service configurations
        this.cloudServices = {
            cloudflare: 'wss://pose-tracker.your-domain.workers.dev',
            //ngrok: 'wss://abc123.ngrok.io',
            railway: 'wss://your-app.railway.app',
            custom: 'wss://your-custom-server.com',
            local: 'ws://192.168.86.208:8080/ws'
        }
    }
    
    // Auto-detect device type
    detectDeviceType() {
        const userAgent = navigator.userAgent.toLowerCase()
        
        if (/mobile|android|iphone|ipad/.test(userAgent)) {
            return 'mobile'
        } else if (/oculus|quest|vr/.test(userAgent)) {
            return 'vr'
        } else {
            return 'desktop'
        }
    }
    
    // Generate unique session ID for pairing devices
    generateSessionId() {
        return Math.random().toString(36).substr(2, 9)
    }
    
    // Connect with room/session support
    async connect(service = 'ngrok', roomId = null) {
        const wsUrl = this.cloudServices[service]
        if (!wsUrl) {
            console.error('Invalid cloud service:', service)
            return
        }
        
        try {
            // Add session parameters
            const url = new URL(wsUrl)
            url.searchParams.set('sessionId', this.sessionId)
            url.searchParams.set('deviceType', this.deviceType)
            if (roomId) url.searchParams.set('roomId', roomId)
            
            this.ws = new WebSocket(url.toString())
            
            this.ws.onopen = () => {
                this.isConnected = true
                this.reconnectAttempts = 0
                this.updateConnectionStatus('Connected', '#4CAF50')
                
                // Send device registration
                this.sendMessage({
                    type: 'device_register',
                    deviceType: this.deviceType,
                    sessionId: this.sessionId,
                    capabilities: this.getDeviceCapabilities()
                })
                
                console.log('WebSocket connected to', service)
            }
            
            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data))
            }
            
            this.ws.onclose = () => {
                this.handleDisconnection()
            }
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error)
                this.handleDisconnection()
            }
            
        } catch (error) {
            console.error('Connection error:', error)
            this.handleDisconnection()
        }
    }
    
    // Get device capabilities for better pairing
    getDeviceCapabilities() {
        return {
            camera: !!navigator.mediaDevices,
            webxr: !!navigator.xr,
            orientation: !!window.DeviceOrientationEvent,
            battery: !!navigator.getBattery,
            vibrate: !!navigator.vibrate,
            screen: {
                width: screen.width,
                height: screen.height,
                pixelRatio: window.devicePixelRatio
            }
        }
    }
    
    // Handle incoming messages with routing
    handleMessage(data) {
        switch (data.type) {
            case 'pose_data':
                this.onPoseData?.(data.landmarks, data.metadata)
                break
                
            case 'device_paired':
                this.onDevicePaired?.(data.pairedDevice)
                this.updateConnectionStatus(`Paired with ${data.pairedDevice.type}`, '#2196F3')
                break
                
            case 'room_joined':
                this.onRoomJoined?.(data.roomId, data.participants)
                break
                
            case 'sync_request':
                this.handleSyncRequest(data)
                break
                
            case 'error':
                console.error('Server error:', data.message)
                break
                
            default:
                console.log('Unknown message type:', data.type)
        }
    }
    
    // Send pose data with enhanced metadata
    sendPoseData(landmarks) {
        if (!this.isConnected || !this.ws) return
        
        const message = {
            type: 'pose_data',
            sessionId: this.sessionId,
            deviceType: this.deviceType,
            timestamp: Date.now(),
            landmarks: this.serializeLandmarks(landmarks),
            metadata: {
                confidence: this.calculateAverageConfidence(landmarks),
                frameRate: this.getCurrentFPS(),
                deviceOrientation: this.getDeviceOrientation(),
                batteryLevel: this.getBatteryLevel()
            }
        }
        
        this.sendMessage(message)
    }
    
    // Enhanced landmark serialization
    serializeLandmarks(landmarks) {
        return landmarks.map((landmark, index) => ({
            id: index,
            x: Math.round(landmark.x * 1000) / 1000,
            y: Math.round(landmark.y * 1000) / 1000,
            z: Math.round(landmark.z * 1000) / 1000,
            visibility: Math.round(landmark.visibility * 1000) / 1000,
            name: this.getLandmarkName(index)
        }))
    }
    
    // Get landmark names for better debugging
    getLandmarkName(index) {
        const landmarkNames = [
            'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer',
            'right_eye_inner', 'right_eye', 'right_eye_outer', 'left_ear',
            'right_ear', 'mouth_left', 'mouth_right', 'left_shoulder',
            'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist',
            'right_wrist', 'left_pinky', 'right_pinky', 'left_index',
            'right_index', 'left_thumb', 'right_thumb', 'left_hip',
            'right_hip', 'left_knee', 'right_knee', 'left_ankle',
            'right_ankle', 'left_heel', 'right_heel', 'left_foot_index',
            'right_foot_index'
        ]
        return landmarkNames[index] || `landmark_${index}`
    }
    
    // Calculate pose confidence
    calculateAverageConfidence(landmarks) {
        const validLandmarks = landmarks.filter(l => l.visibility > 0.5)
        if (validLandmarks.length === 0) return 0
        return validLandmarks.reduce((sum, l) => sum + l.visibility, 0) / validLandmarks.length
    }
    
    // Get device orientation for better pose interpretation
    getDeviceOrientation() {
        if (screen.orientation) {
            return screen.orientation.angle
        }
        return window.orientation || 0
    }
    
    // Get battery level if available
    getBatteryLevel() {
        // This would need to be implemented with the Battery API
        return navigator.battery?.level || null
    }
    
    // Generic message sender
    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message))
        }
    }
    
    // Join or create a room for device pairing
    joinRoom(roomId) {
        this.sendMessage({
            type: 'join_room',
            roomId: roomId,
            sessionId: this.sessionId,
            deviceType: this.deviceType
        })
    }
    
    // Request sync with paired device
    requestSync() {
        this.sendMessage({
            type: 'sync_request',
            sessionId: this.sessionId,
            timestamp: Date.now()
        })
    }
    
    // Handle sync requests from other devices
    handleSyncRequest(data) {
        // Respond with current state
        this.sendMessage({
            type: 'sync_response',
            targetSession: data.sessionId,
            currentState: {
                isDetecting: window.poseTracker?.isDetecting || false,
                currentMode: window.poseTracker?.currentMode || '2D',
                lastPoseTime: Date.now()
            }
        })
    }
    
    // Enhanced disconnection handling
    handleDisconnection() {
        this.isConnected = false
        this.updateConnectionStatus('Disconnected', '#f44336')
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                this.reconnectAttempts++
                this.updateConnectionStatus(
                    `Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 
                    '#ff9800'
                )
                this.connect()
            }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts)) // Exponential backoff
        } else {
            this.updateConnectionStatus('Connection Failed', '#f44336')
        }
    }
    
    // Connection status UI update
    updateConnectionStatus(status, color) {
        const statusElement = document.getElementById('connectionStatus')
        if (statusElement) {
            statusElement.textContent = status
            statusElement.style.color = color
        }
        
        // Also update document title for debugging
        document.title = `Pose Tracker - ${status}`
    }
    
    // Event handlers (to be set by application)
    onPoseData = null
    onDevicePaired = null
    onRoomJoined = null
    
    // Cleanup
    disconnect() {
        if (this.ws) {
            this.ws.close()
            this.ws = null
        }
        this.isConnected = false
        this.updateConnectionStatus('Disconnected', '#f44336')
    }
    
    // Get current FPS (would need to be implemented)
    getCurrentFPS() {
        return window.poseTracker?.frameCount || 0
    }
}

// Simple Room Management UI Component
export class RoomManager {
    constructor(wsManager) {
        this.wsManager = wsManager
        this.currentRoom = null
        this.createUI()
    }
    
    createUI() {
        const roomUI = document.createElement('div')
        roomUI.className = 'room-manager'
        roomUI.innerHTML = `
            <div class="room-controls">
                <h4>Device Pairing</h4>
                <input type="text" id="roomIdInput" placeholder="Enter room code" maxlength="6">
                <button id="createRoomBtn">Create Room</button>
                <button id="joinRoomBtn">Join Room</button>
                <div id="roomStatus">Not in room</div>
                <div id="pairedDevices"></div>
            </div>
        `
        
        // Add to controls
        const controls = document.querySelector('.controls')
        if (controls) {
            controls.appendChild(roomUI)
        }
        
        this.setupEventListeners()
    }
    
    setupEventListeners() {
        document.getElementById('createRoomBtn')?.addEventListener('click', () => {
            this.createRoom()
        })
        
        document.getElementById('joinRoomBtn')?.addEventListener('click', () => {
            const roomId = document.getElementById('roomIdInput').value
            if (roomId) {
                this.joinRoom(roomId)
            }
        })
    }
    
    createRoom() {
        const roomId = Math.random().toString(36).substr(2, 6).toUpperCase()
        document.getElementById('roomIdInput').value = roomId
        this.joinRoom(roomId)
    }
    
    joinRoom(roomId) {
        this.currentRoom = roomId
        this.wsManager.joinRoom(roomId)
        document.getElementById('roomStatus').textContent = `Room: ${roomId}`
        
        // Set up event handlers
        this.wsManager.onRoomJoined = (roomId, participants) => {
            this.updateParticipants(participants)
        }
        
        this.wsManager.onDevicePaired = (device) => {
            this.showPairedDevice(device)
        }
    }
    
    updateParticipants(participants) {
        const container = document.getElementById('pairedDevices')
        if (container) {
            container.innerHTML = participants.map(p => 
                `<div class="participant">${p.deviceType} - ${p.sessionId}</div>`
            ).join('')
        }
    }
    
    showPairedDevice(device) {
        console.log('Paired with device:', device)
        // Could show notification or update UI
    }
}
