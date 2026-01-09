const WebSocket = require('ws');
const http = require('http');

// Создаем HTTP сервер для health checks
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'webrtc-signal', timestamp: new Date().toISOString() }));
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('✅ Laboratoria WebRTC Signaling Server\n\nEndpoints:\n- GET /health - Health check\n- WS / - WebSocket signaling');
    }
});

// Запускаем WebSocket на том же сервере
const wss = new WebSocket.Server({ server });

console.log('🚀 Laboratoria WebRTC Server starting...');

let phoneConnection = null;
let browserConnection = null;

wss.on('connection', (ws, req) => {
    console.log('🔗 New WebSocket connection from:', req.socket.remoteAddress);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Received type:', data.type);
            
            if (data.type === 'phone') {
                phoneConnection = ws;
                ws.send(JSON.stringify({ 
                    type: 'registered', 
                    role: 'phone',
                    message: '📱 Phone connected successfully. Ready for streaming.',
                    timestamp: new Date().toISOString()
                }));
                console.log('📱 Phone registered as broadcaster');
            }
            else if (data.type === 'browser') {
                browserConnection = ws;
                ws.send(JSON.stringify({ 
                    type: 'registered', 
                    role: 'browser',
                    message: '💻 Browser connected. Waiting for video stream...',
                    timestamp: new Date().toISOString()
                }));
                console.log('💻 Browser registered as viewer');
            }
            else if (data.type === 'offer') {
                if (browserConnection && browserConnection.readyState === 1) {
                    browserConnection.send(JSON.stringify({
                        type: 'offer',
                        sdp: data.sdp,
                        from: 'phone',
                        timestamp: new Date().toISOString()
                    }));
                    console.log('📤 Forwarded SDP offer to browser');
                }
            }
            else if (data.type === 'answer') {
                if (phoneConnection && phoneConnection.readyState === 1) {
                    phoneConnection.send(JSON.stringify({
                        type: 'answer',
                        sdp: data.sdp,
                        from: 'browser',
                        timestamp: new Date().toISOString()
                    }));
                    console.log('📤 Forwarded SDP answer to phone');
                }
            }
            else if (data.type === 'candidate') {
                const target = data.to === 'phone' ? phoneConnection : browserConnection;
                if (target && target.readyState === 1) {
                    target.send(JSON.stringify({
                        type: 'candidate',
                        candidate: data.candidate,
                        sdpMid: data.sdpMid,
                        sdpMLineIndex: data.sdpMLineIndex,
                        timestamp: new Date().toISOString()
                    }));
                    console.log('❄️ Forwarded ICE candidate to', data.to);
                }
            }
        } catch (error) {
            console.error('❌ Error processing message:', error.message);
            ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Invalid message format',
                error: error.message 
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('👋 Connection closed');
        if (ws === phoneConnection) {
            phoneConnection = null;
            console.log('📱 Phone disconnected');
        }
        if (ws === browserConnection) {
            browserConnection = null;
            console.log('💻 Browser disconnected');
        }
    });
    
    ws.on('error', (error) => {
        console.error('💥 WebSocket error:', error.message);
    });
});

// Запускаем сервер на порту 8080 (требование Fly.io)
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`🔌 WebSocket: ws://0.0.0.0:${PORT}`);
    console.log('🟢 Ready for connections...');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
