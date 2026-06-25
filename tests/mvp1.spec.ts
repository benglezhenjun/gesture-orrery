import { expect, test } from '@playwright/test';

test.describe('MVP 1 solar system baseline', () => {
  test('renders a non-empty WebGL scene and live metrics', async ({ page }) => {
    await page.goto('/?capture=1');
    const canvas = page.getByTestId('orrery-canvas');
    await expect(canvas).toBeVisible();

    await expect(page.getByTestId('fps-metric')).toContainText(/\d+ FPS/);
    await page.waitForFunction(() => {
      const metric = document.querySelector('[data-testid="fps-metric"]')?.textContent ?? '';
      const fps = Number(metric.match(/(\d+)/)?.[1] ?? 0);
      return fps > 0;
    });

    await page.waitForFunction(() => {
      const source = document.querySelector('[data-testid="orrery-canvas"]') as HTMLCanvasElement | null;
      if (!source || source.width === 0 || source.height === 0) return false;
      const scratch = document.createElement('canvas');
      scratch.width = source.width;
      scratch.height = source.height;
      const context = scratch.getContext('2d');
      if (!context) return false;
      context.drawImage(source, 0, 0);
      const data = context.getImageData(0, 0, scratch.width, scratch.height).data;
      let brightPixels = 0;
      for (let index = 0; index < data.length; index += 64) {
        if (data[index] + data[index + 1] + data[index + 2] > 90) {
          brightPixels += 1;
        }
        if (brightPixels > 20) return true;
      }
      return false;
    });
  });

  test('supports pause, resume, speed changes, and list selection', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Pause simulation').click();
    await expect(page.getByTestId('playback-state')).toHaveText('Paused');

    await page.getByLabel('Resume simulation').click();
    await expect(page.getByTestId('playback-state')).toHaveText('Running');

    await page.getByLabel('Time scale').fill('120');
    await expect(page.getByText('120x')).toBeVisible();

    await page.getByTestId('planet-row-mars').click();
    await expect(page.getByTestId('selected-planet')).toHaveText('火星');
  });

  test('selects a planet from the WebGL canvas', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__orreryDebug));

    const position = await page.evaluate(() => window.__orreryDebug?.getPlanetScreenPosition('earth'));
    expect(position).toBeTruthy();
    await page.mouse.click(position!.x, position!.y);

    await expect(page.getByTestId('selected-planet')).toHaveText('地球');
  });
});
