// 验证：内容内嵌（bundle）方案在 file:// 下跨浏览器是否可行
import { chromium, firefox, webkit } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const base = process.env.LOCALAPPDATA + '/ms-playwright';
const targets = [
  { name: 'chromium', type: chromium, executablePath: base + '/chromium-1234/chrome-win64/chrome.exe' },
  { name: 'firefox', type: firefox, executablePath: base + '/firefox-1538/firefox/firefox.exe' },
  { name: 'webkit', type: webkit, executablePath: base + '/webkit-2336/Playwright.exe' },
];

const fileUrl = pathToFileURL(path.join(process.cwd(), 'bundle-spike.html')).href;

for (const t of targets) {
  let browser;
  try {
    browser = await t.type.launch({ executablePath: t.executablePath });
    const page = await browser.newPage();
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(300);
    const rendered = await page.evaluate(() => window.__rendered);
    const bodyText = await page.evaluate(() => document.getElementById('out').textContent.slice(0, 80));
    console.log(`[${t.name}] __rendered=${rendered} | 内容预览: ${bodyText.replace(/\n/g, ' / ')}`);
  } catch (e) {
    console.log(`[${t.name}] ERROR: ${e.message.slice(0, 200)}`);
  } finally {
    if (browser) await browser.close();
  }
}
