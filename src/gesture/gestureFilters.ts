export type GesturePoint2D = {
  x: number;
  y: number;
};

export type TwoHandFilterValue = {
  center: GesturePoint2D;
  distance: number;
  angle: number;
};

export type TimedTwoHandInference = {
  value: TwoHandFilterValue;
  timestamp: number;
};

export function pointDistance(from: GesturePoint2D, to: GesturePoint2D) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function adaptiveAlpha(min: number, max: number, motion: number, lowMotion: number, highMotion: number) {
  const t = clamp((motion - lowMotion) / Math.max(0.0001, highMotion - lowMotion), 0, 1);
  return lerpNumber(min, max, t);
}

export function projectTwoHandInference(
  previous: TimedTwoHandInference,
  current: TwoHandFilterValue,
  timestamp: number
): TwoHandFilterValue {
  const deltaSeconds = clamp((timestamp - previous.timestamp) / 1000, 0.016, 0.14);
  const lookAheadSeconds = 0.045;
  const projectedCenter = {
    x: current.center.x + clamp(((current.center.x - previous.value.center.x) / deltaSeconds) * lookAheadSeconds, -0.035, 0.035),
    y: current.center.y + clamp(((current.center.y - previous.value.center.y) / deltaSeconds) * lookAheadSeconds, -0.035, 0.035)
  };
  const projectedDistance =
    current.distance + clamp(((current.distance - previous.value.distance) / deltaSeconds) * lookAheadSeconds, -0.055, 0.055);
  const projectedAngle =
    current.angle +
    clamp((normalizeAngle(current.angle - previous.value.angle) / deltaSeconds) * lookAheadSeconds, -0.095, 0.095);

  return {
    center: projectedCenter,
    distance: Math.max(0.025, projectedDistance),
    angle: normalizeAngle(projectedAngle)
  };
}

export function normalizeAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function getAdaptiveTrackingInterval(
  latencyMs: number,
  minIntervalMs: number,
  maxIntervalMs: number,
  latencyMultiplier = 1.18,
  renderFps = 30
) {
  const fpsBudgetMultiplier = renderFps > 0 && renderFps < 18 ? 1.36 : renderFps > 0 && renderFps < 24 ? 1.18 : 1;
  const budgetedMaxInterval = renderFps > 0 && renderFps < 18 ? maxIntervalMs + 58 : renderFps > 0 && renderFps < 24 ? maxIntervalMs + 34 : maxIntervalMs;
  const budgetedMinInterval = renderFps > 0 && renderFps < 18 ? minIntervalMs + 26 : renderFps > 0 && renderFps < 24 ? minIntervalMs + 14 : minIntervalMs;

  if (latencyMs <= 0) {
    return budgetedMinInterval;
  }

  return clamp(latencyMs * latencyMultiplier * fpsBudgetMultiplier, budgetedMinInterval, budgetedMaxInterval);
}

export function getAdaptiveDetectionFrameSize(latencyMs: number, renderFps = 30) {
  if (renderFps > 0 && renderFps < 21 && latencyMs >= 64) {
    return { width: 192, height: 108 };
  }

  if (renderFps > 0 && renderFps < 18 && latencyMs >= 42) {
    return { width: 192, height: 108 };
  }

  if (renderFps > 0 && renderFps < 24 && latencyMs >= 56) {
    return { width: 224, height: 126 };
  }

  if (latencyMs >= 64) {
    return { width: 256, height: 144 };
  }

  if (latencyMs >= 52) {
    return { width: 288, height: 162 };
  }

  if (latencyMs >= 42) {
    return { width: 320, height: 180 };
  }

  if (latencyMs <= 34 && latencyMs > 0) {
    return { width: 392, height: 220 };
  }

  return { width: 360, height: 202 };
}

function lerpNumber(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
