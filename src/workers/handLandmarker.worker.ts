import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult
} from '@mediapipe/tasks-vision';

type WorkerInbound =
  | { type: 'init' }
  | { type: 'detect'; bitmap: ImageBitmap; timestamp: number };

type WorkerOutbound =
  | { type: 'ready'; delegate: 'GPU' | 'CPU' }
  | { type: 'result'; result: HandLandmarkerResult; latencyMs: number }
  | { type: 'error'; message: string };

let landmarker: HandLandmarker | null = null;

self.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  try {
    if (event.data.type === 'init') {
      const vision = await FilesetResolver.forVisionTasks(new URL('/mediapipe/wasm', self.location.origin).href, true);
      landmarker = await HandLandmarker.createFromOptions(vision, {
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
      post({ type: 'ready', delegate: 'CPU' });
      return;
    }

    if (event.data.type === 'detect') {
      if (!landmarker) {
        event.data.bitmap.close();
        throw new Error('HandLandmarker is not initialized');
      }

      const startedAt = performance.now();
      const result = landmarker.detectForVideo(event.data.bitmap, event.data.timestamp);
      const latencyMs = performance.now() - startedAt;
      event.data.bitmap.close();
      post({ type: 'result', result, latencyMs });
    }
  } catch (error) {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : 'Hand tracking worker failed'
    });
  }
};

function post(message: WorkerOutbound) {
  self.postMessage(message);
}
