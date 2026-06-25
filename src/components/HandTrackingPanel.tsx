import { useEffect, useRef, useState } from 'react';
import { Camera, Hand, Loader2, Square } from 'lucide-react';
import {
  type HandLandmarker,
  type HandLandmarkerResult,
  type NormalizedLandmark
} from '@mediapipe/tasks-vision';
import type { GestureCommand, HandTrackingState } from '../gesture/gestureTypes';
import { initialHandTrackingState } from '../gesture/gestureTypes';
import {
  adaptiveAlpha,
  getAdaptiveDetectionFrameSize,
  getAdaptiveTrackingInterval,
  normalizeAngle,
  pointDistance,
  projectTwoHandInference,
  type TimedTwoHandInference
} from '../gesture/gestureFilters';

type HandTrackingPanelProps = {
  state: HandTrackingState;
  renderFps: number;
  onStateChange: (state: HandTrackingState) => void;
  onCommand: (command: GestureCommand) => void;
};

type Point2D = {
  x: number;
  y: number;
};

type GestureInference = {
  name: string;
  confidence: number;
  center: Point2D;
  pinchRatio: number;
};

type TwoHandInference = {
  center: Point2D;
  distance: number;
  angle: number;
};

type HandWorkerMessage =
  | { type: 'ready'; delegate: 'GPU' | 'CPU' }
  | { type: 'result'; result: HandLandmarkerResult; latencyMs: number }
  | { type: 'error'; message: string };

type TrackerInfo =
  | { mode: 'worker'; worker: Worker; delegate: 'GPU' | 'CPU' }
  | { mode: 'main'; landmarker: HandLandmarker; delegate: 'GPU' | 'CPU' };

const minTrackingInferenceIntervalMs = 58;
const maxTrackingInferenceIntervalMs = 96;
const searchingInferenceIntervalMs = 180;
const uiCommitIntervalMs = 120;
const centerSmoothing = 0.62;
const pinchSmoothing = 0.58;
const twoHandSmoothing = 0.66;
const pinchRebaseCenterThreshold = 0.19;
const pinchRebaseScaleThreshold = 0.5;
const twoHandRebaseCenterThreshold = 0.22;
const twoHandRebaseScaleThreshold = 0.52;
const twoHandRebaseRotationThreshold = 0.68;
const handConnections = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20]
] as const;

export function HandTrackingPanel({ state, renderFps, onStateChange, onCommand }: HandTrackingPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerReadyRef = useRef(false);
  const processingFrameRef = useRef(false);
  const mainLandmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef(0);
  const startingRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const lastInferenceAtRef = useRef(0);
  const lastInferenceLatencyRef = useRef(0);
  const lastUiCommitRef = useRef(0);
  const stateRef = useRef(state);
  const renderFpsRef = useRef(renderFps);
  const lastCenterRef = useRef<Point2D | null>(null);
  const smoothedCenterRef = useRef<Point2D | null>(null);
  const smoothedPinchRef = useRef<number | null>(null);
  const lastTwoHandRef = useRef<TwoHandInference | null>(null);
  const smoothedTwoHandRef = useRef<TwoHandInference | null>(null);
  const twoHandFilterSampleRef = useRef<TimedTwoHandInference | null>(null);
  const pinchAnchorRef = useRef<GestureInference | null>(null);
  const pinchSessionIdRef = useRef(0);
  const twoHandAnchorRef = useRef<TwoHandInference | null>(null);
  const twoHandSessionIdRef = useRef(0);
  const lastGestureRef = useRef('none');
  const lastFistToggleRef = useRef(0);
  const [delegate, setDelegate] = useState<'GPU' | 'CPU' | 'idle'>('idle');

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    renderFpsRef.current = renderFps;
  }, [renderFps]);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  const patchState = (patch: Partial<HandTrackingState>, force = false) => {
    const previous = stateRef.current;
    const next = {
      ...initialHandTrackingState,
      ...previous,
      ...patch
    };
    stateRef.current = next;

    const now = performance.now();
    const statusChanged = previous.status !== next.status;
    const gestureChanged = previous.gestureName !== next.gestureName;
    if (force || statusChanged || gestureChanged || now - lastUiCommitRef.current >= uiCommitIntervalMs) {
      lastUiCommitRef.current = now;
      onStateChange(next);
    }
  };

  const createHandWorker = () =>
    new Promise<{ worker: Worker; delegate: 'GPU' | 'CPU' }>((resolve, reject) => {
      const worker = new Worker(new URL('../workers/handLandmarker.worker.ts', import.meta.url), { type: 'module' });
      let settled = false;

      worker.onmessage = (event: MessageEvent<HandWorkerMessage>) => {
        if (event.data.type === 'ready') {
          settled = true;
          resolve({ worker, delegate: event.data.delegate });
          return;
        }

        if (event.data.type === 'result') {
          processingFrameRef.current = false;
          handleResult(event.data.result, event.data.latencyMs);
          return;
        }

        if (event.data.type === 'error') {
          processingFrameRef.current = false;
          if (!settled) {
            worker.terminate();
            reject(new Error(event.data.message));
            return;
          }
          patchState(
            {
              status: 'error',
              gestureName: 'worker error',
              message: event.data.message
            },
            true
          );
        }
      };

      worker.onerror = (event) => {
        processingFrameRef.current = false;
        if (!settled) {
          worker.terminate();
          reject(new Error(event.message));
          return;
        }
        patchState(
          {
            status: 'error',
            gestureName: 'worker error',
            message: event.message
          },
          true
        );
      };

      worker.postMessage({ type: 'init' });
    });

  const createTracker = async (): Promise<TrackerInfo> => {
    try {
      const workerInfo = await createHandWorker();
      return { mode: 'worker', ...workerInfo };
    } catch (error) {
      console.warn('Hand tracking worker unavailable; falling back to main thread.', error);
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      try {
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/mediapipe/models/hand_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.56,
          minTrackingConfidence: 0.56
        });
        return { mode: 'main', landmarker, delegate: 'GPU' };
      } catch {
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/mediapipe/models/hand_landmarker.task',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.56,
          minTrackingConfidence: 0.56
        });
        return { mode: 'main', landmarker, delegate: 'CPU' };
      }
    }
  };

  const startTracking = async () => {
    if (startingRef.current || stateRef.current.status === 'tracking' || stateRef.current.status === 'lost') return;
    startingRef.current = true;
    patchState(
      {
        available: Boolean(navigator.mediaDevices?.getUserMedia),
        status: 'requesting-camera',
        gestureName: 'loading model',
        confidence: 0,
        hands: 0,
        message: 'Loading local MediaPipe model'
      },
      true
    );

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API is not available in this browser');
      }

      const [trackerInfo, stream] = await Promise.all([
        createTracker(),
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            width: { ideal: 392, max: 424 },
            height: { ideal: 220, max: 240 },
            frameRate: { ideal: 30, max: 30 }
          }
        })
      ]);

      const video = videoRef.current;
      if (!video) return;

      if (trackerInfo.mode === 'worker') {
        workerRef.current = trackerInfo.worker;
        workerReadyRef.current = true;
      } else {
        mainLandmarkerRef.current = trackerInfo.landmarker;
        workerReadyRef.current = false;
      }
      setDelegate(trackerInfo.delegate);
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();

      startingRef.current = false;
      lastInferenceAtRef.current = 0;
      lastInferenceLatencyRef.current = 0;
      patchState(
        {
          available: true,
          status: 'lost',
          gestureName: 'waiting for hand',
          confidence: 0,
          hands: 0,
          latencyMs: 0,
          message: 'Camera active'
        },
        true
      );
      frameRef.current = requestAnimationFrame(trackFrame);
    } catch (error) {
      console.error(error);
      startingRef.current = false;
      patchState(
        {
          status: 'error',
          gestureName: 'camera error',
          confidence: 0,
          hands: 0,
          message: error instanceof Error ? error.message : 'Unable to start hand tracking'
        },
        true
      );
    }
  };

  const stopTracking = () => {
    cancelAnimationFrame(frameRef.current);
    workerRef.current?.terminate();
    workerRef.current = null;
    workerReadyRef.current = false;
    processingFrameRef.current = false;
    lastInferenceLatencyRef.current = 0;
    mainLandmarkerRef.current?.close();
    mainLandmarkerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    endPinchSession();
    endTwoHandSession();
    resetGestureMemory();
    setDelegate('idle');
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    clearOverlay();
    stateRef.current = initialHandTrackingState;
    onStateChange(initialHandTrackingState);
  };

  const trackFrame = (now: number) => {
    const worker = workerRef.current;
    const mainLandmarker = mainLandmarkerRef.current;
    const video = videoRef.current;
    if ((!worker && !mainLandmarker) || !video) return;

    if (
      !processingFrameRef.current &&
      now - lastInferenceAtRef.current >= getInferenceInterval() &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.currentTime !== lastVideoTimeRef.current
    ) {
      lastInferenceAtRef.current = now;
      lastVideoTimeRef.current = video.currentTime;
      if (worker && workerReadyRef.current) {
        processingFrameRef.current = true;
        const detectionFrameSize = getAdaptiveDetectionFrameSize(lastInferenceLatencyRef.current, renderFpsRef.current);
        createImageBitmap(video, {
          resizeWidth: detectionFrameSize.width,
          resizeHeight: detectionFrameSize.height,
          resizeQuality: 'low'
        })
          .then((bitmap) => {
            worker.postMessage({ type: 'detect', bitmap, timestamp: performance.now() }, [bitmap]);
          })
          .catch((error) => {
            processingFrameRef.current = false;
            patchState(
              {
                status: 'error',
                gestureName: 'frame error',
                message: error instanceof Error ? error.message : 'Unable to capture camera frame'
              },
              true
            );
          });
      } else if (mainLandmarker) {
        const startedAt = performance.now();
        const result = mainLandmarker.detectForVideo(video, startedAt);
        handleResult(result, performance.now() - startedAt);
      }
    }

    frameRef.current = requestAnimationFrame(trackFrame);
  };

  const handleResult = (result: HandLandmarkerResult, latencyMs: number) => {
    lastInferenceLatencyRef.current = latencyMs;
    drawOverlay(result.landmarks);
    const firstHand = result.landmarks[0];
    const handedness = result.handedness[0]?.[0];

    if (!firstHand) {
      endPinchSession();
      endTwoHandSession();
      resetGestureMemory();
      patchState({
        status: 'lost',
        gestureName: 'no hand',
        confidence: 0,
        latencyMs,
        hands: 0,
        message: 'Camera active'
      });
      return;
    }

    if (result.landmarks.length >= 2) {
      endPinchSession();
      const twoHand = smoothTwoHandInference(inferTwoHandGesture(result.landmarks[0], result.landmarks[1]));
      emitTwoHandCommand(twoHand);
      patchState({
        status: 'tracking',
        gestureName: 'two-hand space',
        confidence: Math.max(result.handedness[0]?.[0]?.score ?? 0, result.handedness[1]?.[0]?.score ?? 0, 0.72),
        latencyMs,
        hands: result.landmarks.length,
        message: 'Two hands tracked'
      });
      return;
    }

    endTwoHandSession();
    lastTwoHandRef.current = null;
    smoothedTwoHandRef.current = null;
    twoHandFilterSampleRef.current = null;
    const inference = smoothInference(inferGesture(firstHand));
    emitGestureCommand(inference);
    patchState({
      status: 'tracking',
      gestureName: inference.name,
      confidence: Math.max(inference.confidence, handedness?.score ?? 0),
      latencyMs,
      hands: result.landmarks.length,
      message: `${handedness?.categoryName ?? 'Hand'} tracked`
    });
  };

  const emitGestureCommand = (inference: GestureInference) => {
    const previousCenter = lastCenterRef.current;
    const gestureChanged = inference.name !== lastGestureRef.current;
    lastGestureRef.current = inference.name;

    if (inference.name !== 'pinch') {
      endPinchSession();
    }

    if (gestureChanged) {
      if (inference.name === 'pinch') {
        beginPinchSession(inference);
      }
      lastCenterRef.current = inference.center;
      return;
    }

    const deltaX = previousCenter ? inference.center.x - previousCenter.x : 0;
    const deltaY = previousCenter ? inference.center.y - previousCenter.y : 0;
    const movement = Math.abs(deltaX) + Math.abs(deltaY);

    if (inference.name === 'pinch') {
      emitPinchControlCommand(inference);
      lastCenterRef.current = inference.center;
      return;
    }

    if (inference.name === 'fist') {
      const now = performance.now();
      if (now - lastFistToggleRef.current > 1150) {
        lastFistToggleRef.current = now;
        onCommand({ type: 'togglePause', source: 'camera-hand' });
      }
      lastCenterRef.current = inference.center;
      return;
    }

    if (inference.name === 'open palm' && movement > 0.003) {
      onCommand({ type: 'rotate', deltaX, deltaY, source: 'camera-hand' });
    }

    lastCenterRef.current = inference.center;
  };

  const beginPinchSession = (inference: GestureInference) => {
    pinchSessionIdRef.current += 1;
    pinchAnchorRef.current = inference;
    onCommand({ type: 'pinchControl', phase: 'start', sessionId: pinchSessionIdRef.current, source: 'camera-hand' });
  };

  const emitPinchControlCommand = (inference: GestureInference) => {
    if (!pinchAnchorRef.current) {
      beginPinchSession(inference);
      return;
    }

    const anchor = pinchAnchorRef.current;
    const centerDeltaX = inference.center.x - anchor.center.x;
    const centerDeltaY = inference.center.y - anchor.center.y;
    const scaleRatio = clamp(inference.pinchRatio / Math.max(anchor.pinchRatio, 0.001), 0.45, 2.35);
    const shouldRebase =
      Math.hypot(centerDeltaX, centerDeltaY) > pinchRebaseCenterThreshold ||
      Math.abs(Math.log(scaleRatio)) > pinchRebaseScaleThreshold;

    onCommand({
      type: 'pinchControl',
      phase: shouldRebase ? 'rebase' : 'move',
      sessionId: pinchSessionIdRef.current,
      centerDeltaX,
      centerDeltaY,
      scaleRatio,
      source: 'camera-hand'
    });

    if (shouldRebase) {
      pinchAnchorRef.current = inference;
    }
  };

  const endPinchSession = () => {
    if (!pinchAnchorRef.current) return;
    onCommand({ type: 'pinchControl', phase: 'end', sessionId: pinchSessionIdRef.current, source: 'camera-hand' });
    pinchAnchorRef.current = null;
  };

  const emitTwoHandCommand = (inference: TwoHandInference) => {
    lastGestureRef.current = 'two-hand space';
    lastCenterRef.current = inference.center;

    if (!twoHandAnchorRef.current) {
      twoHandSessionIdRef.current += 1;
      twoHandAnchorRef.current = inference;
      lastTwoHandRef.current = inference;
      onCommand({ type: 'spaceControl', phase: 'start', sessionId: twoHandSessionIdRef.current, source: 'camera-hand' });
      return;
    }

    const anchor = twoHandAnchorRef.current;
    const centerDeltaX = inference.center.x - anchor.center.x;
    const centerDeltaY = inference.center.y - anchor.center.y;
    const scaleRatio = clamp(inference.distance / Math.max(anchor.distance, 0.001), 0.38, 2.8);
    const rotationDelta = normalizeAngle(inference.angle - anchor.angle);
    const shouldRebase =
      Math.hypot(centerDeltaX, centerDeltaY) > twoHandRebaseCenterThreshold ||
      Math.abs(Math.log(scaleRatio)) > twoHandRebaseScaleThreshold ||
      Math.abs(rotationDelta) > twoHandRebaseRotationThreshold;

    onCommand({
      type: 'spaceControl',
      phase: shouldRebase ? 'rebase' : 'move',
      sessionId: twoHandSessionIdRef.current,
      centerDeltaX,
      centerDeltaY,
      scaleRatio,
      rotationDelta,
      source: 'camera-hand'
    });

    if (shouldRebase) {
      twoHandAnchorRef.current = inference;
    }
    lastTwoHandRef.current = inference;
  };

  const endTwoHandSession = () => {
    if (!twoHandAnchorRef.current) return;
    onCommand({ type: 'spaceControl', phase: 'end', sessionId: twoHandSessionIdRef.current, source: 'camera-hand' });
    twoHandAnchorRef.current = null;
    lastTwoHandRef.current = null;
    twoHandFilterSampleRef.current = null;
  };

  const drawOverlay = (hands: NormalizedLandmark[][]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !video || !context) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    context.clearRect(0, 0, width, height);
    context.lineWidth = 3;
    context.strokeStyle = 'rgba(148, 232, 210, 0.88)';
    context.fillStyle = 'rgba(255, 202, 112, 0.95)';

    for (const landmarks of hands) {
      for (const [startIndex, endIndex] of handConnections) {
        const start = landmarks[startIndex];
        const end = landmarks[endIndex];
        if (!start || !end) continue;
        context.beginPath();
        context.moveTo((1 - start.x) * width, start.y * height);
        context.lineTo((1 - end.x) * width, end.y * height);
        context.stroke();
      }

      for (const landmark of landmarks) {
        context.beginPath();
        context.arc((1 - landmark.x) * width, landmark.y * height, 3.2, 0, Math.PI * 2);
        context.fill();
      }
    }
  };

  const clearOverlay = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const resetGestureMemory = () => {
    lastCenterRef.current = null;
    smoothedCenterRef.current = null;
    smoothedPinchRef.current = null;
    lastTwoHandRef.current = null;
    smoothedTwoHandRef.current = null;
    twoHandFilterSampleRef.current = null;
    pinchAnchorRef.current = null;
    twoHandAnchorRef.current = null;
    lastGestureRef.current = 'none';
  };

  const isStarting = state.status === 'requesting-camera';
  const isActive = state.status === 'tracking' || state.status === 'lost';

  return (
    <section className={isActive ? 'camera-panel active' : 'camera-panel'} aria-label="Hand tracking panel">
      <div className="camera-preview">
        <video ref={videoRef} muted playsInline aria-label="Camera preview" />
        <canvas ref={canvasRef} aria-label="Hand landmark overlay" />
        <div className="camera-watermark">
          <Hand size={15} aria-hidden="true" />
          <span>{delegate === 'idle' ? 'MediaPipe' : `${delegate} / adaptive`}</span>
        </div>
      </div>

      <div className="camera-controls">
        <button
          className={isActive ? 'icon-button danger' : 'icon-button primary'}
          type="button"
          aria-label={isActive ? 'Stop hand tracking' : 'Start hand tracking'}
          onClick={isActive ? stopTracking : startTracking}
          disabled={isStarting}
        >
          {isStarting ? (
            <Loader2 className="spin" size={18} aria-hidden="true" />
          ) : isActive ? (
            <Square size={17} aria-hidden="true" />
          ) : (
            <Camera size={18} aria-hidden="true" />
          )}
        </button>
        <div>
          <span>Hand gesture</span>
          <strong data-testid="hand-gesture-name">{state.gestureName}</strong>
        </div>
      </div>
    </section>
  );

  function smoothInference(inference: GestureInference): GestureInference {
    const centerMotion = smoothedCenterRef.current ? pointDistance(smoothedCenterRef.current, inference.center) : 1;
    const pinchMotion = smoothedPinchRef.current !== null ? Math.abs(smoothedPinchRef.current - inference.pinchRatio) : 1;
    const centerAlpha = adaptiveAlpha(centerSmoothing - 0.18, 0.86, centerMotion, 0.003, 0.045);
    const pinchAlpha = adaptiveAlpha(pinchSmoothing - 0.14, 0.82, pinchMotion, 0.004, 0.08);
    const center = smoothedCenterRef.current
      ? lerpPoint(smoothedCenterRef.current, inference.center, centerAlpha)
      : inference.center;
    const pinchRatio =
      smoothedPinchRef.current !== null
        ? lerpNumber(smoothedPinchRef.current, inference.pinchRatio, pinchAlpha)
        : inference.pinchRatio;

    smoothedCenterRef.current = center;
    smoothedPinchRef.current = pinchRatio;
    return { ...inference, center, pinchRatio };
  }

  function smoothTwoHandInference(inference: TwoHandInference): TwoHandInference {
    const now = performance.now();
    const previous = smoothedTwoHandRef.current;
    const motion = previous
      ? pointDistance(previous.center, inference.center) +
        Math.abs(previous.distance - inference.distance) * 0.5 +
        Math.abs(normalizeAngle(inference.angle - previous.angle)) * 0.12
      : 1;
    const alpha = adaptiveAlpha(twoHandSmoothing - 0.2, 0.9, motion, 0.004, 0.055);
    const smoothed = previous
      ? {
          center: lerpPoint(previous.center, inference.center, alpha),
          distance: lerpNumber(previous.distance, inference.distance, alpha),
          angle: lerpAngle(previous.angle, inference.angle, alpha)
        }
      : inference;
    const previousSample = twoHandFilterSampleRef.current;
    smoothedTwoHandRef.current = smoothed;
    twoHandFilterSampleRef.current = { value: smoothed, timestamp: now };

    if (!previousSample) return smoothed;

    return projectTwoHandInference(previousSample, smoothed, now);
  }

  function getInferenceInterval() {
    if (stateRef.current.status !== 'tracking') {
      if (renderFpsRef.current > 0 && renderFpsRef.current < 18) {
        return searchingInferenceIntervalMs + 180;
      }

      if (renderFpsRef.current > 0 && renderFpsRef.current < 24) {
        return searchingInferenceIntervalMs + 100;
      }

      return searchingInferenceIntervalMs;
    }

    if (lastInferenceLatencyRef.current <= 0) {
      return getAdaptiveTrackingInterval(0, minTrackingInferenceIntervalMs, maxTrackingInferenceIntervalMs, 1.18, renderFpsRef.current);
    }

    return getAdaptiveTrackingInterval(
      lastInferenceLatencyRef.current,
      minTrackingInferenceIntervalMs,
      maxTrackingInferenceIntervalMs,
      1.18,
      renderFpsRef.current
    );
  }
}

function inferGesture(landmarks: NormalizedLandmark[]): GestureInference {
  const center = averageLandmarks([landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]]);
  const palmWidth = Math.max(distance(landmarks[5], landmarks[17]), 0.001);
  const pinchRatio = distance(landmarks[4], landmarks[8]) / palmWidth;
  const fingersFolded = [8, 12, 16, 20].filter((tipIndex) => landmarks[tipIndex].y > landmarks[tipIndex - 2].y).length;
  const fingersOpen = [8, 12, 16, 20].filter((tipIndex) => landmarks[tipIndex].y < landmarks[tipIndex - 2].y).length;

  if (pinchRatio < 0.48) {
    return { name: 'pinch', confidence: 0.92 - pinchRatio, center, pinchRatio };
  }

  if (fingersFolded >= 4) {
    return { name: 'fist', confidence: 0.84, center, pinchRatio };
  }

  if (fingersOpen >= 3) {
    return { name: 'open palm', confidence: 0.8, center, pinchRatio };
  }

  return { name: 'pointing', confidence: 0.62, center, pinchRatio };
}

function inferTwoHandGesture(firstHand: NormalizedLandmark[], secondHand: NormalizedLandmark[]): TwoHandInference {
  const firstCenter = averageLandmarks([firstHand[0], firstHand[5], firstHand[9], firstHand[13], firstHand[17]]);
  const secondCenter = averageLandmarks([secondHand[0], secondHand[5], secondHand[9], secondHand[13], secondHand[17]]);
  return {
    center: {
      x: (firstCenter.x + secondCenter.x) / 2,
      y: (firstCenter.y + secondCenter.y) / 2
    },
    distance: Math.hypot(firstCenter.x - secondCenter.x, firstCenter.y - secondCenter.y),
    angle: Math.atan2(secondCenter.y - firstCenter.y, secondCenter.x - firstCenter.x)
  };
}

function averageLandmarks(points: NormalizedLandmark[]) {
  const total = points.reduce(
    (accumulator, point) => ({
      x: accumulator.x + (1 - point.x),
      y: accumulator.y + point.y
    }),
    { x: 0, y: 0 }
  );
  return {
    x: total.x / points.length,
    y: total.y / points.length
  };
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function lerpNumber(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
}

function lerpPoint(from: Point2D, to: Point2D, alpha: number) {
  return {
    x: lerpNumber(from.x, to.x, alpha),
    y: lerpNumber(from.y, to.y, alpha)
  };
}

function lerpAngle(from: number, to: number, alpha: number) {
  return from + normalizeAngle(to - from) * alpha;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
