import { expect, test } from '@playwright/test';
import {
  adaptiveAlpha,
  getAdaptiveDetectionFrameSize,
  getAdaptiveTrackingInterval,
  projectTwoHandInference
} from '../src/gesture/gestureFilters';

test.describe('gesture input filtering', () => {
  test('raises smoothing response for larger hand motion', () => {
    const slow = adaptiveAlpha(0.42, 0.86, 0.004, 0.003, 0.045);
    const fast = adaptiveAlpha(0.42, 0.86, 0.05, 0.003, 0.045);

    expect(slow).toBeGreaterThanOrEqual(0.42);
    expect(fast).toBeCloseTo(0.86, 4);
    expect(fast).toBeGreaterThan(slow);
  });

  test('predicts two-hand control without exceeding anti-overshoot caps', () => {
    const projected = projectTwoHandInference(
      {
        timestamp: 1000,
        value: {
          center: { x: 0.2, y: 0.25 },
          distance: 0.34,
          angle: 0.1
        }
      },
      {
        center: { x: 0.36, y: 0.12 },
        distance: 0.52,
        angle: 0.42
      },
      1072
    );

    expect(projected.center.x).toBeLessThanOrEqual(0.395001);
    expect(projected.center.y).toBeGreaterThanOrEqual(0.084999);
    expect(projected.distance).toBeLessThanOrEqual(0.575001);
    expect(projected.angle).toBeLessThanOrEqual(0.515001);
  });

  test('adapts tracking cadence to model latency within guardrails', () => {
    expect(getAdaptiveTrackingInterval(0, 58, 96)).toBe(58);
    expect(getAdaptiveTrackingInterval(49, 58, 96)).toBeCloseTo(58, 0);
    expect(getAdaptiveTrackingInterval(72, 58, 96)).toBeCloseTo(85, 0);
    expect(getAdaptiveTrackingInterval(140, 58, 96)).toBe(96);
    expect(getAdaptiveTrackingInterval(72, 58, 96, 1.18, 20)).toBeCloseTo(100, 0);
    expect(getAdaptiveTrackingInterval(72, 58, 96, 1.18, 16)).toBeCloseTo(116, 0);
  });

  test('reduces detection frame size as hand model latency rises', () => {
    expect(getAdaptiveDetectionFrameSize(24)).toEqual({ width: 392, height: 220 });
    expect(getAdaptiveDetectionFrameSize(38)).toEqual({ width: 360, height: 202 });
    expect(getAdaptiveDetectionFrameSize(44)).toEqual({ width: 320, height: 180 });
    expect(getAdaptiveDetectionFrameSize(56)).toEqual({ width: 288, height: 162 });
    expect(getAdaptiveDetectionFrameSize(72)).toEqual({ width: 256, height: 144 });
    expect(getAdaptiveDetectionFrameSize(96)).toEqual({ width: 256, height: 144 });
    expect(getAdaptiveDetectionFrameSize(56, 20)).toEqual({ width: 224, height: 126 });
    expect(getAdaptiveDetectionFrameSize(68, 20)).toEqual({ width: 192, height: 108 });
    expect(getAdaptiveDetectionFrameSize(44, 16)).toEqual({ width: 192, height: 108 });
  });
});
