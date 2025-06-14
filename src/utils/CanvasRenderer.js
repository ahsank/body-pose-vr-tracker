export class CanvasRenderer {
    constructor(ctx) {
        this.ctx = ctx
        this.connections = [
            // Face outline (simplified)
            [0, 1], [1, 2], [2, 3], [3, 7],
            [0, 4], [4, 5], [5, 6], [6, 8],
            
            // Body connections
            [11, 12], // Shoulders
            [11, 23], [12, 24], // Shoulder to hip
            [23, 24], // Hips
            
            // Arms
            [11, 13], [13, 15], // Left arm
            [12, 14], [14, 16], // Right arm
            [15, 17], [15, 19], [15, 21], // Left hand
            [16, 18], [16, 20], [16, 22], // Right hand
            
            // Legs
            [23, 25], [25, 27], [27, 29], [27, 31], // Left leg
            [24, 26], [26, 28], [28, 30], [28, 32], // Right leg
        ]
        
        this.jointColors = {
            // Face
            0: '#FFD700', 1: '#FFD700', 2: '#FFD700', 3: '#FFD700',
            4: '#FFD700', 5: '#FFD700', 6: '#FFD700', 7: '#FFD700', 8: '#FFD700',
            9: '#FFD700', 10: '#FFD700',
            
            // Arms
            11: '#FF4444', 12: '#FF4444', // Shoulders
            13: '#44FF44', 14: '#44FF44', // Elbows
            15: '#4444FF', 16: '#4444FF', // Wrists
            17: '#FF44FF', 18: '#FF44FF', 19: '#FF44FF', 20: '#FF44FF', // Hands
            21: '#FF44FF', 22: '#FF44FF',
            
            // Body
            23: '#FFFF44', 24: '#FFFF44', // Hips
            
            // Legs
            25: '#44FFFF', 26: '#44FFFF', // Knees
            27: '#FFB344', 28: '#FFB344', // Ankles
            29: '#FF8844', 30: '#FF8844', 31: '#FF8844', 32: '#FF8844' // Feet
        }
    }
    
    drawPose(landmarks, canvasWidth, canvasHeight) {
        // Draw connections first (behind joints)
        this.drawConnections(landmarks, canvasWidth, canvasHeight)
        
        // Draw joints on top
        this.drawJoints(landmarks, canvasWidth, canvasHeight)
        
        // Draw pose confidence indicator
        this.drawConfidenceIndicator(landmarks, canvasWidth, canvasHeight)
    }
    
    drawConnections(landmarks, canvasWidth, canvasHeight) {
        this.ctx.lineWidth = 4
        this.ctx.lineCap = 'round'
        
        this.connections.forEach(([startIdx, endIdx]) => {
            const startPoint = landmarks[startIdx]
            const endPoint = landmarks[endIdx]
            
            if (startPoint && endPoint && 
                startPoint.visibility > 0.5 && endPoint.visibility > 0.5) {
                
                // Color based on confidence
                const avgConfidence = (startPoint.visibility + endPoint.visibility) / 2
                const alpha = Math.max(0.3, avgConfidence)
                
                // Use gradient for more visual appeal
                const gradient = this.ctx.createLinearGradient(
                    startPoint.x * canvasWidth, startPoint.y * canvasHeight,
                    endPoint.x * canvasWidth, endPoint.y * canvasHeight
                )
                
                gradient.addColorStop(0, this.getConnectionColor(startIdx, alpha))
                gradient.addColorStop(1, this.getConnectionColor(endIdx, alpha))
                
                this.ctx.strokeStyle = gradient
                
                this.ctx.beginPath()
                this.ctx.moveTo(startPoint.x * canvasWidth, startPoint.y * canvasHeight)
                this.ctx.lineTo(endPoint.x * canvasWidth, endPoint.y * canvasHeight)
                this.ctx.stroke()
            }
        })
    }
    
    drawJoints(landmarks, canvasWidth, canvasHeight) {
        landmarks.forEach((landmark, index) => {
            if (landmark.visibility > 0.5) {
                const x = landmark.x * canvasWidth
                const y = landmark.y * canvasHeight
                const confidence = landmark.visibility
                
                // Joint size based on confidence
                const radius = 6 + (confidence - 0.5) * 8
                
                // Outer circle (shadow)
                this.ctx.beginPath()
                this.ctx.arc(x + 1, y + 1, radius + 1, 0, 2 * Math.PI)
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
                this.ctx.fill()
                
                // Main joint circle
                this.ctx.beginPath()
                this.ctx.arc(x, y, radius, 0, 2 * Math.PI)
                
                // Use specific color for joint or default
                const color = this.jointColors[index] || '#FFFFFF'
                this.ctx.fillStyle = this.addAlpha(color, confidence)
                this.ctx.fill()
                
                // Inner highlight
                this.ctx.beginPath()
                this.ctx.arc(x - radius/3, y - radius/3, radius/3, 0, 2 * Math.PI)
                this.ctx.fillStyle = this.addAlpha('#FFFFFF', confidence * 0.6)
                this.ctx.fill()
                
                // Border
                this.ctx.beginPath()
                this.ctx.arc(x, y, radius, 0, 2 * Math.PI)
                this.ctx.strokeStyle = this.addAlpha('#000000', confidence * 0.8)
                this.ctx.lineWidth = 2
                this.ctx.stroke()
            }
        })
    }
    
    drawConfidenceIndicator(landmarks, canvasWidth, canvasHeight) {
        // Calculate average confidence
        const validLandmarks = landmarks.filter(l => l.visibility > 0.5)
        if (validLandmarks.length === 0) return
        
        const avgConfidence = validLandmarks.reduce((sum, l) => sum + l.visibility, 0) / validLandmarks.length
        
        // Draw confidence bar
        const barWidth = 200
        const barHeight = 20
        const barX = canvasWidth - barWidth - 20
        const barY = 20
        
        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        this.ctx.fillRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10)
        
        // Confidence bar
        const confidence = Math.round(avgConfidence * 100)
        const fillWidth = (confidence / 100) * barWidth
        
        // Color based on confidence level
        let color = '#FF4444' // Low confidence - red
        if (confidence > 70) color = '#44FF44' // High confidence - green
        else if (confidence > 50) color = '#FFFF44' // Medium confidence - yellow
        
        this.ctx.fillStyle = color
        this.ctx.fillRect(barX, barY, fillWidth, barHeight)
        
        // Border
        this.ctx.strokeStyle = '#FFFFFF'
        this.ctx.lineWidth = 1
        this.ctx.strokeRect(barX, barY, barWidth, barHeight)
        
        // Text
        this.ctx.fillStyle = '#FFFFFF'
        this.ctx.font = '14px Arial'
        this.ctx.textAlign = 'center'
        this.ctx.fillText(`Confidence: ${confidence}%`, barX + barWidth/2, barY + barHeight + 20)
        
        // Landmark count
        this.ctx.fillText(`Landmarks: ${validLandmarks.length}/${landmarks.length}`, barX + barWidth/2, barY + barHeight + 40)
    }
    
    getConnectionColor(jointIndex, alpha) {
        const baseColor = this.jointColors[jointIndex] || '#00FF00'
        return this.addAlpha(baseColor, alpha)
    }
    
    addAlpha(hexColor, alpha) {
        const r = parseInt(hexColor.slice(1, 3), 16)
        const g = parseInt(hexColor.slice(3, 5), 16)
        const b = parseInt(hexColor.slice(5, 7), 16)
        return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
}
