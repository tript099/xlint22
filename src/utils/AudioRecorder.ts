// AI Interviewer Integration – September 16, 2025
// src/utils/AudioRecorder.ts

export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
}

export interface AudioRecorderConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  bufferSize?: number;
}

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private onAudioChunk: ((chunk: AudioChunk) => void) | null = null;
  private config: AudioRecorderConfig;

  constructor(config: AudioRecorderConfig = {
    sampleRate: 24000,
    channels: 1,
    bitDepth: 16,
    bufferSize: 2048  // Changed to 2048 for better compatibility
  }) {
    this.config = config;
  }

  async start(onAudioChunk: (chunk: AudioChunk) => void): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      this.onAudioChunk = onAudioChunk;

      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: this.config.channels,
          sampleRate: this.config.sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create audio context with target sample rate
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate
      });

      // Create media stream source
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);

      // Use ScriptProcessorNode(2048,1,1), audioContext at 24000 Hz
      this.scriptProcessor = this.audioContext.createScriptProcessor(
        this.config.bufferSize || 2048, 
        this.config.channels, 
        this.config.channels
      );

      this.scriptProcessor.onaudioprocess = (event) => {
        if (!this.isRecording) return;

        const inputBuffer = event.inputBuffer;
        const channelData = inputBuffer.getChannelData(0); // Get mono channel

        // Convert Float32Array to PCM16 little-endian safely
        const pcm16Data = this.convertToPCM16(channelData);
        
        const chunk: AudioChunk = {
          data: pcm16Data.buffer as ArrayBuffer,
          timestamp: Date.now()
        };

        this.onAudioChunk?.(chunk);
      };

      // Connect audio nodes
      this.mediaStreamSource.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      this.isRecording = true;
      console.log('🎤 Audio recording started at', this.config.sampleRate, 'Hz');

    } catch (error) {
      console.error('❌ Error starting audio recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    this.isRecording = false;
    console.log('🔇 Audio recording stopped');

    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    try {
      // Disconnect audio nodes
      if (this.scriptProcessor) {
        this.scriptProcessor.disconnect();
        this.scriptProcessor = null;
      }

      if (this.mediaStreamSource) {
        this.mediaStreamSource.disconnect();
        this.mediaStreamSource = null;
      }

      // Stop all media tracks
      if (this.stream) {
        this.stream.getTracks().forEach(track => {
          track.stop();
        });
        this.stream = null;
      }

      // Close audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
      }

      this.onAudioChunk = null;

    } catch (error) {
      console.error('❌ Error during audio cleanup:', error);
    }
  }

  private convertToPCM16(float32Array: Float32Array): Int16Array {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);

    for (let i = 0; i < float32Array.length; i++) {
      // Convert from [-1, 1] float to [-32768, 32767] int16 safely
      let sample = Math.max(-1, Math.min(1, float32Array[i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      
      // Write as little-endian 16-bit signed integer
      view.setInt16(i * 2, sample, true);
    }

    return new Int16Array(buffer);
  }

  getVolumeLevel(audioData: Float32Array): number {
    // Calculate RMS (Root Mean Square) for volume level
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  isActive(): boolean {
    return this.isRecording;
  }

  getSampleRate(): number {
    return this.config.sampleRate;
  }

  getChannelCount(): number {
    return this.config.channels;
  }

  static async checkMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.warn('Microphone permission denied or not available:', error);
      return false;
    }
  }

  static async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      console.error('Error enumerating audio devices:', error);
      return [];
    }
  }
}