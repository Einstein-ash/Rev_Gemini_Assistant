# Voice Chat with Gemini - Setup Instructions

## 🎯 Overview

This is a complete voice-to-voice web application that allows users to have real-time conversations with Google's Gemini AI using the Live API. The app captures audio from the user's microphone, streams it to the backend, processes it through Gemini, and plays back the AI's spoken response.

## 🏗️ Architecture

```
Frontend (HTML/JS) ←→ WebSocket ←→ Backend (Node.js) ←→ Gemini Live API
     ↓                                    ↓
Audio Recording                    Audio Processing
Audio Playback                     Base64 Encoding
```

## 📋 Prerequisites

- Node.js 18+ installed
- Gemini API key from Google AI Studio
- Modern web browser with microphone access
- HTTPS connection (for production microphone access)

## 🚀 Installation Steps

### 1. Clone/Download the Project

Create a new directory and add the provided files:
- `server.js` (Node.js backend)
- `package.json` (dependencies)
- `public/index.html` (frontend interface)

### 2. Install Dependencies

```bash
npm install
```

### 3. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create a new API key
3. Copy the API key

### 4. Set Environment Variable

**Option A: Environment Variable**
```bash
export GEMINI_API_KEY="your_api_key_here"
```

**Option B: Direct in Code**
Replace `YOUR_GEMINI_API_KEY_HERE` in server.js with your actual API key.

### 5. Create Directory Structure

```
voice-chat-gemini/
├── server.js
├── package.json
└── public/
    └── index.html
```

### 6. Run the Application

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

### 7. Open in Browser

Navigate to `http://localhost:3000`

## 🎙️ How to Use

1. **Connect to Backend**: Click "Connect to Backend" button
2. **Wait for Gemini Connection**: The app will automatically connect to Gemini Live API
3. **Start Speaking**: Click the microphone button and start talking
4. **Listen to Response**: The AI will respond with synthesized speech
5. **Continue Conversation**: Click the microphone again for follow-up questions

## 🔧 Technical Details

### Audio Format Requirements

**Input Audio (to Gemini):**
- Format: 16-bit PCM
- Sample Rate: 16kHz
- Channels: Mono
- Encoding: Base64

**Output Audio (from Gemini):**
- Format: 24kHz audio
- Playback through Web Audio API

### Key Features

- **Real-time Audio Streaming**: Uses MediaRecorder API for continuous audio capture
- **WebSocket Communication**: Bi-directional communication between frontend and backend
- **Audio Visualization**: Real-time audio level visualization
- **Error Handling**: Comprehensive error logging and user feedback
- **Responsive Design**: Modern, glassmorphic UI design

### API Models Used

The app uses `gemini-2.5-flash-preview-native-audio-dialog` which provides:
- Native audio input/output