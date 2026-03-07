import { test, expect } from '@playwright/test';
import path from 'path';

// Test data
const testUser = {
    name: 'E2E Test User',
    email: `e2e-${Date.now()}@test.com`,
    password: 'Test123!@#',
};

test.describe('EchoLink E2E Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('Complete user journey: Register → Upload → Search → Graph', async ({ page }) => {
        // Step 1: Register
        await test.step('Register new user', async () => {
            await page.click('a[href="/register"]');
            await expect(page).toHaveURL(/\/register/);

            await page.fill('input[name="name"]', testUser.name);
            await page.fill('input[type="email"]', testUser.email);
            await page.fill('input[type="password"]', testUser.password);

            await page.click('button[type="submit"]');

            // Should redirect to dashboard or login
            await page.waitForURL(/\/(dashboard|login)/, { timeout: 10000 });
        });

        // Step 2: Login (if redirected to login)
        if (page.url().includes('/login')) {
            await test.step('Login with new account', async () => {
                await page.fill('input[type="email"]', testUser.email);
                await page.fill('input[type="password"]', testUser.password);
                await page.click('button[type="submit"]');

                await page.waitForURL(/\/dashboard/, { timeout: 10000 });
            });
        }

        // Step 3: Navigate to Uploads
        await test.step('Navigate to Uploads page', async () => {
            await page.click('a[href="/uploads"]');
            await expect(page).toHaveURL(/\/uploads/);

            // Verify upload page elements
            await expect(page.locator('text=Upload Files')).toBeVisible();
        });

        // Step 4: Upload a file
        await test.step('Upload test file', async () => {
            const testContent = `[12/07/2025, 10:00] Alice: Hey, let's discuss the new AI features.
[12/07/2025, 10:01] Bob: Great! I think we should implement semantic search.
[12/07/2025, 10:02] Charlie: Agreed. Knowledge graphs would be amazing too.
[12/07/2025, 10:03] Alice: Perfect. Let's use React for the frontend.`;

            // Create temporary file
            const fileInput = page.locator('input[type="file"]');

            // Alternative: use drag and drop if file input not directly accessible
            const hasFileInput = await fileInput.count() > 0;

            if (hasFileInput) {
                // Direct file upload
                await fileInput.setInputFiles({
                    name: 'test-chat.txt',
                    mimeType: 'text/plain',
                    buffer: Buffer.from(testContent),
                });
            } else {
                // Use text upload if available
                const textUploadButton = page.locator('button:has-text("Text")');
                if (await textUploadButton.isVisible()) {
                    await textUploadButton.click();
                    await page.fill('textarea', testContent);
                    await page.fill('input[name="title"]', 'E2E Test Chat');
                    await page.click('button:has-text("Submit")');
                }
            }

            // Wait for upload to complete
            await page.waitForSelector('text=/processed|indexed/i', { timeout: 30000 });
        });

        // Step 5: Wait for indexing
        await test.step('Verify upload indexed', async () => {
            // Wait for status to show indexed
            await page.waitForSelector('text=/indexed|processed/i', { timeout: 60000 });

            // Verify fragment count > 0
            await expect(page.locator('text=/fragments/i')).toBeVisible();
        });

        // Step 6: Navigate to Search/Query page
        await test.step('Navigate to Search page', async () => {
            await page.click('a[href="/search"], a[href="/query"]');
            await page.waitForURL(/\/(search|query)/, { timeout: 5000 });
        });

        // Step 7: Perform search
        await test.step('Perform semantic search', async () => {
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('AI features and semantic search');
            await searchInput.press('Enter');

            // Wait for results
            await page.waitForSelector('text=/evidence|results|fragments/i', { timeout: 15000 });

            // Verify summary is generated
            await expect(page.locator('text=/summary|AI/i')).toBeVisible({ timeout: 10000 });
        });

        // Step 8: Check timeline
        await test.step('Verify timeline rendering', async () => {
            const timelineButton = page.locator('button:has-text("Timeline")');
            if (await timelineButton.isVisible()) {
                await timelineButton.click();

                // Verify chart/timeline visible
                await expect(page.locator('[class*="recharts"], [class*="chart"]')).toBeVisible({ timeout: 5000 });
            }
        });

        // Step 9: Open graph visualization
        await test.step('Verify graph rendering', async () => {
            const graphButton = page.locator('button:has-text("Graph")');
            if (await graphButton.isVisible()) {
                await graphButton.click();

                // Wait for graph modal/page
                await page.waitForSelector('svg, canvas', { timeout: 10000 });

                // Verify graph elements
                await expect(page.locator('svg, canvas')).toBeVisible();
            }
        });

        // Step 10: Navigate to Links page
        await test.step('Check Links page', async () => {
            const linksLink = page.locator('a[href="/links"]');
            if (await linksLink.isVisible()) {
                await linksLink.click();
                await page.waitForURL(/\/links/);

                // Verify graph visualization on links page
                await expect(page.locator('text=/knowledge graph|links/i')).toBeVisible();
            }
        });

        // Step 11: Test Admin page
        await test.step('Test Admin functions', async () => {
            const adminLink = page.locator('a[href="/admin"]');
            if (await adminLink.isVisible()) {
                await adminLink.click();
                await page.waitForURL(/\/admin/);

                // Verify admin stats
                await expect(page.locator('text=/total fragments|system status/i')).toBeVisible();

                // Test reindex button
                const reindexButton = page.locator('button:has-text("Reindex")');
                if (await reindexButton.isVisible()) {
                    await reindexButton.click();

                    // Verify success notification
                    await expect(page.locator('text=/success|reindex/i')).toBeVisible({ timeout: 5000 });
                }
            }
        });

        // Step 12: Verify dark mode toggle
        await test.step('Test dark mode', async () => {
            const themeToggle = page.locator('button[aria-label*="theme"], button:has-text("Dark"), button:has-text("Light")');
            if (await themeToggle.isVisible()) {
                await themeToggle.click();

                // Verify theme changed
                await page.waitForTimeout(500);
                const html = page.locator('html');
                const hasClass = await html.evaluate(el => el.classList.contains('dark') || el.classList.contains('light'));
                expect(hasClass).toBeTruthy();
            }
        });

        // Step 13: Logout
        await test.step('Logout', async () => {
            const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out")');
            if (await logoutButton.isVisible()) {
                await logoutButton.click();

                // Should redirect to login
                await page.waitForURL(/\/(login|auth)/, { timeout: 5000 });
            }
        });
    });

    test('Error handling: Upload invalid file', async ({ page }) => {
        // Register/Login first
        await page.goto('/login');
        // ... implement quick login ...

        await page.goto('/uploads');

        // Try to upload invalid file type
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.count() > 0) {
            await fileInput.setInputFiles({
                name: 'test.exe',
                mimeType: 'application/x-msdownload',
                buffer: Buffer.from('fake exe'),
            });

            // Should show error
            await expect(page.locator('text=/error|invalid|not allowed/i')).toBeVisible({ timeout: 5000 });
        }
    });

    test('Error handling: Invalid query', async ({ page }) => {
        // Navigate to search
        await page.goto('/search');

        // Submit empty query
        const searchInput = page.locator('input[type="text"]').first();
        await searchInput.press('Enter');

        // Should show validation error
        await expect(page.locator('text=/required|empty|invalid/i')).toBeVisible({ timeout: 2000 });
    });
});
