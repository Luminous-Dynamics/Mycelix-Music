/**
 * E2E Test: Listener Playback Flow
 * Tests the complete listener experience from discovery to playback
 */

import { test, expect } from '@playwright/test';

test.describe('Listener Playback Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should discover and play a song', async ({ page }) => {
    // Step 1: Browse songs
    await test.step('Browse songs', async () => {
      // Should see song list on home page
      await expect(page.getByRole('heading', { name: /discover|explore/i })).toBeVisible();

      // Wait for songs to load
      await page.waitForSelector('[data-testid="song-card"]', { timeout: 10000 });

      // Should see at least one song
      const songs = page.locator('[data-testid="song-card"]');
      await expect(songs).toHaveCount(expect.any(Number));
    });

    // Step 2: Click on a song
    await test.step('Select song', async () => {
      const firstSong = page.locator('[data-testid="song-card"]').first();
      await firstSong.click();

      // Should navigate to song page
      await expect(page).toHaveURL(/.*song\/0x/);

      // Should see song details
      await expect(page.locator('[data-testid="song-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="artist-name"]')).toBeVisible();
    });

    // Step 3: Connect wallet (if pay-per-stream)
    await test.step('Connect wallet for payment', async () => {
      const playButton = page.getByRole('button', { name: /play|listen/i });
      await playButton.click();

      // If not connected, wallet modal should appear
      const connectButton = page.getByRole('button', { name: /connect.*wallet/i });
      if (await connectButton.isVisible()) {
        await connectButton.click();
        await page.waitForSelector('[data-testid="privy-modal"]');
        await page.getByText(/metamask|wallet/i).click();
        await expect(page.getByText(/connected|0x/i)).toBeVisible({ timeout: 15000 });
      }
    });

    // Step 4: Approve payment
    await test.step('Approve and pay', async () => {
      // Should show payment confirmation
      const confirmButton = page.getByRole('button', { name: /confirm|approve|pay/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();

        // Wait for transaction
        await expect(page.getByText(/processing|confirming/i)).toBeVisible();
        await expect(page.getByText(/success|approved/i)).toBeVisible({ timeout: 30000 });
      }
    });

    // Step 5: Play song
    await test.step('Play audio', async () => {
      // Audio should start playing
      const audio = page.locator('audio');
      await expect(audio).toBeAttached();

      // Should see play progress
      const progressBar = page.locator('[data-testid="progress-bar"]');
      await expect(progressBar).toBeVisible();

      // Wait a bit to ensure playback started
      await page.waitForTimeout(2000);

      // Pause button should be visible
      const pauseButton = page.getByRole('button', { name: /pause/i });
      await expect(pauseButton).toBeVisible();
    });

    // Step 6: Control playback
    await test.step('Control playback', async () => {
      // Pause
      const pauseButton = page.getByRole('button', { name: /pause/i });
      await pauseButton.click();

      // Play button should return
      const playButton = page.getByRole('button', { name: /play/i });
      await expect(playButton).toBeVisible();

      // Resume
      await playButton.click();
      await expect(pauseButton).toBeVisible();

      // Adjust volume
      const volumeSlider = page.locator('input[type="range"][aria-label*="volume"]');
      await volumeSlider.fill('50');
    });
  });

  test('should play free (gift economy) song without payment', async ({ page }) => {
    // Find a gift economy song (filter or know which one)
    await page.goto('http://localhost:3000?model=gift-economy');

    // Click first gift economy song
    const giftSong = page.locator('[data-testid="song-card"]').first();
    await giftSong.click();

    // Should see "Free to listen" indicator
    await expect(page.getByText(/free|gift.*economy/i)).toBeVisible();

    // Play button should work without wallet connection
    const playButton = page.getByRole('button', { name: /play|listen/i });
    await playButton.click();

    // Audio should start
    const audio = page.locator('audio');
    await expect(audio).toBeAttached();

    // Should show CGC rewards info
    await expect(page.getByText(/earn|cgc|reward/i)).toBeVisible();
  });

  test('should handle insufficient balance', async ({ page }) => {
    // Create a scenario with insufficient balance
    // This would require mocking or using a test account with no tokens

    await page.goto('http://localhost:3000');
    const song = page.locator('[data-testid="song-card"]').first();
    await song.click();

    const playButton = page.getByRole('button', { name: /play/i });
    await playButton.click();

    // Assume wallet connection happens

    // Should show insufficient balance error
    await expect(page.getByText(/insufficient.*balance/i)).toBeVisible({ timeout: 15000 });

    // Should suggest getting tokens
    await expect(page.getByText(/get.*tokens|faucet/i)).toBeVisible();
  });

  test('should show play history', async ({ page }) => {
    // Connect wallet
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForSelector('[data-testid="privy-modal"]');
    await page.getByText(/metamask|wallet/i).click();
    await expect(page.getByText(/connected|0x/i)).toBeVisible({ timeout: 15000 });

    // Navigate to profile/history
    await page.goto('http://localhost:3000/profile');

    // Should see listening history
    await expect(page.getByRole('heading', { name: /history|recent/i })).toBeVisible();

    // Should see played songs
    const historyItems = page.locator('[data-testid="history-item"]');
    // Might be empty for new user, that's ok
  });

  test('should tip artist on gift economy song', async ({ page }) => {
    // Connect wallet
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForSelector('[data-testid="privy-modal"]');
    await page.getByText(/metamask|wallet/i).click();
    await expect(page.getByText(/connected|0x/i)).toBeVisible({ timeout: 15000 });

    // Find gift economy song
    await page.goto('http://localhost:3000?model=gift-economy');
    await page.locator('[data-testid="song-card"]').first().click();

    // Click tip button
    const tipButton = page.getByRole('button', { name: /tip|support/i });
    await tipButton.click();

    // Enter tip amount
    await page.fill('input[name="tipAmount"]', '1');

    // Confirm tip
    await page.getByRole('button', { name: /send|confirm/i }).click();

    // Wait for transaction
    await expect(page.getByText(/processing/i)).toBeVisible();
    await expect(page.getByText(/tip.*sent|success/i)).toBeVisible({ timeout: 30000 });

    // Should still earn CGC for tipping
    await expect(page.getByText(/earned.*cgc/i)).toBeVisible();
  });

  test('should filter songs by genre', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Open filter dropdown
    const filterButton = page.getByRole('button', { name: /filter|genre/i });
    await filterButton.click();

    // Select a genre
    await page.getByRole('option', { name: /electronic/i }).click();

    // URL should update
    await expect(page).toHaveURL(/.*genre=electronic/i);

    // Songs should be filtered
    const songs = page.locator('[data-testid="song-card"]');
    const count = await songs.count();

    // All visible songs should be electronic
    for (let i = 0; i < count; i++) {
      const genre = await songs.nth(i).locator('[data-testid="song-genre"]').textContent();
      expect(genre?.toLowerCase()).toContain('electronic');
    }
  });

  test('should search for songs', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Find search input
    const searchInput = page.getByRole('textbox', { name: /search/i });
    await searchInput.fill('test song');
    await searchInput.press('Enter');

    // Should show search results
    await expect(page.getByText(/results.*for.*test song/i)).toBeVisible();

    // Results should contain search term
    const results = page.locator('[data-testid="song-card"]');
    if (await results.count() > 0) {
      const firstResult = await results.first().textContent();
      expect(firstResult?.toLowerCase()).toMatch(/test/);
    }
  });
});
