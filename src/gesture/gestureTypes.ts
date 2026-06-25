import type { PlanetId } from '../data/planets';

export type GestureSource = 'mouse-baseline' | 'camera-hand';

export type GestureCommand =
  | { type: 'rotate'; deltaX: number; deltaY: number; source: GestureSource }
  | { type: 'zoom'; delta: number; source: GestureSource }
  | { type: 'pan'; deltaX: number; deltaY: number; source: GestureSource }
  | { type: 'pinchControl'; phase: 'start' | 'end'; sessionId: number; source: GestureSource }
  | {
      type: 'pinchControl';
      phase: 'move' | 'rebase';
      sessionId: number;
      centerDeltaX: number;
      centerDeltaY: number;
      scaleRatio: number;
      source: GestureSource;
    }
  | { type: 'spaceControl'; phase: 'start' | 'end'; sessionId: number; source: GestureSource }
  | {
      type: 'spaceControl';
      phase: 'move' | 'rebase';
      sessionId: number;
      centerDeltaX: number;
      centerDeltaY: number;
      scaleRatio: number;
      rotationDelta: number;
      source: GestureSource;
    }
  | { type: 'togglePause'; source: GestureSource }
  | { type: 'setTimeScale'; value: number; source: GestureSource }
  | { type: 'selectPlanet'; planetId: PlanetId; source: GestureSource };

export type HandTrackingState = {
  available: boolean;
  status: 'not-started' | 'requesting-camera' | 'tracking' | 'lost' | 'error';
  gestureName: string;
  confidence: number;
  latencyMs: number;
  hands: number;
  message: string;
};

export const initialHandTrackingState: HandTrackingState = {
  available: typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
  status: 'not-started',
  gestureName: 'manual baseline',
  confidence: 0,
  latencyMs: 0,
  hands: 0,
  message: 'Camera idle'
};
