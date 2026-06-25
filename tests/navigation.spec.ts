import { expect, test } from '@playwright/test';

test.describe('Cycle 14 navigation feel', () => {
  test('applies queued rotate, zoom, and pan commands inside the scene loop', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__orreryDebug?.getNavigationState));

    const before = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    await page.evaluate(() => {
      for (let index = 0; index < 8; index += 1) {
        window.__orreryDebug!.pushCommand({ type: 'zoom', delta: -0.035, source: 'camera-hand' });
        window.__orreryDebug!.pushCommand({ type: 'pan', deltaX: 0.02, deltaY: -0.012, source: 'camera-hand' });
        window.__orreryDebug!.pushCommand({ type: 'rotate', deltaX: 0.018, deltaY: 0.01, source: 'camera-hand' });
      }
    });

    await page.waitForTimeout(800);
    const after = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    expect(after.cameraDistance).toBeLessThan(before.cameraDistance - 0.2);
    expect(Math.abs(after.target.x - before.target.x) + Math.abs(after.target.y - before.target.y)).toBeGreaterThan(0.02);
    expect(Math.abs(after.systemRotation.y - before.systemRotation.y)).toBeGreaterThan(0.02);
  });

  test('focuses the selected planet for close inspection', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__orreryDebug?.getNavigationState));

    const before = await page.evaluate(() => window.__orreryDebug!.getNavigationState());
    await page.getByTestId('planet-row-jupiter').click();
    await page.waitForFunction(() => window.__orreryDebug!.getNavigationState().cameraDistance < 18);
    const after = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    expect(after.cameraDistance).toBeLessThan(before.cameraDistance - 7);
    expect(
      Math.abs(after.target.x - before.target.x) +
        Math.abs(after.target.y - before.target.y) +
        Math.abs(after.target.z - before.target.z)
    ).toBeGreaterThan(8);
  });

  test('maps one-hand pinch control to anchored zoom and pan', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__orreryDebug?.getNavigationState));

    const before = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({ type: 'pinchControl', phase: 'start', sessionId: 501, source: 'camera-hand' });
      window.__orreryDebug!.pushCommand({
        type: 'pinchControl',
        phase: 'move',
        sessionId: 501,
        centerDeltaX: 0.13,
        centerDeltaY: -0.08,
        scaleRatio: 1.62,
        source: 'camera-hand'
      });
    });

    await page.waitForTimeout(280);
    const after = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    expect(after.cameraDistance).toBeLessThan(before.cameraDistance - 10);
    expect(Math.abs(after.target.x - before.target.x) + Math.abs(after.target.y - before.target.y)).toBeGreaterThan(2.4);
  });

  test('continues tracking updated one-hand pinch targets inside one session', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__orreryDebug?.getNavigationState));

    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({ type: 'pinchControl', phase: 'start', sessionId: 502, source: 'camera-hand' });
      window.__orreryDebug!.pushCommand({
        type: 'pinchControl',
        phase: 'move',
        sessionId: 502,
        centerDeltaX: 0.04,
        centerDeltaY: -0.02,
        scaleRatio: 1.16,
        source: 'camera-hand'
      });
    });
    await page.waitForTimeout(220);
    const firstMove = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({
        type: 'pinchControl',
        phase: 'move',
        sessionId: 502,
        centerDeltaX: -0.12,
        centerDeltaY: 0.09,
        scaleRatio: 0.68,
        source: 'camera-hand'
      });
    });
    await page.waitForTimeout(280);
    const secondMove = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    expect(secondMove.cameraDistance).toBeGreaterThan(firstMove.cameraDistance + 5);
    expect(
      Math.abs(secondMove.target.x - firstMove.target.x) + Math.abs(secondMove.target.y - firstMove.target.y)
    ).toBeGreaterThan(2.3);
  });

  test.skip('bridges MediaPipe gaps with bounded one-hand pinch prediction', async ({ page }) => {

    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__orreryDebug?.getPinchControlState));

    const before = await page.evaluate(() => window.__orreryDebug!.getNavigationState());
    const unpredictedTargetDistance = before.cameraDistance / Math.pow(1.22, 1.18);

    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({ type: 'pinchControl', phase: 'start', sessionId: 604, source: 'camera-hand' });
      window.__orreryDebug!.pushCommand({
        type: 'pinchControl',
        phase: 'move',
        sessionId: 604,
        centerDeltaX: 0,
        centerDeltaY: 0,
        scaleRatio: 1,
        source: 'camera-hand'
      });
    });

    await page.waitForTimeout(70);
    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({
        type: 'pinchControl',
        phase: 'move',
        sessionId: 604,
        centerDeltaX: 0.08,
        centerDeltaY: -0.05,
        scaleRatio: 1.22,
        source: 'camera-hand'
      });
    });

    await page.waitForFunction(
      (expectedDistance) => {
        const state = window.__orreryDebug!.getPinchControlState();
        return state.targetDistance !== null && state.targetDistance < expectedDistance;
      },
      unpredictedTargetDistance - 0.4
    );
    const predicted = await page.evaluate(() => window.__orreryDebug!.getPinchControlState());

    expect(predicted.active).toBe(true);
    expect(predicted.predictedMs).toBeGreaterThan(0);
    expect(predicted.targetDistance).not.toBeNull();
    expect(predicted.targetDistance!).toBeLessThan(unpredictedTargetDistance - 0.4);
  });

  test('rebases one-hand pinch control so continued movement does not snap back', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__orreryDebug?.getNavigationState));

    const before = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({ type: 'pinchControl', phase: 'start', sessionId: 605, source: 'camera-hand' });
      window.__orreryDebug!.pushCommand({
        type: 'pinchControl',
        phase: 'rebase',
        sessionId: 605,
        centerDeltaX: 0.22,
        centerDeltaY: -0.11,
        scaleRatio: 2.05,
        source: 'camera-hand'
      });
    });

    await page.waitForTimeout(260);
    const afterRebase = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    expect(afterRebase.cameraDistance).toBeLessThan(before.cameraDistance - 10);
    expect(Math.abs(afterRebase.target.x - before.target.x) + Math.abs(afterRebase.target.y - before.target.y)).toBeGreaterThan(4);

    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({
        type: 'pinchControl',
        phase: 'move',
        sessionId: 605,
        centerDeltaX: 0.05,
        centerDeltaY: -0.03,
        scaleRatio: 1.18,
        source: 'camera-hand'
      });
    });

    await page.waitForTimeout(260);
    const afterContinue = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    expect(afterContinue.cameraDistance).toBeLessThan(afterRebase.cameraDistance - 0.5);
    expect(
      Math.abs(afterContinue.target.x - afterRebase.target.x) + Math.abs(afterContinue.target.y - afterRebase.target.y)
    ).toBeGreaterThan(0.2);
  });

  test('maps two-hand space control to direct camera transform', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__orreryDebug?.getNavigationState));

    const before = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({ type: 'spaceControl', phase: 'start', sessionId: 77, source: 'camera-hand' });
      window.__orreryDebug!.pushCommand({
        type: 'spaceControl',
        phase: 'move',
        sessionId: 77,
        centerDeltaX: 0.16,
        centerDeltaY: -0.1,
        scaleRatio: 1.75,
        rotationDelta: 0.34,
        source: 'camera-hand'
      });
    });

    await page.waitForTimeout(300);
    const after = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    expect(after.cameraDistance).toBeLessThan(before.cameraDistance - 4);
    expect(Math.abs(after.target.x - before.target.x) + Math.abs(after.target.y - before.target.y)).toBeGreaterThan(1.2);
    expect(Math.abs(after.systemRotation.y - before.systemRotation.y)).toBeGreaterThan(0.28);
  });

  test('continues tracking updated two-hand space targets within one session', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__orreryDebug?.getNavigationState));

    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({ type: 'spaceControl', phase: 'start', sessionId: 91, source: 'camera-hand' });
      window.__orreryDebug!.pushCommand({
        type: 'spaceControl',
        phase: 'move',
        sessionId: 91,
        centerDeltaX: 0.04,
        centerDeltaY: 0.02,
        scaleRatio: 1.18,
        rotationDelta: 0.08,
        source: 'camera-hand'
      });
    });
    await page.waitForTimeout(180);
    const firstMove = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({
        type: 'spaceControl',
        phase: 'move',
        sessionId: 91,
        centerDeltaX: -0.18,
        centerDeltaY: 0.12,
        scaleRatio: 0.62,
        rotationDelta: -0.32,
        source: 'camera-hand'
      });
    });

    await page.waitForTimeout(360);
    const secondMove = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    expect(secondMove.cameraDistance).toBeGreaterThan(firstMove.cameraDistance + 3);
    expect(Math.abs(secondMove.target.x - firstMove.target.x) + Math.abs(secondMove.target.y - firstMove.target.y)).toBeGreaterThan(1.2);
    expect(secondMove.systemRotation.y).toBeLessThan(firstMove.systemRotation.y - 0.25);
  });

  test('two-hand space control catches up to the latest target quickly', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__orreryDebug?.getSpaceControlState));

    const before = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({ type: 'spaceControl', phase: 'start', sessionId: 117, source: 'camera-hand' });
      window.__orreryDebug!.pushCommand({
        type: 'spaceControl',
        phase: 'move',
        sessionId: 117,
        centerDeltaX: 0.18,
        centerDeltaY: -0.12,
        scaleRatio: 1.9,
        rotationDelta: 0.36,
        source: 'camera-hand'
      });
    });

    await page.waitForTimeout(160);
    const followState = await page.evaluate(() => window.__orreryDebug!.getSpaceControlState());

    expect(followState.active).toBe(true);
    expect(followState.targetDistance).not.toBeNull();
    expect(followState.cameraDistance).toBeLessThan(before.cameraDistance - 7);
    expect(Math.abs(followState.cameraDistance - followState.targetDistance!)).toBeLessThan(0.65);
    expect(followState.targetError).not.toBeNull();
    expect(followState.targetError!).toBeLessThan(0.95);
  });

  test.skip('bridges MediaPipe gaps with bounded two-hand target prediction', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__orreryDebug?.getSpaceControlState));

    const before = await page.evaluate(() => window.__orreryDebug!.getNavigationState());
    const unpredictedTargetDistance = before.cameraDistance / Math.pow(1.22, 1.34);

    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({ type: 'spaceControl', phase: 'start', sessionId: 218, source: 'camera-hand' });
      window.__orreryDebug!.pushCommand({
        type: 'spaceControl',
        phase: 'move',
        sessionId: 218,
        centerDeltaX: 0,
        centerDeltaY: 0,
        scaleRatio: 1,
        rotationDelta: 0,
        source: 'camera-hand'
      });
    });

    await page.waitForTimeout(70);
    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({
        type: 'spaceControl',
        phase: 'move',
        sessionId: 218,
        centerDeltaX: 0.08,
        centerDeltaY: -0.06,
        scaleRatio: 1.22,
        rotationDelta: 0.16,
        source: 'camera-hand'
      });
    });

    await page.waitForFunction(
      (expectedDistance) => {
        const state = window.__orreryDebug!.getSpaceControlState();
        return state.targetDistance !== null && state.targetDistance < expectedDistance;
      },
      unpredictedTargetDistance - 0.5
    );
    const predicted = await page.evaluate(() => window.__orreryDebug!.getSpaceControlState());

    expect(predicted.active).toBe(true);
    expect(predicted.predictedMs).toBeGreaterThan(0);
    expect(predicted.targetDistance).not.toBeNull();
    expect(predicted.targetDistance!).toBeLessThan(unpredictedTargetDistance - 0.5);
  });

  test('rebases two-hand control so continued movement does not snap back', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__orreryDebug?.getNavigationState));

    const before = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({ type: 'spaceControl', phase: 'start', sessionId: 319, source: 'camera-hand' });
      window.__orreryDebug!.pushCommand({
        type: 'spaceControl',
        phase: 'rebase',
        sessionId: 319,
        centerDeltaX: 0.24,
        centerDeltaY: -0.12,
        scaleRatio: 2.2,
        rotationDelta: 0.42,
        source: 'camera-hand'
      });
    });

    await page.waitForTimeout(260);
    const afterRebase = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    expect(afterRebase.cameraDistance).toBeLessThan(before.cameraDistance - 12);
    expect(Math.abs(afterRebase.target.x - before.target.x) + Math.abs(afterRebase.target.y - before.target.y)).toBeGreaterThan(5);

    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({
        type: 'spaceControl',
        phase: 'move',
        sessionId: 319,
        centerDeltaX: 0.06,
        centerDeltaY: -0.03,
        scaleRatio: 1.2,
        rotationDelta: 0.1,
        source: 'camera-hand'
      });
    });

    await page.waitForTimeout(260);
    const afterContinue = await page.evaluate(() => window.__orreryDebug!.getNavigationState());

    expect(afterContinue.cameraDistance).toBeLessThan(afterRebase.cameraDistance - 0.7);
    expect(
      Math.abs(afterContinue.target.x - afterRebase.target.x) + Math.abs(afterContinue.target.y - afterRebase.target.y)
    ).toBeGreaterThan(0.25);
    expect(afterContinue.systemRotation.y).toBeGreaterThan(afterRebase.systemRotation.y + 0.08);
  });

  test('coalesces stale direct-control moves before applying the scene target', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__orreryDebug?.getCommandStats));

    await page.evaluate(() => {
      window.__orreryDebug!.pushCommand({ type: 'spaceControl', phase: 'start', sessionId: 620, source: 'camera-hand' });
      for (let index = 0; index < 14; index += 1) {
        window.__orreryDebug!.pushCommand({
          type: 'spaceControl',
          phase: 'move',
          sessionId: 620,
          centerDeltaX: -0.18 + index * 0.026,
          centerDeltaY: 0.12 - index * 0.014,
          scaleRatio: 0.72 + index * 0.09,
          rotationDelta: -0.22 + index * 0.042,
          source: 'camera-hand'
        });
      }
    });

    await page.waitForFunction(() => window.__orreryDebug!.getCommandStats().raw >= 15);
    const stats = await page.evaluate(() => window.__orreryDebug!.getCommandStats());
    const followState = await page.evaluate(() => window.__orreryDebug!.getSpaceControlState());

    expect(stats.raw).toBe(15);
    expect(stats.coalesced).toBe(2);
    expect(stats.droppedDirect).toBe(13);
    expect(followState.active).toBe(true);
    expect(followState.targetDistance).not.toBeNull();
  });
});
