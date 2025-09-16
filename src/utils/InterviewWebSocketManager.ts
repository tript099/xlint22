export class InterviewWebSocketManager {
  private ws: WebSocket | null = null;
  private onMessageCallback: (data: any) => void;
  private onDisconnectCallback: (event: CloseEvent) => void;
  private heartbeat?: number;
  private lastPong = Date.now();
  private connectionTimeout?: number;
  private userInitiatedClose = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 2000; // 2 seconds
  private sessionId: string | null = null;

  constructor(onMessage: (data: any) => void, onDisconnect: (event: CloseEvent) => void) {
    this.onMessageCallback = onMessage;
    this.onDisconnectCallback = onDisconnect;
  }

  public connect(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.userInitiatedClose = false;
    
    return new Promise((resolve, reject) => {
      try {
        // Build WS URL preserving backend path using new URL
        const apiUrl = import.meta.env.VITE_PYTHON1_API_URL || 'http://localhost:8008';
        const baseUrl = new URL(apiUrl);
        
        // Preserve the path and add WebSocket endpoint
        const wsPath = baseUrl.pathname.replace(/\/$/, '') + `/ws/interview/${sessionId}`;
        
        // Convert HTTP(S) to WS(S)
        const wsProtocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${baseUrl.host}${wsPath}`;

        console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
        console.log(`📍 API URL: ${apiUrl}, Preserved path: ${baseUrl.pathname}`);
        
        this.ws = new WebSocket(wsUrl);

        // Set 5-second connection timeout
        this.connectionTimeout = window.setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            console.error('❌ WebSocket connection timeout after 5 seconds');
            this.ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 5000);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connection established successfully');
          if (this.connectionTimeout) {
            window.clearTimeout(this.connectionTimeout);
            this.connectionTimeout = undefined;
          }
          this.reconnectAttempts = 0; // Reset on successful connection
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.type === 'pong') {
              this.lastPong = Date.now();
              console.log('💓 Heartbeat pong received');
            } else {
              console.log('📨 WS Message received:', data.type || 'unknown');
            }
            this.onMessageCallback(data);
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error, event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket Error:', error);
          if (this.connectionTimeout) {
            window.clearTimeout(this.connectionTimeout);
            this.connectionTimeout = undefined;
          }
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = (event) => {
          console.log(`🔌 WebSocket disconnected. Code: ${event.code}, Reason: "${event.reason || 'No reason provided'}"`);
          
          if (this.connectionTimeout) {
            window.clearTimeout(this.connectionTimeout);
            this.connectionTimeout = undefined;
          }
          
          this.stopHeartbeat();
          
          // Auto-reconnect logic - only for 1006 or 1011, not user-initiated, within retry limits
          if (!this.userInitiatedClose && this.reconnectAttempts < this.maxReconnectAttempts && 
              (event.code === 1006 || event.code === 1011)) {
            this.reconnectAttempts++;
            console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms...`);
            
            setTimeout(() => {
              if (this.sessionId && !this.userInitiatedClose) {
                this.connect(this.sessionId).catch(error => {
                  console.error('❌ Reconnection failed:', error);
                  this.onDisconnectCallback(event);
                });
              }
            }, this.reconnectDelay);
          } else {
            this.onDisconnectCallback(event);
          }
        };

      } catch (error) {
        console.error('❌ Error creating WebSocket:', error);
        reject(new Error(`Failed to create WebSocket connection: ${error}`));
      }
    });
  }

  private startHeartbeat() {
    this.lastPong = Date.now(); // Initialize
    this.heartbeat = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      
      // Check if we haven't received a pong in 30 seconds
      if (Date.now() - this.lastPong > 30000) {
        // Log a warning but do NOT forcibly close the socket here. Some networks
        // temporarily block pongs; allow the existing onclose/reconnect logic to
        // handle actual disconnect events. This avoids immediate finalization.
        console.warn('💔 Heartbeat timeout - no pong received in 30s; will continue pings and rely on onclose for reconnection handling');
        // Do not close the socket here to give the connection a chance to recover.
      }
      
      // Send ping every 10 seconds
      const pingMessage = { type: 'ping', ts: Date.now() };
      this.ws.send(JSON.stringify(pingMessage));
      console.log('💓 Heartbeat ping sent');
    }, 10000);
  }

  private stopHeartbeat() {
    if (this.heartbeat) {
      window.clearInterval(this.heartbeat);
      this.heartbeat = undefined;
      console.log('💔 Heartbeat stopped');
    }
  }

  public sendAudio(base64Audio: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'audio', audio: base64Audio }));
    } else {
      console.warn('⚠️ Cannot send audio - WebSocket not connected');
    }
  }

  public sendAudioEnd() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'audio_end' }));
      console.log('🔇 Audio end signal sent');
    } else {
      console.warn('⚠️ Cannot send audio end - WebSocket not connected');
    }
  }

  public disconnect(isUserInitiated = true) {
    this.userInitiatedClose = isUserInitiated;
    this.stopHeartbeat();
    
    if (this.connectionTimeout) {
      window.clearTimeout(this.connectionTimeout);
      this.connectionTimeout = undefined;
    }
    
    if (this.ws) {
      const reason = isUserInitiated ? "User ended interview" : "System disconnect";
      console.log(`🔌 Disconnecting WebSocket: ${reason}`);
      this.ws.close(1000, reason);
      this.ws = null;
    }
    
    this.sessionId = null;
  }

  public getConnectionState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'disconnecting';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}