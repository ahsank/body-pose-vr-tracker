import './style.css'
import 'aframe'
import { PoseTracker } from './components/PoseTracker.js'
import { registerSW } from 'virtual:pwa-register'

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  const poseTracker = new PoseTracker()
  
  // Add to global scope for debugging
  window.poseTracker = poseTracker
})
