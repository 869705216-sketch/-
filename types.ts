export enum MagicState {
  CHAOS = 'CHAOS',
  FORMED = 'FORMED'
}

export interface HandData {
  state: 'OPEN' | 'CLOSED' | 'UNKNOWN';
  x: number; // 0 to 1
  y: number; // 0 to 1
}

export interface ParticleProp {
  chaosPos: [number, number, number];
  targetPos: [number, number, number];
  scale: number;
}