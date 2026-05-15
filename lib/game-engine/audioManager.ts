export class AudioManager {
  private sounds: Map<string, HTMLAudioElement>;
  private pools: Map<string, HTMLAudioElement[]>;
  private poolRotators: Map<string, number>;

  private currentMusic: HTMLAudioElement | null = null;
  public isMutedSFX: boolean = false;
  public isMutedMusic: boolean = false;

  constructor() {
    this.sounds = new Map();
    this.pools = new Map();
    this.poolRotators = new Map();
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
    if (!original) return;

    let pool = this.pools.get(name);
    if (!pool) {
      pool = [];
      this.pools.set(name, pool);
      this.poolRotators.set(name, 0);
    }

    // Round-robin: toca o próximo elemento do pool, ou cria um se pool < 3
    const rot = (this.poolRotators.get(name) || 0) % Math.max(pool.length, 1);
    let el: HTMLAudioElement;

    if (pool.length < 3) {
      el = original.cloneNode() as HTMLAudioElement;
      el.volume = original.volume;
      pool.push(el);
    } else {
      el = pool[rot];
      el.currentTime = 0;
    }

    this.poolRotators.set(name, rot + 1);
    el.play().catch(() => {});
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
