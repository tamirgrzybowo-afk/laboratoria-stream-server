const WebSocket = require('ws');
const server = new WebSocket.Server({ port: process.env.PORT || 5000 });

console.log('🚀 Laboratoria WebRTC Server started on port', process.env.PORT || 5000);

let broadcaster = null;
const viewers = new Set();

server.on('connection', (ws) => {
    console.log('🔗 New connection');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Received:', data.type);
            
            if (data.type === 'phone') {
                broadcaster = ws;
                ws.send(JSON.stringify({ 
                    type: 'registered', 
                    role: 'broadcaster',
                    message: 'Phone connected successfully' 
                }));
                console.log('📱 Phone registered as broadcaster');
            }
            else if (data.type === 'browser') {
                viewers.add(ws);
                ws.send(JSON.stringify({ 
                    type: 'registered', 
                    role: 'viewer',
                    message: 'Browser ready to receive stream' 
                }));
                console.log('💻 Browser registered as viewer. Total:', viewers.size);
            }
            else if (data.type === 'offer') {
                // Forward offer to all viewers
                viewers.forEach(viewer => {
                    if (viewer.readyState === WebSocket.OPEN) {
                        viewer.send(JSON.stringify({
                            type: 'offer',
                            sdp: data.sdp
                        }));
                        console.log('📤 Forwarded offer to viewer');
                    }
                });
            }
            else if (data.type === 'answer') {
                // Forward answer to broadcaster
                if (broadcaster && broadcaster.readyState === WebSocket.OPEN) {
                    broadcaster.send(JSON.stringify({
                        type: 'answer',
                        sdp: data.sdp
                    }));
                    console.log('📤 Forwarded answer to phone');
                }
            }
            else if (data.type === 'candidate') {
                // Forward ICE candidates
                const target = data.to;
                if (target === 'phone' && broadcaster) {
                    broadcaster.send(JSON.stringify({
                        type: 'candidate',
                        candidate: data.candidate
                    }));
                } else if (target === 'browser') {
                    viewers.forEach(viewer => {
                        if (viewer.readyState === WebSocket.OPEN) {
                            viewer.send(JSON.stringify({
                                type: 'candidate',
                                candidate: data.candidate
                            }));
                        }
                    });
                }
            }
        } catch (error) {
            console.error('❌ Error processing message:', error);
        }
    });
    
    ws.on('close', () => {
        if (ws === broadcaster) {
            broadcaster = null;
            console.log('📱 Phone disconnected');
        }
        if (viewers.has(ws)) {
            viewers.delete(ws);
            console.log('💻 Viewer disconnected. Remaining:', viewers.size);
        }
    });
    
    ws.on('error', (error) => {
        console.error('💥 WebSocket error:', error);
    });
});
