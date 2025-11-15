/**
 * E2E Test: Artist Upload Flow
 * Tests the complete artist song upload process from start to finish
 */

import { test, expect } from '@playwright/test';

test.describe('Artist Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('http://localhost:3000');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should complete full artist upload flow', async ({ page }) => {
    // Step 1: Connect wallet
    await test.step('Connect wallet', async () => {
      const connectButton = page.getByRole('button', { name: /connect/i });
      await connectButton.click();

      // Wait for Privy modal
      await page.waitForSelector('[data-testid="privy-modal"]', { timeout: 10000 });

      // Select wallet (mock wallet for testing)
      const walletOption = page.getByText(/metamask|wallet/i);
      await walletOption.click();

      // Wait for connection to complete
      await expect(page.getByText(/connected|0x/i)).toBeVisible({ timeout: 15000 });
    });

    // Step 2: Navigate to upload page
    await test.step('Navigate to upload', async () => {
      const uploadButton = page.getByRole('link', { name: /upload/i });
      await uploadButton.click();

      await expect(page).toHaveURL(/.*upload/);
    });

    // Step 3: Upload audio file
    await test.step('Upload audio file', async () => {
      const fileInput = page.locator('input[type="file"][accept*="audio"]');
      await fileInput.setInputFiles('tests/fixtures/test-song.mp3');

      // Wait for file to upload
      await expect(page.getByText(/uploaded|success/i)).toBeVisible({ timeout: 30000 });
    });

    // Step 4: Upload cover art
    await test.step('Upload cover art', async () => {
      const fileInput = page.locator('input[type="file"][accept*="image"]');
      await fileInput.setInputFiles('tests/fixtures/cover-art.jpg');

      await expect(page.getByText(/cover.*uploaded/i)).toBeVisible();
    });

    // Step 5: Fill in metadata
    await test.step('Fill metadata', async () => {
      await page.fill('input[name="title"]', 'Test Song E2E');
      await page.fill('input[name="artist"]', 'E2E Test Artist');
      await page.fill('input[name="album"]', 'E2E Test Album');
      await page.selectOption('select[name="genre"]', 'Electronic');
      await page.fill('textarea[name="description"]', 'This is a test song for E2E testing');

      // Click next
      await page.getByRole('button', { name: /next/i }).click();
    });

    // Step 6: Choose economic model
    await test.step('Choose economic model', async () => {
      // Select pay-per-stream
      await page.getByRole('radio', { name: /pay.*per.*stream/i }).click();

      // Set price
      await page.fill('input[name="price"]', '0.01');

      await page.getByRole('button', { name: /next/i }).click();
    });

    // Step 7: Configure revenue splits
    await test.step('Configure splits', async () => {
      // Default should be 100% to artist
      const percentageInput = page.locator('input[name="percentage"]').first();
      await expect(percentageInput).toHaveValue('100');

      await page.getByRole('button', { name: /next/i }).click();
    });

    // Step 8: Review and submit
    await test.step('Review and submit', async () => {
      // Verify summary
      await expect(page.getByText('Test Song E2E')).toBeVisible();
      await expect(page.getByText('E2E Test Artist')).toBeVisible();
      await expect(page.getByText(/0\.01/)).toBeVisible();

      // Submit
      const submitButton = page.getByRole('button', { name: /publish|submit/i });
      await submitButton.click();

      // Wait for blockchain transaction
      await expect(page.getByText(/processing|confirming/i)).toBeVisible();

      // Wait for success
      await expect(page.getByText(/success|published/i)).toBeVisible({ timeout: 60000 });
    });

    // Step 9: Verify song appears in library
    await test.step('Verify in library', async () => {
      await page.goto('http://localhost:3000/library');

      await expect(page.getByText('Test Song E2E')).toBeVisible();
      await expect(page.getByText('E2E Test Artist')).toBeVisible();
    });
  });

  test('should handle upload errors gracefully', async ({ page }) => {
    // Connect wallet
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForSelector('[data-testid="privy-modal"]');
    const walletOption = page.getByText(/metamask|wallet/i);
    await walletOption.click();
    await expect(page.getByText(/connected|0x/i)).toBeVisible({ timeout: 15000 });

    // Navigate to upload
    await page.goto('http://localhost:3000/upload');

    // Try to submit without files
    await page.fill('input[name="title"]', 'Invalid Song');
    await page.getByRole('button', { name: /next/i }).click();

    // Should show error
    await expect(page.getByText(/required|please.*upload/i)).toBeVisible();
  });

  test('should validate price input', async ({ page }) => {
    await page.goto('http://localhost:3000/upload');

    // Try invalid prices
    await page.fill('input[name="price"]', '-1');
    await page.getByRole('button', { name: /next/i }).click();

    await expect(page.getByText(/invalid|positive/i)).toBeVisible();

    await page.fill('input[name="price"]', '0');
    await page.getByRole('button', { name: /next/i }).click();

    await expect(page.getByText(/must be greater/i)).toBeVisible();
  });

  test('should validate revenue splits sum to 100%', async ({ page }) => {
    await page.goto('http://localhost:3000/upload');

    // Navigate to splits configuration
    // ... fill previous steps ...

    // Add recipient
    await page.getByRole('button', { name: /add.*recipient/i }).click();

    // Set invalid percentages (60% + 50% = 110%)
    const percentageInputs = page.locator('input[name="percentage"]');
    await percentageInputs.nth(0).fill('60');
    await percentageInputs.nth(1).fill('50');

    await page.getByRole('button', { name: /next/i }).click();

    await expect(page.getByText(/must.*100/i)).toBeVisible();
  });
});
