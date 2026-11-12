import { expect, test } from '@playwright/test';

test.describe('StringTune primary flows', () => {
  test('navigates across all primary sections and updates document state', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Guitar Tuner' }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/Tuner \| StringTune/);

    const nav = page.getByRole('navigation', { name: 'Primary' });

    await nav.getByRole('link', { name: 'Metronome' }).click();
    await expect(
      page.getByRole('heading', { name: 'Metronome' }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/Metronome \| StringTune/);

    await nav.getByRole('link', { name: 'Chords' }).click();
    await expect(
      page.getByRole('heading', { name: 'Guitar Chord Library' }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/Chord Library \| StringTune/);

    await nav.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page).toHaveTitle(/Settings \| StringTune/);
  });

  test('requests microphone only on activation and handles permission denial and missing device gracefully', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __micCalls: number }).__micCalls = 0;
      const mode = window.sessionStorage.getItem('test-mic-mode') || 'deny';
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            (window as unknown as { __micCalls: number }).__micCalls += 1;
            if (mode === 'not-found') {
              throw new DOMException('No audio input', 'NotFoundError');
            }
            throw new DOMException('Permission denied', 'NotAllowedError');
          },
          enumerateDevices: async () => [],
        },
      });
    });

    await page.goto('/');

    const initialCalls = await page.evaluate(
      () => (window as unknown as { __micCalls: number }).__micCalls,
    );
    expect(initialCalls).toBe(0);

    await page.getByRole('button', { name: 'Start Tuner' }).click();
    await expect(page.getByRole('alert')).toContainText(
      'Microphone access blocked',
    );
    expect(
      await page.evaluate(
        () => (window as unknown as { __micCalls: number }).__micCalls,
      ),
    ).toBe(1);

    await page.evaluate(() =>
      window.sessionStorage.setItem('test-mic-mode', 'not-found'),
    );
    await page.reload();
    await page.getByRole('button', { name: 'Start Tuner' }).click();
    await expect(page.getByRole('alert')).toContainText('No microphone found');
  });

  test('runs real Web Audio pitch detection on a synthesized 82.41 Hz signal and cleans up on stop', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      let stoppedCount = 0;
      (window as unknown as { __stoppedTracks: () => number }).__stoppedTracks =
        () => stoppedCount;

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            const ctx = new AudioContext();
            if (ctx.state === 'suspended') {
              await ctx.resume();
            }
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 82.41;
            const gain = ctx.createGain();
            gain.gain.value = 0.5;
            const dest = ctx.createMediaStreamDestination();
            osc.connect(gain);
            gain.connect(dest);
            osc.start();

            const track = dest.stream.getAudioTracks()[0]!;
            const originalStop = track.stop.bind(track);
            track.stop = () => {
              stoppedCount += 1;
              try {
                osc.stop();
                void ctx.close();
              } catch {
                // ignore
              }
              originalStop();
            };

            return dest.stream;
          },
          enumerateDevices: async () => [
            { kind: 'audioinput', label: 'Synthetic E2 Sine' },
          ],
        },
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Start Tuner' }).click();

    await expect(page.getByTestId('tuner-note')).toHaveText('E', {
      timeout: 5000,
    });
    await expect(page.getByTestId('tuner-frequency')).toContainText('82.', {
      timeout: 5000,
    });
    await expect(page.getByTestId('tuner-status-hint')).toContainText(
      'Perfectly tuned',
      { timeout: 5000 },
    );

    await page.getByRole('button', { name: /String 5, A2/i }).click();
    await expect(page.getByText('FLAT', { exact: true })).toBeVisible({
      timeout: 5000,
    });

    await page.getByRole('button', { name: 'Chromatic' }).click();
    await expect(
      page.getByRole('heading', { name: 'Chromatic Tuner' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Stop Tuner' }).click();
    await expect(
      page.getByRole('button', { name: 'Start Tuner' }),
    ).toBeVisible();
    const stoppedTracks = await page.evaluate(() =>
      (window as unknown as { __stoppedTracks: () => number }).__stoppedTracks(),
    );
    expect(stoppedTracks).toBeGreaterThanOrEqual(1);
  });

  test('controls metronome BPM, time signature, start/pause/reset, and tap tempo', async ({
    page,
  }) => {
    await page.goto('/metronome');
    await expect(page.getByTestId('metronome-bpm')).toHaveText('120');

    await page.getByRole('button', { name: 'Increase BPM by 1' }).click();
    await expect(page.getByTestId('metronome-bpm')).toHaveText('121');

    await page.getByRole('button', { name: '-10' }).click();
    await expect(page.getByTestId('metronome-bpm')).toHaveText('111');

    const beatDots = page.getByTestId('beat-indicators').locator('> div');
    await expect(beatDots).toHaveCount(4);

    await page.getByRole('button', { name: '6/8' }).click();
    await expect(beatDots).toHaveCount(6);

    await page.getByRole('button', { name: '3/4' }).click();
    await expect(beatDots).toHaveCount(3);

    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(
      page.locator('[data-testid="beat-indicators"] > div[data-active="true"]'),
    ).toBeVisible({ timeout: 3000 });

    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();

    await page.getByRole('button', { name: 'Reset metronome' }).click();
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();

    const tapBtn = page.getByRole('button', { name: 'Tap Tempo' });
    await tapBtn.click();
    await page.waitForTimeout(300);
    await tapBtn.click();
    await page.waitForTimeout(300);
    await tapBtn.click();
    const tappedText = await page.getByTestId('metronome-bpm').textContent();
    const tappedBpm = Number(tappedText);
    expect(tappedBpm).toBeGreaterThanOrEqual(40);
    expect(tappedBpm).toBeLessThanOrEqual(240);
  });

  test('searches chords, filters categories, and persists favorites across reload', async ({
    page,
  }) => {
    await page.goto('/chords');

    const searchInput = page.getByPlaceholder(/Search chords/i);
    await searchInput.fill('Fmaj7');
    await expect(page.getByTestId('chord-count')).toContainText('1 chord');
    await expect(page.getByRole('heading', { name: 'Fmaj7' })).toBeVisible();

    await page.getByRole('button', { name: 'Clear chord search' }).click();

    await page.getByRole('button', { name: 'Diminished', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Bdim' })).toBeVisible();

    await page
      .getByRole('img', { name: /B Diminished chord diagram/i })
      .locator('g.cursor-pointer')
      .first()
      .click();
    await expect(page.getByText(/String \d \([EADGBe]\):/)).toBeVisible();

    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page
      .getByRole('button', { name: 'Add A Minor to favorites' })
      .click();

    await page.getByRole('button', { name: /Favorites \(1\)/ }).click();
    await expect(page.getByRole('heading', { name: 'Am' })).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: /Favorites \(1\)/ }).click();
    await expect(page.getByRole('heading', { name: 'Am' })).toBeVisible();
  });

  test('persists theme and tuning settings and passes responsive overflow check', async ({
    page,
  }) => {
    await page.goto('/settings');

    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await expect(
      page.locator('meta[name="color-scheme"]'),
    ).toHaveAttribute('content', 'light');

    await page.getByLabel('Default Tuning').selectOption('drop-d');

    await page.reload();
    await expect(
      page.locator('meta[name="color-scheme"]'),
    ).toHaveAttribute('content', 'light');

    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Tuner' })
      .click();
    await expect(page.locator('#tuner-preset-select')).toHaveValue('drop-d');

    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ['/', '/metronome', '/chords', '/settings']) {
      await page.goto(path);
      const hasOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(hasOverflow).toBe(false);
    }
  });

  test('exposes valid PWA manifest and registers service worker offline shell', async ({
    page,
  }) => {
    const manifestResponse = await page.request.get('/manifest.webmanifest');
    expect(manifestResponse.ok()).toBe(true);
    const manifest = (await manifestResponse.json()) as {
      name: string;
      short_name: string;
      display: string;
      icons: Array<{ src: string; sizes: string }>;
    };
    expect(manifest.short_name).toBe('StringTune');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((icon) => icon.sizes === '192x192')).toBe(true);
    expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);

    await page.goto('/');
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return Boolean(reg.active || reg.installing || reg.waiting);
    });
    expect(swRegistered).toBe(true);

    await page.context().setOffline(true);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Guitar Tuner' }),
    ).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Chords' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Guitar Chord Library' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'C', exact: true })).toBeVisible();
    await page.context().setOffline(false);
  });
});

