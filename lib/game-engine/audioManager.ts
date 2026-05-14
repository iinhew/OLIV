export class AudioManager {
  private sounds: Map<string, HTMLAudioElement>;

  private currentMusic: HTMLAudioElement | null = null;
  public isMutedSFX: boolean = false;
  public isMutedMusic: boolean = false;

  constructor() {
    this.sounds = new Map();
  }

  public loadSound(name: string, path: string) {
    if (typeof window !== 'undefined') {
      const audio = new Audio(path);
      this.sounds.set(name, audio);
    }
  }

  public loadMusic(name: string, path: string) {
    if (typeof window !== 'undefined') {
      const audio = new Audio(path);
      audio.loop = true;
      this.sounds.set(name, audio);
    }
  }

  public play(name: string) {
    if (this.isMutedSFX) return;
    const original = this.sounds.get(name);
    if (original) {
      // Clonar o nó permite que o mesmo som toque múltiplas vezes simultaneamente
      // Ideal para feedback de coleta de moedas ou partículas
      const clone = original.cloneNode() as HTMLAudioElement;
      clone.volume = original.volume;
      clone.play().catch(() => {});
    }
  }

  public stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic.currentTime = 0;
      this.currentMusic = null;
    }
  }

  public playMusic(name: string) {
    this.stopMusic();
    const music = this.sounds.get(name);
    if (music) {
      this.currentMusic = music;
      if (!this.isMutedMusic) {
        music.play().catch(() => {});
      }
    }
  }

  public toggleMuteSFX() {
    this.isMutedSFX = !this.isMutedSFX;
  }

  public toggleMuteMusic() {
    this.isMutedMusic = !this.isMutedMusic;
    if (this.isMutedMusic && this.currentMusic) {
      this.currentMusic.pause();
    } else if (!this.isMutedMusic && this.currentMusic) {
      this.currentMusic.play().catch(() => {});
    }
  }

  public setVolume(name: string, volume: number) {
    const sound = this.sounds.get(name);
    if (sound) {
      sound.volume = volume;
    }
  }
}

// Instância Singleton para uso em toda a Engine
export const gameAudio = new AudioManager();
