export class AudioManager {
  private pools: Map<string, HTMLAudioElement[]>;
  private poolRotators: Map<string, number>;

  private currentMusic: HTMLAudioElement | null = null;
  public isMutedSFX: boolean = false;
  public isMutedMusic: boolean = false;

  constructor() {
    this.pools = new Map();
    this.poolRotators = new Map();
  }

  public loadSound(name: string, path: string) {
    if (typeof window !== 'undefined') {
      const pool: HTMLAudioElement[] = [];
      for (let i = 0; i < 2; i++) {
        const el = new Audio(path);
        pool.push(el);
      }
      this.pools.set(name, pool);
      this.poolRotators.set(name, 0);
    }
  }

  public loadMusic(name: string, path: string) {
    if (typeof window !== 'undefined') {
      const audio = new Audio(path);
      audio.loop = true;
      const pool: HTMLAudioElement[] = [audio];
      this.pools.set(name, pool);
      this.poolRotators.set(name, 0);
    }
  }

  public play(name: string) {
    if (this.isMutedSFX) return;
    const pool = this.pools.get(name);
    if (!pool || pool.length === 0) return;

    const rot = (this.poolRotators.get(name) || 0) % pool.length;
    this.poolRotators.set(name, rot + 1);

    const el = pool[rot];
    if (el.paused || el.ended) {
      el.currentTime = 0;
      el.play().catch(() => {});
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
    const pool = this.pools.get(name);
    if (!pool || pool.length === 0) return;
    const music = pool[0];
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
    const pool = this.pools.get(name);
    if (pool) {
      for (const el of pool) {
        el.volume = volume;
      }
    }
  }
}

export const gameAudio = new AudioManager();
