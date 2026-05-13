export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  isGlitter: boolean;
  active: boolean;
  color?: string;
}

export class ParticlePool {
  private pool: Particle[];

  constructor(size: number) {
    // Aloca memória estaticamente uma única vez na inicialização da Engine
    this.pool = Array.from({ length: size }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, life: 0, isGlitter: false, active: false
    }));
  }

  public spawn(x: number, y: number, vx: number, vy: number, life: number, isGlitter: boolean, color?: string) {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        this.pool[i].x = x;
        this.pool[i].y = y;
        this.pool[i].vx = vx;
        this.pool[i].vy = vy;
        this.pool[i].life = life;
        this.pool[i].isGlitter = isGlitter;
        this.pool[i].color = color;
        this.pool[i].active = true;
        return;
      }
    }
    // Se o pool estiver cheio, ignoramos novas partículas (graceful degradation)
  }

  public updateAndDraw(ctx: CanvasRenderingContext2D, dt: number = 1) {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (p.active) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= 0.05 * dt; // Baseado no PARTICLE_LIFETIME_DECREMENT
        if (p.life <= 0) {
          p.active = false; // "Destrói" a partícula apenas inativando-a
        } else {
          if (p.color) {
            ctx.fillStyle = p.color.replace('ALPHA', p.life.toFixed(2));
          } else {
            ctx.fillStyle = p.isGlitter ? `rgba(255, 223, 0, ${p.life})` : `rgba(174, 197, 81, ${p.life})`;
          }
          ctx.fillRect(p.x, p.y, 4, 4);
        }
      }
    }
  }

  public clear() {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
    }
  }
}
