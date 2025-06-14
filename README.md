# Body Pose VR Tracker

A real-time body pose tracking application with VR visualization built using Vite, MediaPipe Tasks-Vision API, and A-Frame.

## Features

- 📱 **Cross-platform PWA** - Works on mobile and desktop browsers
- 🤖 **Real-time pose detection** - Using MediaPipe Tasks-Vision API
- 🎮 **Dual view modes** - 2D camera overlay and 3D VR visualization
- 🌐 **WebXR/VR support** - Immersive VR experience with A-Frame
- 📡 **WebSocket integration** - Real-time data transmission (simulated)
- ⚡ **High performance** - GPU-accelerated processing
- 🎨 **Modern UI** - Responsive design with glassmorphism effects

## Technology Stack

- **Frontend Framework**: Vanilla JS with Vite
- **Pose Detection**: MediaPipe Tasks-Vision API
- **3D/VR Rendering**: A-Frame
- **Build Tool**: Vite with PWA plugin
- **Real-time Communication**: WebSocket (simulated)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd body-pose-vr-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Open \`http://localhost:3000\` in your browser
   - For mobile testing, use \`http://[your-ip]:3000\`

## Usage

### Basic Usage
1. Click "Start Camera" to enable camera access
2. Click "Start Pose Detection" to begin real-time tracking
3. Switch between "2D View" and "3D/VR View" modes
4. In 3D mode, click the VR button for immersive experience

### Controls
- **2D Mode**: View camera feed with pose overlay
- **3D Mode**: Navigate with mouse/touch, WASD keys for movement
- **VR Mode**: Use VR controllers or gaze-based interaction

## Project Structure

```
src/
├── main.js                 # Application entry point
├── style.css              # Global styles
├── components/
│   └── PoseTracker.js     # Main pose tracking class
└── utils/
    ├── WebSocketManager.js # WebSocket communication
    ├── VRRenderer.js      # 3D/VR pose visualization
    └── CanvasRenderer.js  # 2D canvas pose drawing
```

## Configuration

### MediaPipe Settings
The pose detection can be configured in \`PoseTracker.js\`:

```javascript
const options = {
    baseOptions: {
        modelAssetPath: "pose_landmarker_lite.task",
        delegate: "GPU" // or "CPU"
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
}
```

### WebSocket Configuration
Update the WebSocket URL in \`WebSocketManager.js\`:

```javascript
connect(url = 'ws://your-server:8080')
```

## Building for Production

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Preview the build**

```bash
   npm run preview
```

3. **Deploy the `dist` folder** to your hosting service

## CloudRun deploy

```bash
# Install Google Cloud CLI
# https://cloud.google.com/sdk/docs/install

# Build and deploy to Cloud Run
gcloud run deploy pose-tracker-websocket \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600 \
  --concurrency 1000 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production

# Your WebSocket URL will be:
# wss://pose-tracker-websocket-[hash]-uc.a.run.app/ws
```

## PWA Features

- **Offline support** - Works without internet connection
- **Install prompt** - Can be installed as a native app
- **Service worker** - Automatic updates and caching

## Browser Compatibility

- **Modern browsers** with WebRTC and WebGL support
- **Mobile browsers** - iOS Safari 14+, Android Chrome 90+
- **Desktop browsers** - Chrome 90+, Firefox 88+, Safari 14+
- **VR browsers** - Oculus Browser, Firefox Reality

## Performance Optimization

- **GPU acceleration** - MediaPipe uses GPU when available
- **Efficient rendering** - A-Frame optimizations for VR
- **Code splitting** - Separate chunks for MediaPipe and A-Frame
- **Asset optimization** - Compressed models and textures

## Real WebSocket Server Setup

To implement a real WebSocket server, create a Node.js server:

```javascript
// server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    ws.on('message', (data) => {
        const poseData = JSON.parse(data);
        // Process pose data
        console.log('Received pose data:', poseData);
        
        // Broadcast to all clients
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(poseData));
            }
        });
    });
});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Troubleshooting

### Common Issues

1. **Camera not working**
   - Check browser permissions
   - Ensure HTTPS in production
   - Try different browsers

2. **Pose detection not starting**
   - Check console for MediaPipe errors
   - Verify internet connection for model download
   - Try refreshing the page

3. **Poor performance**
   - Switch to CPU delegate if GPU issues
   - Lower camera resolution
   - Close other browser tabs

4. **VR not working**
   - Check WebXR support in browser
   - Ensure VR device is connected
   - Try desktop browser first

### Browser Developer Tools

- Use console for debugging pose data
- Network tab to verify model loading
- Performance tab for optimization

## Future Enhancements

- [ ] Multi-person pose tracking
- [ ] Pose analysis and feedback
- [ ] Exercise form checking
- [ ] Cloud recording and playback
- [ ] Real-time multiplayer sessions
- [ ] AI-powered pose coaching
- [ ] Integration with fitness apps

## Support

For issues and questions:
- Check the troubleshooting section
- Review browser console errors
- Open an issue on GitHub
- Check MediaPipe documentation
