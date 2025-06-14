export class VRRenderer {
    constructor() {
        this.poseContainer = null
        this.initialized = false
    }
    
    init() {
        if (this.initialized) return
        
        this.poseContainer = document.getElementById('poseContainer')
        if (!this.poseContainer) {
            console.error('Pose container not found')
            return
        }
        
        this.initialized = true
    }
    
    updatePose(landmarks) {
        if (!this.initialized) this.init()
        if (!this.poseContainer) return
        
        // Clear existing pose
        this.clearPose()
        
        // Create new pose visualization
        this.createJoints(landmarks)
        this.createConnections(landmarks)
    }
    
    clearPose() {
        const existingElements = this.poseContainer.querySelectorAll('.pose-joint, .pose-bone')
        existingElements.forEach(el => el.remove())
    }
    
    createJoints(landmarks) {
        const keyPoints = [
            { idx: 11, name: 'left_shoulder', color: '#FF4444' },
            { idx: 12, name: 'right_shoulder', color: '#FF4444' },
            { idx: 13, name: 'left_elbow', color: '#44FF44' },
            { idx: 14, name: 'right_elbow', color: '#44FF44' },
            { idx: 15, name: 'left_wrist', color: '#4444FF' },
            { idx: 16, name: 'right_wrist', color: '#4444FF' },
            { idx: 23, name: 'left_hip', color: '#FFFF44' },
            { idx: 24, name: 'right_hip', color: '#FFFF44' },
            { idx: 25, name: 'left_knee', color: '#FF44FF' },
            { idx: 26, name: 'right_knee', color: '#FF44FF' },
            { idx: 27, name: 'left_ankle', color: '#44FFFF' },
            { idx: 28, name: 'right_ankle', color: '#44FFFF' }
        ]
        
        keyPoints.forEach(point => {
            const landmark = landmarks[point.idx]
            if (landmark && landmark.visibility > 0.5) {
                const joint = this.createJointElement(landmark, point.color, point.name)
                this.poseContainer.appendChild(joint)
            }
        })
    }
    
    createJointElement(landmark, color, name) {
        const joint = document.createElement('a-entity')
        joint.setAttribute('class', 'pose-joint')
        joint.setAttribute('geometry', 'primitive: sphere; radius: 0.025')
        joint.setAttribute('material', `color: ${color}; emissive: ${color}; emissiveIntensity: 0.5; metalness: 0.1; roughness: 0.1`)
        joint.setAttribute('position', this.landmarkToPosition(landmark))
        joint.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 6000; easing: linear')
        joint.setAttribute('data-name', name)
        
        // Add hover effect
        joint.addEventListener('mouseenter', () => {
            joint.setAttribute('scale', '1.5 1.5 1.5')
        })
        joint.addEventListener('mouseleave', () => {
            joint.setAttribute('scale', '1 1 1')
        })
        
        return joint
    }
    
    createConnections(landmarks) {
        const connections = [
            { start: 11, end: 12, color: '#FF6666' }, // Shoulders
            { start: 11, end: 13, color: '#66FF66' }, // Left arm
            { start: 12, end: 14, color: '#66FF66' }, // Right arm
            { start: 13, end: 15, color: '#6666FF' }, // Left forearm
            { start: 14, end: 16, color: '#6666FF' }, // Right forearm
            { start: 11, end: 23, color: '#FFFF66' }, // Left torso
            { start: 12, end: 24, color: '#FFFF66' }, // Right torso
            { start: 23, end: 24, color: '#FF66FF' }, // Hips
            { start: 23, end: 25, color: '#66FFFF' }, // Left thigh
            { start: 24, end: 26, color: '#66FFFF' }, // Right thigh
            { start: 25, end: 27, color: '#FFB366' }, // Left shin
            { start: 26, end: 28, color: '#FFB366' }  // Right shin
        ]
        
        connections.forEach(connection => {
            const startLandmark = landmarks[connection.start]
            const endLandmark = landmarks[connection.end]
            
            if (startLandmark && endLandmark && 
                startLandmark.visibility > 0.5 && endLandmark.visibility > 0.5) {
                
                const bone = this.createBoneElement(startLandmark, endLandmark, connection.color)
                this.poseContainer.appendChild(bone)
            }
        })
    }
    
    createBoneElement(startLandmark, endLandmark, color) {
        const startPos = this.landmarkToVector(startLandmark)
        const endPos = this.landmarkToVector(endLandmark)
        
        const midPoint = [
            (startPos[0] + endPos[0]) / 2,
            (startPos[1] + endPos[1]) / 2,
            (startPos[2] + endPos[2]) / 2
        ]
        
        const distance = Math.sqrt(
            Math.pow(endPos[0] - startPos[0], 2) +
            Math.pow(endPos[1] - startPos[1], 2) +
            Math.pow(endPos[2] - startPos[2], 2)
        )
        
        const bone = document.createElement('a-entity')
        bone.setAttribute('class', 'pose-bone')
        bone.setAttribute('geometry', `primitive: cylinder; radius: 0.008; height: ${distance}`)
        bone.setAttribute('material', `color: ${color}; emissive: ${color}; emissiveIntensity: 0.3; metalness: 0.2; roughness: 0.2`)
        bone.setAttribute('position', `${midPoint[0]} ${midPoint[1]} ${midPoint[2]}`)
        
        // Calculate rotation to align with connection
        const direction = [
            endPos[0] - startPos[0],
            endPos[1] - startPos[1],
            endPos[2] - startPos[2]
        ]
        
        const length = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2])
        if (length > 0) {
            const normalizedDir = direction.map(d => d / length)
            
            // Calculate rotation angles
            const rotationX = Math.asin(normalizedDir[2]) * 180 / Math.PI
            const rotationY = Math.atan2(normalizedDir[0], normalizedDir[1]) * 180 / Math.PI
            
            bone.setAttribute('rotation', `${rotationX} ${rotationY} 0`)
        }
        
        return bone
    }
    
    landmarkToPosition(landmark) {
        return `${(landmark.x - 0.5) * 4} ${(0.5 - landmark.y) * 3} ${landmark.z * 2}`
    }
    
    landmarkToVector(landmark) {
        return [
            (landmark.x - 0.5) * 4,
            (0.5 - landmark.y) * 3,
            landmark.z * 2
        ]
    }
    
    createGrid() {
        const grid = document.getElementById('grid')
        if (!grid) return
        
        const size = 5
        const divisions = 10
        const lineColor = '#444444'
        const emissiveColor = '#222222'
        
        // Create grid lines
        for (let i = 0; i <= divisions; i++) {
            const pos = (i / divisions - 0.5) * size * 2
            
            // X-axis lines (running along Z)
            const lineX = document.createElement('a-entity')
            lineX.setAttribute('geometry', `primitive: cylinder; radius: 0.002; height: ${size * 2}`)
            lineX.setAttribute('material', `color: ${lineColor}; emissive: ${emissiveColor}; emissiveIntensity: 0.2`)
            lineX.setAttribute('position', `${pos} -1 0`)
            lineX.setAttribute('rotation', '0 0 90')
            grid.appendChild(lineX)
            
            // Z-axis lines (running along X)
            const lineZ = document.createElement('a-entity')
            lineZ.setAttribute('geometry', `primitive: cylinder; radius: 0.002; height: ${size * 2}`)
            lineZ.setAttribute('material', `color: ${lineColor}; emissive: ${emissiveColor}; emissiveIntensity: 0.2`)
            lineZ.setAttribute('position', `0 -1 ${pos}`)
            lineZ.setAttribute('rotation', '90 0 0')
            grid.appendChild(lineZ)
        }
        
        // Add center axes with different colors
        const centerX = document.createElement('a-entity')
        centerX.setAttribute('geometry', `primitive: cylinder; radius: 0.004; height: ${size * 2}`)
        centerX.setAttribute('material', 'color: #FF4444; emissive: #FF2222; emissiveIntensity: 0.3')
        centerX.setAttribute('position', '0 -1 0')
        centerX.setAttribute('rotation', '0 0 90')
        grid.appendChild(centerX)
        
        const centerZ = document.createElement('a-entity')
        centerZ.setAttribute('geometry', `primitive: cylinder; radius: 0.004; height: ${size * 2}`)
        centerZ.setAttribute('material', 'color: #4444FF; emissive: #2222FF; emissiveIntensity: 0.3')
        centerZ.setAttribute('position', '0 -1 0')
        centerZ.setAttribute('rotation', '90 0 0')
        grid.appendChild(centerZ)
    }
}
