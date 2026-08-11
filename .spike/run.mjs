// Playwright spike: 验证 file:// 协议下读取本地 Markdown 的浏览器行为
import { chromium, firefox, webkit } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const base = process.env.LOCALAPPDATA + '/ms-playwright';
const targets = [
  { name: 'chromium', type: chromium, executablePath: base + '/chromium-1234/chrome-win64/chrome.exe' },
  { name: 'firefox', type: firefox, executablePath: base + '/firefox-1538/firefox/firefox.exe' },
  { name: 'webkit', type: webkit, executablePath: base + '/webkit-2336/Playwright.exe' },
];

const fileUrl = pathToFileURL(path.join(process.cwd(), 'index.html')).href;
console.log('Opening:', fileUrl);

for (const t of targets) {
  let browser;
  try {
    browser = await t.type.launch({ executablePath: t.executablePath });
    const page = await browser.newPage();
    const consoleMsgs = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push(`[${m.type()}] ${m.text().slice(0, 140)}`); });
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 15000 });
    await page.waitForFunction(() => window.__results !== undefined, null, { timeout: 8000 }).catch(() => {});
    const results = await page.evaluate(() => window.__results);
    console.log(`\n========== ${t.name} ==========`);
    console.log(JSON.stringify(results, null, 2));
    if (consoleMsgs.length) { console.log(`-- console (${t.name}) --`); consoleMsgs.slice(0, 6).forEach(m => console.log(m)); }
  } catch (e) {
    console.log(`\n========== ${t.name} ==========`);
    console.log('LAUNCH/GOTO ERROR:', e.message.slice(0, 300));
  } finally {
    if (browser) await browser.close();
  }
}
