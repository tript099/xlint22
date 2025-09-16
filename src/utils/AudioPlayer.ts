import { toByteArray } from 'base64-js';

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private audioQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;

  // This function MUST be called after a user clicks something.
  public async initialize(): Promise<void> {
    if (this.audioContext) return;
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000, // The reference code uses 24kHz
      });
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      console.log(`✅ AudioContext is ready. State: ${this.audioContext.state}`);
    } catch (e) {
      console.error("❌ CRITICAL: Failed to create AudioContext:", e);
      throw new Error("Could not initialize audio playback.");
    }
  }

  public stopAndClearQueue() {
    console.log("Interrupt signal received. Clearing audio queue and stopping current sound.");
    // Clear the waiting list of audio chunks
    this.audioQueue = [];
    
    // If a sound is currently playing, stop it immediately
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    
    // Reset the playing state
    this.isPlaying = false;
  }

  public playChunk(base64Audio: string) {
    try {
      // Use the robust library to prevent errors
      const bytes = toByteArray(base64Audio);
      console.log(`🔊 Audio chunk received: ${bytes.length} bytes`);
      this.audioQueue.push(bytes.buffer as ArrayBuffer);
      if (!this.isPlaying) {
        this.processQueue();
      }
    } catch (error) {
      console.error("❌ Error decoding base64 audio chunk:", error);
    }
  }

  private async processQueue() {
    if (this.isPlaying || this.audioQueue.length === 0) {
      return;
    }
    
    this.isPlaying = true;
   
    const audioData = this.audioQueue.shift();
    if (audioData) {
      await this.playAudioData(audioData);
    }
    
    this.isPlaying = false;
    
    // After the chunk is done, check if there's more to play
    if (this.audioQueue.length > 0) {
        this.processQueue();
    }
  }

  // This function is a direct translation of `playAudioChunkNow` from the reference code
  private playAudioData(audioData: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.audioContext) {
        reject(new Error("AudioContext not initialized."));
        return;
      }
      try {
        // Safe PCM16 decode using DataView for proper little-endian handling
        const view = new DataView(audioData);
        const len = audioData.byteLength / 2;
        
        if (len === 0) {
          resolve();
          return;
        }

        const audioBuffer = this.audioContext.createBuffer(1, len, this.audioContext.sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        
        // Use DataView to safely read Int16 values in little-endian format
        for (let i = 0; i < len; i++) {
          const sample = view.getInt16(i * 2, true); // true = little-endian
          channelData[i] = sample / 32768.0; // Convert Int16 to Float32 range [-1, 1]
        }
        
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        source.onended = () => {
            this.currentSource = null; // Clear the source when it's done
            resolve();
        };
        
        this.currentSource = source;
        source.start(0);

      } catch (error) {
        console.error('Error in playAudioData:', error);
        reject(error);
      }
    });
  }
}