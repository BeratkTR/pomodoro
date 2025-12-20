// Import audio files
// import messageSound from '../assets/message.mp3'
// import clockSound from '../assets/clock.mp3'
// import onSound from '../assets/on.mp3'
// import offSound from '../assets/off.mp3'

class SoundService {
  constructor() {
    this.sounds = {
      message: null,
      timerEnd: null,
      partnerJoin: null,
      partnerLeave: null
    }
    this.isEnabled = true
    this.volume = 0.7
    this.initializeSounds()
  }

  initializeSounds() {
    try {
      // Use imported audio files from assets
      this.sounds.message = new Audio('message.mp3')
      this.sounds.timerEnd = new Audio('clock.mp3')
      this.sounds.partnerJoin = new Audio('on.mp3')
      this.sounds.partnerLeave = new Audio('off.mp3')
      
      // Set initial volume and preload
      Object.values(this.sounds).forEach(sound => {
        if (sound) {
          sound.volume = this.volume
          sound.preload = 'auto'
          
          // Add error handling for individual audio files
          sound.addEventListener('error', (e) => {
            console.warn('Audio file failed to load:', e)
          })
        }
      })
    } catch (error) {
      console.warn('Failed to load audio files, falling back to synthetic sounds:', error)
      this.initializeFallbackSounds()
    }
  }

  initializeFallbackSounds() {
    try {
      console.log('Using fallback synthetic sounds')
      this.sounds.message = this.createSimpleBeep(800, 0.2) // Happy message sound
      this.sounds.timerEnd = this.createSimpleBeep(1000, 0.8) // Alarm sound
      this.sounds.partnerJoin = this.createSimpleBeep(600, 0.3) // Welcome sound
      this.sounds.partnerLeave = this.createSimpleBeep(400, 0.5) // Goodbye sound
    } catch (error) {
      console.warn('Failed to initialize fallback sounds:', error)
      this.isEnabled = false
    }
  }

  createSimpleBeep(frequency, duration) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      return {
        play: () => {
          const osc = audioContext.createOscillator()
          const gain = audioContext.createGain()
          
          osc.connect(gain)
          gain.connect(audioContext.destination)
          
          osc.frequency.setValueAtTime(frequency, audioContext.currentTime)
          gain.gain.setValueAtTime(0, audioContext.currentTime)
          gain.gain.linearRampToValueAtTime(this.volume * 0.3, audioContext.currentTime + 0.01)
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
          
          osc.start(audioContext.currentTime)
          osc.stop(audioContext.currentTime + duration)
        }
      }
    } catch (error) {
      console.warn('Web Audio not supported, using silent fallback')
      return { play: () => {} }
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
    Object.values(this.sounds).forEach(sound => {
      if (sound) {
        sound.volume = this.volume
      }
    })
  }

  setEnabled(enabled) {
    this.isEnabled = enabled
  }

  playMessageSound() {
    if (!this.isEnabled || !this.sounds.message) return
    
    try {
      if (this.sounds.message.type === 'webaudio') {
        this.playWebAudioSound(this.sounds.message)
      } else if (this.sounds.message.play) {
        this.sounds.message.play()
      } else {
        // Reset audio to beginning and play
        this.sounds.message.currentTime = 0
        
        // Clone the audio for overlapping playback
        const audioClone = this.sounds.message.cloneNode()
        audioClone.volume = this.volume
        
        // Clean up the clone after it finishes playing
        audioClone.addEventListener('ended', () => {
          audioClone.remove()
        })
        
        audioClone.play().catch(error => {
          console.warn('Failed to play message sound:', error)
        })
      }
    } catch (error) {
      console.warn('Failed to play message sound:', error)
    }
  }

  playTimerEndSound() {
    if (!this.isEnabled || !this.sounds.timerEnd) return
    
    try {
      if (this.sounds.timerEnd.type === 'webaudio') {
        this.playWebAudioSound(this.sounds.timerEnd)
      } else if (this.sounds.timerEnd.play) {
        this.sounds.timerEnd.play()
      } else {
        // Reset audio to beginning and play
        this.sounds.timerEnd.currentTime = 0
        
        // Clone the audio for overlapping playback
        const audioClone = this.sounds.timerEnd.cloneNode()
        audioClone.volume = this.volume
        
        // Clean up the clone after it finishes playing
        audioClone.addEventListener('ended', () => {
          audioClone.remove()
        })
        
        audioClone.play().catch(error => {
          console.warn('Failed to play timer end sound:', error)
        })
      }
    } catch (error) {
      console.warn('Failed to play timer end sound:', error)
    }
  }

  playPartnerJoinSound() {
    if (!this.isEnabled || !this.sounds.partnerJoin) return
    
    try {
      if (this.sounds.partnerJoin.type === 'webaudio') {
        this.playWebAudioSound(this.sounds.partnerJoin)
      } else if (this.sounds.partnerJoin.play) {
        this.sounds.partnerJoin.play()
      } else {
        // Reset audio to beginning and play
        this.sounds.partnerJoin.currentTime = 0
        
        // Clone the audio for overlapping playback
        const audioClone = this.sounds.partnerJoin.cloneNode()
        audioClone.volume = this.volume
        
        // Clean up the clone after it finishes playing
        audioClone.addEventListener('ended', () => {
          audioClone.remove()
        })
        
        audioClone.play().catch(error => {
          console.warn('Failed to play partner join sound:', error)
        })
      }
    } catch (error) {
      console.warn('Failed to play partner join sound:', error)
    }
  }

  playPartnerLeaveSound() {
    if (!this.isEnabled || !this.sounds.partnerLeave) return
    
    try {
      if (this.sounds.partnerLeave.type === 'webaudio') {
        this.playWebAudioSound(this.sounds.partnerLeave)
      } else if (this.sounds.partnerLeave.play) {
        this.sounds.partnerLeave.play()
      } else {
        // Reset audio to beginning and play
        this.sounds.partnerLeave.currentTime = 0
        
        // Clone the audio for overlapping playback
        const audioClone = this.sounds.partnerLeave.cloneNode()
        audioClone.volume = this.volume
        
        // Clean up the clone after it finishes playing
        audioClone.addEventListener('ended', () => {
          audioClone.remove()
        })
        
        audioClone.play().catch(error => {
          console.warn('Failed to play partner leave sound:', error)
        })
      }
    } catch (error) {
      console.warn('Failed to play partner leave sound:', error)
    }
  }

  // Test method to play sounds for user verification
  testSound(type) {
    if (type === 'message') {
      this.playMessageSound()
    } else if (type === 'timer') {
      this.playTimerEndSound()
    } else if (type === 'partnerJoin') {
      this.playPartnerJoinSound()
    } else if (type === 'partnerLeave') {
      this.playPartnerLeaveSound()
    }
  }

  // Test all partner presence sounds
  testPartnerSounds() {
    console.log('Testing partner join sound...')
    this.playPartnerJoinSound()
    
    setTimeout(() => {
      console.log('Testing partner leave sound...')
      this.playPartnerLeaveSound()
    }, 1000)
  }

  // Create better quality sounds using Web Audio API
  createMessageSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const duration = 0.4
      const sampleRate = audioContext.sampleRate
      const frameCount = duration * sampleRate
      const buffer = audioContext.createBuffer(1, frameCount, sampleRate)
      const channelData = buffer.getChannelData(0)

      // Create a pleasant "happy-message" notification sound (cheerful ascending chord)
      for (let i = 0; i < frameCount; i++) {
        const t = i / sampleRate
        const progress = t / duration
        
        // Ascending chord: C5, E5, G5 (523, 659, 784 Hz)
        const note1 = Math.sin(2 * Math.PI * 523 * t) * 0.3
        const note2 = Math.sin(2 * Math.PI * 659 * t) * 0.25
        const note3 = Math.sin(2 * Math.PI * 784 * t) * 0.2
        
        // Add some sparkle with higher harmonics
        const sparkle = Math.sin(2 * Math.PI * 1047 * t) * 0.1 * Math.sin(t * 10)
        
        // Bell-like envelope
        const envelope = Math.exp(-t * 6) * (1 - progress * 0.7)
        
        channelData[i] = (note1 + note2 + note3 + sparkle) * envelope
      }

      return buffer
    } catch (error) {
      console.warn('Web Audio API not supported:', error)
      return null
    }
  }

  createTimerEndSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const duration = 1.5
      const sampleRate = audioContext.sampleRate
      const frameCount = duration * sampleRate
      const buffer = audioContext.createBuffer(1, frameCount, sampleRate)
      const channelData = buffer.getChannelData(0)

      // Create a "bedside-clock-alarm" sound (classic alarm clock beeps)
      for (let i = 0; i < frameCount; i++) {
        const t = i / sampleRate
        
        // Create beep pattern: 4 beeps per second
        const beepFreq = 1000 // Classic alarm frequency
        const beepRate = 4 // beeps per second
        const beepPhase = (t * beepRate) % 1
        
        // Each beep lasts 0.15 seconds with 0.1 second gap
        const isBeeping = beepPhase < 0.6
        
        if (isBeeping) {
          // Add slight vibrato for classic alarm feel
          const vibrato = 1 + 0.03 * Math.sin(2 * Math.PI * 5 * t)
          const tone = Math.sin(2 * Math.PI * beepFreq * vibrato * t)
          
          // Sharp attack, quick decay envelope for each beep
          const beepEnvelope = Math.exp(-((beepPhase % 1) * 8))
          
          // Overall fade to prevent abrupt ending
          const overallFade = 1 - (t / duration) * 0.3
          
          channelData[i] = tone * beepEnvelope * overallFade * 0.4
        } else {
          channelData[i] = 0
        }
      }

      return buffer
    } catch (error) {
      console.warn('Web Audio API not supported:', error)
      return null
    }
  }

  // Initialize Web Audio API sounds (better quality)
  initializeWebAudioSounds() {
    try {
      const messageBuffer = this.createMessageSound()
      const timerBuffer = this.createTimerEndSound()

      if (messageBuffer) {
        this.sounds.message = { buffer: messageBuffer, type: 'webaudio' }
      }
      if (timerBuffer) {
        this.sounds.timerEnd = { buffer: timerBuffer, type: 'webaudio' }
      }
    } catch (error) {
      console.warn('Failed to initialize Web Audio sounds:', error)
    }
  }

  // Play Web Audio sound
  playWebAudioSound(soundData) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioContext.createBufferSource()
      const gainNode = audioContext.createGain()
      
      source.buffer = soundData.buffer
      gainNode.gain.value = this.volume
      
      source.connect(gainNode)
      gainNode.connect(audioContext.destination)
      source.start()
    } catch (error) {
      console.warn('Failed to play Web Audio sound:', error)
    }
  }
}

// Create and export a singleton instance
const soundService = new SoundService()
export default soundService 