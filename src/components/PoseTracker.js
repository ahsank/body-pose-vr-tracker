import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { WebSocketManager, RoomManager } from '../utils/WebSocketManager.js'
import { VRRenderer } from '../utils/VRRenderer.js'
import { CanvasRenderer } from '../utils/CanvasRenderer.js'



export class PoseTracker {
    constructor() {
        this.video = document.getElementById('videoElement')
        this.canvas = document.getElementById('canvas')
        this.ctx = this.canvas.getContext('2d')
        
        this.poseLandmarker = null
        this.isDetecting = false
        this.poseCount = 0
        this.lastTime = performance.now()
        this.frameCount = 0
        this.stream = null
        
        this.currentMode = '2D'
        
        // Initialize utilities
        this.wsManager = new WebSocketManager()
        this.vrRenderer = new VRRenderer()
        this.canvasRenderer = new CanvasRenderer(this.ctx)
        // In PoseTracker constructor
        this.wsManager = new WebSocketManager()
        this.roomManager = new RoomManager(this.wsManager)

        this.init()
    }
    
    async init() {
        try {
            await this.setupMediaPipe()
            this.setupEventListeners()
            this.vrRenderer.createGrid()
            this.updateStatus('Ready to start')
            // Connect to cloud service
            await this.wsManager.connect('local') // or 'cloudflare'

            // Set up pose data handler
            this.wsManager.onPoseData = (landmarks, metadata) => {
                if (this.wsManager.deviceType === 'vr') {
                    // Receive pose data from phone
                    this.vrRenderer.updatePose(landmarks)
                }
            }
        } catch (error) {
            console.error('Initialization error:', error)
            this.updateStatus('Initialization failed')
        }
    }
    
    async setupMediaPipe() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            )
            
            this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numPoses: 1,
                minPoseDetectionConfidence: 0.5,
                minPosePresenceConfidence: 0.5,
                minTrackingConfidence: 0.5,
                outputSegmentationMasks: false
            })
            
            console.log('MediaPipe Tasks-Vision initialized successfully')
        } catch (error) {
            console.error('MediaPipe setup error:', error)
            throw error
        }
    }
    
    setupEventListeners() {
        document.getElementById('startCamera').addEventListener('click', () => this.startCamera())
        document.getElementById('stopCamera').addEventListener('click', () => this.stopCamera())
        document.getElementById('togglePoseDetection').addEventListener('click', () => this.togglePoseDetection())
        document.getElementById('mode2D').addEventListener('click', () => this.switchMode('2D'))
        document.getElementById('mode3D').addEventListener('click', () => this.switchMode('3D'))
        
        window.addEventListener('resize', () => this.resizeCanvas())
        window.addEventListener('beforeunload', () => this.cleanup())
    }
    
    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    facingMode: 'user',
                    frameRate: { ideal: 30 }
                },
                audio: false
            })
            
            this.video.srcObject = this.stream
            
            await new Promise((resolve) => {
                this.video.addEventListener('loadedmetadata', resolve, { once: true })
            })
            
            this.resizeCanvas()
            this.updateStatus('Camera started')
            
            document.getElementById('startCamera').disabled = true
            document.getElementById('stopCamera').disabled = false
            document.getElementById('togglePoseDetection').disabled = false
            
            // Simulate WebSocket connection
            //this.wsManager.connect()
            
        } catch (error) {
            console.error('Camera access error:', error)
            this.updateStatus('Camera access denied')
        }
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop())
            this.video.srcObject = null
            this.stream = null
        }
        
        this.stopPoseDetection()
        this.wsManager.disconnect()
        
        this.updateStatus('Camera stopped')
        document.getElementById('startCamera').disabled = false
        document.getElementById('stopCamera').disabled = true
        document.getElementById('togglePoseDetection').disabled = true
    }
    
    togglePoseDetection() {
        if (this.isDetecting) {
            this.stopPoseDetection()
        } else {
            this.startPoseDetection()
        }
    }
    
    startPoseDetection() {
        if (!this.poseLandmarker) {
            this.updateStatus('MediaPipe not initialized')
            return
        }
        
        this.isDetecting = true
        this.updateStatus('Detecting poses...')
        document.getElementById('togglePoseDetection').textContent = 'Stop Detection'
        
        this.detectPose()
    }
    
    stopPoseDetection() {
        this.isDetecting = false
        this.updateStatus('Detection stopped')
        document.getElementById('togglePoseDetection').textContent = 'Start Pose Detection'
    }
    
    async detectPose() {
        if (!this.isDetecting || !this.video || this.video.readyState !== 4) {
            if (this.isDetecting) {
                requestAnimationFrame(() => this.detectPose())
            }
            return
        }
        
        try {
            const timestamp = performance.now()
            const results = await this.poseLandmarker.detectForVideo(this.video, timestamp)
            
            this.frameCount++
            const currentTime = performance.now()
            
            // Update FPS counter
            if (currentTime - this.lastTime >= 1000) {
                document.getElementById('fpsCounter').textContent = this.frameCount
                this.frameCount = 0
                this.lastTime = currentTime
            }
            
            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
            
            if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0]
                this.poseCount++
                document.getElementById('poseCounter').textContent = this.poseCount
                
                // Draw 2D pose
                this.canvasRenderer.drawPose(landmarks, this.canvas.width, this.canvas.height)
                
                // Update 3D pose
                if (this.currentMode === '3D') {
                    this.vrRenderer.updatePose(landmarks)
                }
                
                // Send pose data via WebSocket
                this.wsManager.sendPoseData(landmarks)
            }
            
        } catch (error) {
            console.error('Pose detection error:', error)
        }
        
        if (this.isDetecting) {
            requestAnimationFrame(() => this.detectPose())
        }
    }
    
    switchMode(mode) {
        this.currentMode = mode
        
        const cameraContainer = document.querySelector('.camera-container')
        const vrContainer = document.getElementById('vrContainer')
        const mode2DBtn = document.getElementById('mode2D')
        const mode3DBtn = document.getElementById('mode3D')
        
        if (mode === '2D') {
            cameraContainer.classList.remove('hidden')
            vrContainer.classList.add('hidden')
            mode2DBtn.classList.add('active')
            mode3DBtn.classList.remove('active')
        } else {
            cameraContainer.classList.add('hidden')
            vrContainer.classList.remove('hidden')
            mode2DBtn.classList.remove('active')
            mode3DBtn.classList.add('active')
        }
    }
    
    resizeCanvas() {
        if (this.video.videoWidth && this.video.videoHeight) {
            this.canvas.width = this.video.videoWidth
            this.canvas.height = this.video.videoHeight
        }
    }
    
    updateStatus(message) {
        document.getElementById('statusText').textContent = message
    }
    
    cleanup() {
        this.stopCamera()
        this.wsManager.disconnect()
    }
}
