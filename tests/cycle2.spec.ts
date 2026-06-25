import { expect, test } from '@playwright/test';

test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  }
});

test.describe('Cycle 2 hand tracking readiness', () => {
  test('serves local MediaPipe assets and exposes camera controls', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByLabel('Start hand tracking')).toBeVisible();
    await expect(page.getByTestId('hand-tracking-status')).toHaveText('not-started');
    await expect(page.getByText('Cycle 17')).toBeVisible();

    const assets = await page.evaluate(async () => {
      const [model, wasm] = await Promise.all([
        fetch('/mediapipe/models/hand_landmarker.task'),
        fetch('/mediapipe/wasm/vision_wasm_internal.wasm')
      ]);
      return {
        modelOk: model.ok,
        modelBytes: Number(model.headers.get('content-length') ?? 0) || (await model.clone().arrayBuffer()).byteLength,
        wasmOk: wasm.ok,
        wasmBytes: Number(wasm.headers.get('content-length') ?? 0) || (await wasm.clone().arrayBuffer()).byteLength
      };
    });

    expect(assets.modelOk).toBe(true);
    expect(assets.modelBytes).toBeGreaterThan(1_000_000);
    expect(assets.wasmOk).toBe(true);
    expect(assets.wasmBytes).toBeGreaterThan(1_000_000);
  });

  test('starts the local hand tracker with a fake camera stream', async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ['camera']
    });
    const page = await context.newPage();
    await page.goto('/');

    await page.getByLabel('Start hand tracking').click();
    await expect(page.getByTestId('hand-tracking-status')).toHaveText(/lost|tracking/, { timeout: 25_000 });
    await expect(page.getByLabel('Stop hand tracking')).toBeVisible();
    await expect(page.locator('.camera-watermark')).toContainText(/CPU|GPU/);
    await page.waitForTimeout(1200);

    const interactionCanvas = await page.getByTestId('orrery-canvas').evaluate((node) => {
      const canvas = node as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      return {
        width: canvas.width,
        height: canvas.height,
        cssWidth: rect.width,
        cssHeight: rect.height
      };
    });
    expect(interactionCanvas.width).toBeLessThan(interactionCanvas.cssWidth);
    expect(interactionCanvas.width).toBeGreaterThan(interactionCanvas.cssWidth * 0.37);
    expect(interactionCanvas.height).toBeGreaterThan(interactionCanvas.cssHeight * 0.37);

    await context.close();
  });
});
