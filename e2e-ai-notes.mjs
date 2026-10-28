import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:3000';
const results = [];
const log = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));

const clickTitle = (title) =>
  page.evaluate((t) => {
    const el = document.querySelector(`[title="${t}"]`);
    if (el) { el.click(); return true; }
    return false;
  }, title);
const clickText = (text) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find((b) => b.innerText.trim().includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, text);
const hasText = (text, timeout = 15000) =>
  page.waitForFunction((t) => document.body && document.body.innerText.includes(t), { timeout }, text)
    .then(() => true).catch(() => false);

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await clickText('New meeting');
  await sleep(300);
  await clickText('Start an instant meeting');
  await hasText('Ready to join?');
  await clickText('Join now');
  log('Host joins meeting', await hasText('HOST'));

  await clickTitle('Milo AI Notes & Summary');
  const panelOpen = await hasText('Smart AI Meeting Assistant');
  log('AI Notes panel opens', panelOpen);

  await clickText('Generate AI Summary Now');
  const gotSummary = await hasText('Milo AI Meeting Summary', 20000);
  log('Generate AI Summary Now returns a summary', gotSummary);
  const hasSections = await hasText('Action Items');
  log('Summary contains action items section', hasSections);

  await clickTitle('Leave call');
  const modalShown = await hasText('Download (.md)', 20000);
  log('Leave shows post-call summary modal', modalShown);

  await page.evaluate(() => {
    // The AI side panel also has an X; the summary modal renders last in the DOM.
    const xs = [...document.querySelectorAll('button')].filter((b) =>
      (b.querySelector('svg')?.getAttribute('class') || '').includes('lucide-x'),
    );
    xs[xs.length - 1]?.click();
  });
  await sleep(1200);
  const url = page.url();
  log('Closing summary exits to home instead of re-entering call', new URL(url).pathname === '/', url);
} catch (e) {
  log('ai notes test crashed', false, String(e).slice(0, 200));
} finally {
  await browser.close();
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
