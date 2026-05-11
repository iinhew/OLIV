export class AudioManager {
  private sounds: Map<string, HTMLAudioElement>;

  constructor() {
    this.sounds = new Map();
  }

  public loadSound(name: string, path: string) {
    if (typeof window !== 'undefined') {
      const audio = new Audio(path);
      this.sounds.set(name, audio);
    }
  }

  public play(name: string) {
    const original = this.sounds.get(name);
    if (original) {
      // Clonar o nó permite que o mesmo som toque múltiplas vezes simultaneamente
      // Ideal para feedback de coleta de moedas ou partículas
      const clone = original.cloneNode() as HTMLAudioElement;
      clone.volume = original.volume;
      clone.play().catch(() => {});
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
