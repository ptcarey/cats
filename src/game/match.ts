import { GOALS_TO_WIN, PITCH } from './constants';
import { steer } from './ai';
import { integrate, kickBall, type GameEvent } from './physics';
import { createMatch, resetPositions } from './state';
import { pickRival } from './team';
import { render } from './render';
import { fitCamera, type Camera } from './camera';
import { AimController } from './input';
import { spawnConfetti, stepParticles } from './fx';
import {
  sfxCollect,
  sfxGoal,
  sfxKick,
  sfxLose,
  sfxTackle,
  sfxWall,
  sfxWhistle,
  sfxWin,
} from './audio';
import type { Difficulty, MatchState, TeamId, TeamProfile } from './types';

const STEP = 1 / 60;
const MAX_FRAME = 0.1;

export interface MatchCallbacks {
  onStateChange: (state: MatchState) => void;
  onFinish: (winner: TeamId) => void;
}

export class Match {
  readonly state: MatchState;
  private cam: Camera;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly aim: AimController;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;
  private paused = false;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    team: TeamProfile,
    difficulty: Difficulty,
    private readonly cb: MatchCallbacks,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available in this browser.');
    this.ctx = ctx;

    // The computer side is chosen to contrast with the player's colours.
    this.state = createMatch(team, pickRival(team), difficulty);
    resetPositions(this.state, 0);
    this.cam = fitCamera(canvas.clientWidth || 1, canvas.clientHeight || 1);

    this.aim = new AimController(
      canvas,
      () => (this.running && !this.paused ? this.state : null),
      () => this.cam,
      (req) => {
        kickBall(this.state, req.cat, req.dir, req.speed);
        sfxKick(req.power);
      },
    );

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    sfxWhistle();
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Freezes the simulation but keeps drawing, so the pause card sits over a live picture. */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (!paused) {
      this.last = performance.now();
      this.acc = 0;
    } else {
      // Drop any half-finished aim so the kick does not fire on resume.
      this.state.aim.active = false;
      this.state.aim.target = null;
      this.state.timeScale = 1;
    }
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.aim.destroy();
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cam = fitCamera(w, h);
    this.draw();
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    if (this.paused) {
      this.last = now;
      this.draw();
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    const raw = Math.min((now - this.last) / 1000, MAX_FRAME);
    this.last = now;

    this.acc += raw * this.state.timeScale;
    let guard = 0;
    while (this.acc >= STEP && guard++ < 8) {
      this.acc -= STEP;
      this.tick(STEP);
    }

    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private tick(dt: number): void {
    const s = this.state;
    s.elapsed += dt;
    stepParticles(s.particles, dt);

    switch (s.phase) {
      case 'kickoff':
        s.phaseTimer -= dt;
        // Idle breathing so the cats do not look frozen on the line.
        for (const cat of s.cats) cat.animPhase += dt * 1.4;
        if (s.phaseTimer <= 0) {
          s.phase = 'play';
          this.cb.onStateChange(s);
        }
        break;

      case 'play': {
        steer(s, dt);
        const events = integrate(s, dt);
        this.handleEvents(events);
        break;
      }

      case 'goal':
        s.phaseTimer -= dt;
        // Celebration spin for the scoring side.
        for (const cat of s.cats) {
          if (cat.team === s.lastScorer) cat.facing += dt * 7;
          cat.animPhase += dt * 5;
        }
        if (s.phaseTimer <= 0) this.afterGoal();
        break;

      case 'fulltime':
        for (const cat of s.cats) cat.animPhase += dt * 3;
        break;
    }
  }

  private handleEvents(events: GameEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'collect':
          sfxCollect();
          break;
        case 'tackle':
          sfxTackle();
          break;
        case 'wall':
          sfxWall();
          break;
        case 'goal':
          this.scoreGoal(e.team);
          break;
        case 'kick':
          sfxKick(e.power);
          break;
      }
    }
  }

  private scoreGoal(team: TeamId): void {
    const s = this.state;
    s.score[team] += 1;
    s.lastScorer = team;
    s.phase = 'goal';
    s.phaseTimer = 2.4;
    s.shake = 1;
    s.aim.active = false;
    s.aim.target = null;
    s.timeScale = 1;
    s.ball.owner = null;
    s.ball.vel.x = 0;
    s.ball.vel.y = 0;
    spawnConfetti(s, { x: PITCH.w / 2, y: team === 0 ? 8 : PITCH.h - 8 }, 60);
    sfxGoal();
    this.cb.onStateChange(s);
  }

  private afterGoal(): void {
    const s = this.state;
    const winner: TeamId | null =
      s.score[0] >= GOALS_TO_WIN ? 0 : s.score[1] >= GOALS_TO_WIN ? 1 : null;

    if (winner !== null) {
      s.phase = 'fulltime';
      s.timeScale = 1;
      if (winner === 0) {
        spawnConfetti(s, { x: PITCH.w / 2, y: PITCH.h / 2 }, 110);
        sfxWin();
      } else {
        sfxLose();
      }
      this.cb.onStateChange(s);
      this.cb.onFinish(winner);
      return;
    }

    // The side that was scored against restarts.
    const kickoffFor: TeamId = s.lastScorer === 0 ? 1 : 0;
    resetPositions(s, kickoffFor);
    s.phase = 'kickoff';
    s.phaseTimer = 1.4;
    sfxWhistle();
    this.cb.onStateChange(s);
  }

  private draw(): void {
    render(this.ctx, this.cam, this.state);
  }
}
