import { expect, test } from '@playwright/test';

test.describe('Detailed solar system model', () => {
  test('exposes detailed bodies, guides, orbit markers, and minor planets', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__orreryDebug?.getModelStats));

    const stats = await page.evaluate(() => window.__orreryDebug!.getModelStats());

    expect(stats.planets).toBe(8);
    expect(stats.majorMoons).toBeGreaterThanOrEqual(12);
    expect(stats.surfaceDetailLayers).toBe(8);
    expect(stats.surfaceFeatureCount).toBeGreaterThanOrEqual(90);
    expect(stats.surfaceMicroPoints).toBeGreaterThanOrEqual(2460);
    expect(stats.surfaceFeatureLabels).toBeGreaterThanOrEqual(19);
    expect(stats.orbitMarkers).toBeGreaterThanOrEqual(32);
    expect(stats.orbitTicks).toBeGreaterThanOrEqual(192);
    expect(stats.fieldLines).toBeGreaterThanOrEqual(50);
    expect(stats.nightLightPoints).toBeGreaterThanOrEqual(99);
    expect(stats.namedMinorBodies).toBe(8);
    expect(stats.ringSystems).toBe(2);
  });
});
