const express = require('express');
const WebSocket = require('ws');
const { GoogleGenAI, Modality } = require('@google/genai');
const cors = require('cors');
const path = require('path');
require("dotenv").config();

const app = express();
const server = require('http').createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const wss = new WebSocket.Server({ server });

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY 
});

// working good - server4
const model = "gemini-2.5-flash-preview-native-audio-dialog";

const config = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: `You are Rev, the official AI voice assistant for Revolt Motors - India's leading electric motorcycle company.

    Your role and expertise:
    - You represent Revolt Motors and help customers learn about our electric motorcycles
    - You are knowledgeable about all Revolt Motors products, features, and benefits
    - You speak in a friendly, enthusiastic, and helpful tone
    - You can communicate in multiple Indian languages when requested (Hindi, English, etc.)
    - You embody the revolutionary spirit of electric mobility

    Key Revolt Motors Products to discuss:
    • RV400: India's No.1 AI-enabled electric motorcycle
      - Range: 150km on single charge
      - Top speed: 85 kmph
      - Charging time: 4.5 hours
      - Features: AI-enabled, app connectivity, multiple riding modes
    
    • RV1 & RV1+: Latest affordable electric motorcycles
      - RV1: 100km range with 2.2kWh battery
      - RV1+: Enhanced range with swappable batteries
      - Features: LED lighting, LCD display, under-seat storage
    
    • RV300: Entry-level model
      - 1.5KW motor, 65kmph top speed
      - Three riding modes: Eco, Normal, Sport
      - 60V/2.7 kWh lithium-ion battery

    Company highlights:
    - India's No.1 electric motorcycle brand
    - Revolutionary technology with AI integration
    - Eco-friendly, zero-emission transportation
    - Book for just ₹499
    - Over-the-Air (OTA) updates
    - Mobile app control and connectivity
    - Intelligent safety features

    Guidelines:
    - Always introduce yourself as "Rev" from Revolt Motors
    - Focus conversations on electric motorcycles, sustainability, and Revolt products
    - If asked about other topics, politely redirect to Revolt Motors and electric mobility
    - Be enthusiastic about the electric revolution and environmental benefits
    - Provide specific product details when asked
    - Encourage test rides and bookings
    - Handle interruptions gracefully and continue conversations naturally

    CRITICAL SPEECH PATTERN:
    - ALWAYS start every response with natural thinking sounds like "mmmmmm...", "Aaan...", "Hmm...", "Well...", "Let me see...", "Ahhhh..."
    - These thinking sounds should feel natural and human-like, as if you're processing the question
    - Vary the thinking sounds - don't use the same one repeatedly
    - Examples: "Umm... that's a great question about the RV400!", "Aaan... let me tell you about our latest models", "Hmm... I'd love to help you with that"
    - Make it sound like a natural human conversation with brief pauses for thinking

    INTERRUPTION HANDLING:
    - If interrupted while speaking, gracefully acknowledge and switch to the new topic immediately
    - Keep responses concise and natural when resuming after interruption
    - Don't restart lengthy explanations unless specifically asked

    Remember: You are here to help customers understand why Revolt Motors is revolutionizing Indian mobility with cutting-edge electric motorcycles. Always begin responses with thinking sounds to feel more human and conversational.`
};

class VoiceSession {
    constructor(clientWs) {
        this.clientWs = clientWs;
        this.geminiSession = null;
        this.isConnected = false;
        this.responseQueue = [];
        this.isCurrentlyResponding = false;
        this.silenceDetectionTimer = null;
        this.lastAudioTime = Date.now();
        this.audioThreshold = 0.01; // Adjust based on testing
    }

    async connect() {
        try {
            this.geminiSession = await ai.live.connect({
                model: model,
                callbacks: {
                    onopen: () => {
                        console.log('Gemini session opened');
                        this.isConnected = true;
                        this.clientWs.send(JSON.stringify({
                            type: 'gemini_connected',
                            message: 'Connected to Gemini Live API'
                        }));
                    },
                    onmessage: (message) => {
                        this.handleGeminiMessage(message);
                    },
                    onerror: (error) => {
                        console.error('Gemini error:', error);
                        this.clientWs.send(JSON.stringify({
                            type: 'error',
                            message: 'Gemini connection error: ' + error.message
                        }));
                    },
                    onclose: (event) => {
                        console.log('Gemini session closed:', event.reason);
                        this.isConnected = false;
                        this.clientWs.send(JSON.stringify({
                            type: 'gemini_disconnected',
                            message: 'Disconnected from Gemini'
                        }));
                    }
                },
                config: config
            });
        } catch (error) {
            console.error('Failed to connect to Gemini:', error);
            this.clientWs.send(JSON.stringify({
                type: 'error',
                message: 'Failed to connect to Gemini: ' + error.message
            }));
        }
    }

    handleGeminiMessage(message) {
        // Handle audio response from Gemini
        if (message.data) {
            this.isCurrentlyResponding = true;
            // Send audio data back to client
            this.clientWs.send(JSON.stringify({
                type: 'audio_response',
                data: message.data,
                mimeType: 'audio/pcm;rate=24000'
            }));
        }

        // Handle turn completion
        if (message.serverContent && message.serverContent.turnComplete) {
            this.isCurrentlyResponding = false;
            this.clientWs.send(JSON.stringify({
                type: 'turn_complete',
                message: 'Response complete'
            }));
        }
    }

    // Enhanced interruption detection
    detectInterruption(audioData) {
        // Calculate audio level (simple RMS)
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        // const rms = Math.sqrt(sum / audioData.length) ; -- thodi thodi issue 
        const rms = Math.sqrt(sum / audioData.length) / 10;    // --- best working till now 
  
        
        // If we detect speech while responding, trigger interruption
        if (rms > this.audioThreshold && this.isCurrentlyResponding) {
            console.log('Interruption detected! Audio level:', rms);
            this.handleInterruption();
            return true;
        }
        
        return false;
    }

    // Handle interruption gracefully
    async handleInterruption() {
        console.log('Handling interruption...');
        this.isCurrentlyResponding = false;
        
        // Send interruption signal to client to stop all audio immediately
        this.clientWs.send(JSON.stringify({
            type: 'audio_interrupted',
            message: 'Audio interrupted by user speech'
        }));

        // Send interruption to Gemini session if available
        try {
            if (this.geminiSession && this.isConnected) {
                // Send a brief interruption signal to Gemini
                await this.geminiSession.sendRealtimeInput({
                    media: {
                        data: '', // Empty data to signal interruption
                        mimeType: "audio/pcm;rate=16000"
                    }
                });
            }
        } catch (error) {
            console.error('Error sending interruption to Gemini:', error);
        }
    }

    async sendAudio(audioData, mimeType = "audio/pcm;rate=16000") {
        if (!this.isConnected || !this.geminiSession) {
            throw new Error('Gemini session not connected');
        }

        try {
            // Convert base64 to array for interruption detection
            const binaryString = atob(audioData);
            const audioArray = new Float32Array(binaryString.length / 2);
            const dataView = new DataView(new ArrayBuffer(binaryString.length));
            
            for (let i = 0; i < binaryString.length; i++) {
                dataView.setUint8(i, binaryString.charCodeAt(i));
            }
            
            for (let i = 0; i < audioArray.length; i++) {
                audioArray[i] = dataView.getInt16(i * 2, true) / 32768.0;
            }

            // Check for interruption before sending
            if (this.detectInterruption(audioArray)) {
                return; // Don't send audio if interruption detected
            }

            await this.geminiSession.sendRealtimeInput({
                media: {
                    data: audioData,
                    mimeType: mimeType
                }
            });
            
            this.lastAudioTime = Date.now();
        } catch (error) {
            console.error('Error sending audio to Gemini:', error);
            throw error;
        }
    }

    close() {
        if (this.silenceDetectionTimer) {
            clearTimeout(this.silenceDetectionTimer);
        }
        if (this.geminiSession) {
            this.geminiSession.close();
        }
        this.isConnected = false;
    }
}

wss.on('connection', (ws) => {
    console.log('Client connected');
    
    const voiceSession = new VoiceSession(ws);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'connect_gemini':
                    console.log('Connecting to Gemini...');
                    await voiceSession.connect();
                    break;
                    
                case 'audio_chunk':
                    if (data.audioData) {
                        await voiceSession.sendAudio(data.audioData, data.mimeType || "audio/pcm;rate=16000");
                    }
                    break;
                    
                case 'user_started_speaking':
                    // Client detected user started speaking
                    if (voiceSession.isCurrentlyResponding) {
                        voiceSession.handleInterruption();
                    }
                    break;
                    
                case 'disconnect':
                    voiceSession.close();
                    break;
                    
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: error.message
            }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        voiceSession.close();
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        voiceSession.close();
    });

    // Send initial connection message
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to voice server'
    }));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        process.exit(0);
    });
});