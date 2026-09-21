import { randRange, pick } from './math';
import type { MatchState, Particle, Vec } from './types';

const CONFETTI = ['#ffe14d', '#ff5d73', '#5bb8f0', '#67dcb4', '#ff8fbe', '#ffffff'];

export function spawnConfetti(state: MatchState, at: Vec, count = 46): void {
  for (let i = 0; i < count; i++) {
    const a = randRange(0, Math.PI * 2);
    const s = randRange(14, 54);
    state.particles.push({
      pos: { x: at.x, y: at.y },
      vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
      life: randRange(0.7, 1.5),
      maxLife: 1.5,
      color: pick(CONFETTI),
      size: randRange(1.1, 2.6),
    });
  }
}

export function spawnPuff(state: MatchState, at: Vec, color: string, count = 8): void {
  for (let i = 0; i < count; i++) {
    const a = randRange(0, Math.PI * 2);
    const s = randRange(6, 22);
    state.particles.push({
      pos: { x: at.x, y: at.y },
      vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
      life: randRange(0.25, 0.5),
      maxLife: 0.5,
      color,
      size: randRange(0.7, 1.6),
    });
  }
}

export function stepParticles(particles: Particle[], dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.vel.x *= 1 - 2.2 * dt;
    p.vel.y *= 1 - 2.2 * dt;
  }
}
