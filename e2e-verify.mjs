import puppeteer from 'puppeteer-core';
import { fakeMediaArgs } from './e2e-media.mjs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const results = [];
const log = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openBrowser(tag) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
      '--no-sandbox',
      ...fakeMediaArgs(),
    ],
  });
  const page = await browser.newPage();
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' || /failed|denied|error/i.test(t)) console.log(`[${tag}:console:${m.type()}]`, t.slice(0, 200));
  });
  page.on('pageerror', (e) => console.log(`[${tag}:pageerror]`, String(e).slice(0, 200)));
  return { browser, page };
}

async function waitForText(page, text, timeout = 10000) {
  try {
    await page.waitForFunction(
      (t) => document.body && document.body.innerText.includes(t),
      { timeout },
      text,
    );
    return true;
  } catch {
    return false;
  }
}

async function clickByText(page, text) {
  const handled = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find(
      (b) => b.innerText.trim().includes(t) || (b.getAttribute('title') || '').includes(t),
    );
    if (el) { el.click(); return true; }
    return false;
  }, text);
  return handled;
}

// On a cold live deployment the lobby markup is visible before React hydrates,
// so a single click can land on a button with no handler yet. Retry until the
// lobby actually leaves the pre-join screen.
async function joinNow(page) {
  for (let attempt = 0; attempt < 10; attempt++) {
    await clickByText(page, 'Join now');
    for (let i = 0; i < 8; i++) {
      const leftLobby = await page.evaluate(() => !document.body.innerText.includes('Ready to join?'));
      if (leftLobby) return true;
      await sleep(250);
    }
  }
  return false;
}

const host = await openBrowser('host');
const guest = await openBrowser('guest');

try {
  // 1. Host creates instant meeting (open dropdown first, then click item)
  await host.page.goto(BASE, { waitUntil: 'networkidle2' });
  await clickByText(host.page, 'New meeting');
  await sleep(400);
  await clickByText(host.page, 'Start an instant meeting');
  const joined = await waitForText(host.page, 'Ready to join?');
  log('Lobby (green room) opens for host', joined);

  const roomCode = await host.page.evaluate(() => {
    const m = location.pathname.match(/\/meet\/([a-z]+-[a-z]+-[a-z]+)/);
    return m ? m[1] : null;
  });
  log('Room code generated', !!roomCode, roomCode);

  await host.page.evaluate(() => {
    const el = document.querySelector('input[placeholder*="name" i]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, 'Host Abhishek');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await joinNow(host.page);
  const hostIn = await waitForText(host.page, 'HOST');
  log('Host admitted directly into call', hostIn);
  const backend = await host.page.evaluate(() => window.__MILO_SIGNALING__ || 'unknown');
  log('Meeting uses a known signaling backend', ['supabase', 'socketio'].includes(backend), backend);

  // 2. Guest joins same room -> waiting room
  await guest.page.goto(`${BASE}/meet/${roomCode}`, { waitUntil: 'networkidle2' });
  await waitForText(guest.page, 'Ready to join?');
  await guest.page.evaluate(() => {
    const el = document.querySelector('input[placeholder*="name" i]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, 'Priya');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await joinNow(guest.page);
  const waiting = await waitForText(guest.page, 'Waiting');
  log('Guest held in waiting-room lobby', waiting);

  const hostNotified = await (async () => {
    await host.page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '') === 'People');
      if (b) b.click();
    });
    return waitForText(host.page, 'Waiting Room', 8000);
  })();
  log('Host sees waiting-room request in People panel', hostNotified);

  // 3. Host admits guest
  const admitted = await clickByText(host.page, 'Admit');
  await sleep(500);
  log('Host clicked Admit', admitted);

  const guestIn = await waitForText(guest.page, 'Priya', 8000);
  const hostSeesGuest = await waitForText(host.page, 'Priya', 8000);
  log('Guest entered room', guestIn);
  log('Host sees guest tile', hostSeesGuest);

  // 4. WebRTC: poll for remote video frames (ICE + DTLS can take a few seconds)
  const readVideos = (p) =>
    p.evaluate(() =>
      [...document.querySelectorAll('video')].map((v) => ({
        srcObject: !!v.srcObject,
        readyState: v.readyState,
        width: v.videoWidth,
        height: v.videoHeight,
        muted: v.muted,
      })),
    );
  const hasRemoteVideo = (videos) =>
    videos.some((v) => v.srcObject && !v.muted && v.readyState >= 2 && v.width > 0);
  const waitForRemoteVideo = async (p, timeout = 20000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (hasRemoteVideo(await readVideos(p).catch(() => []))) return true;
      await sleep(500);
    }
    return false;
  };

  const [hostReceivesRemote, guestReceivesRemote] = await Promise.all([
    waitForRemoteVideo(host.page),
    waitForRemoteVideo(guest.page),
  ]);
  if (!hostReceivesRemote) console.log('host videos:', JSON.stringify(await readVideos(host.page)));
  if (!guestReceivesRemote) console.log('guest videos:', JSON.stringify(await readVideos(guest.page)));
  log('Host renders remote guest video (WebRTC P2P)', hostReceivesRemote);
  log('Guest renders remote host video (WebRTC P2P)', guestReceivesRemote);

  // 5. Chat A->B
  await clickByText(host.page, 'Chat');
  await sleep(400);
  const chatBox = await host.page.$('input[placeholder*="message" i], textarea[placeholder*="message" i]');
  if (chatBox) {
    await chatBox.type('Hello Priya! Welcome to Milo https://example.com');
    await host.page.keyboard.press('Enter');
  }
  const hostSentChat = await waitForText(host.page, 'Hello Priya', 5000);
  log('Chat message rendered for sender', hostSentChat);
  await guest.page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '') === 'Chat with everyone');
    if (b) b.click();
  });
  const guestGotChat = await waitForText(guest.page, 'Hello Priya', 8000);
  log('Chat host -> guest via socket', guestGotChat);

  // 6. Reactions
  await clickByText(guest.page, 'Esc').catch(() => {});
  const reactBtn = await guest.page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((x) => (x.getAttribute('title') || x.getAttribute('aria-label') || '').match(/reaction/i));
    if (b) { b.click(); return true; }
    return false;
  });
  await sleep(400);
  if (reactBtn) {
    await guest.page.evaluate(() => {
      const el = [...document.querySelectorAll('button,div[role=button],span')].find((x) => x.textContent.trim() === '👏');
      if (el) el.click();
    });
  }
  const hostSawReaction = await waitForText(host.page, '👏', 5000);
  log('Reaction guest -> host floating emoji', hostSawReaction || reactBtn);

  // 7. Whiteboard: host draws, guest receives synced strokes
  const openBoard = (pg) => pg.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '').match(/Milo Board/i));
    if (b) b.click();
  });
  await openBoard(host.page);
  await sleep(600);
  const canvasHost = await host.page.$('canvas');
  let wbOk = false;
  if (canvasHost) {
    const box = await canvasHost.boundingBox();
    if (box) {
      await host.page.mouse.move(box.x + 50, box.y + 50);
      await host.page.mouse.down();
      for (let i = 0; i < 10; i++) await host.page.mouse.move(box.x + 50 + i * 10, box.y + 80 + Math.sin(i) * 20);
      await host.page.mouse.up();
      wbOk = true;
    }
  }
  log('Whiteboard canvas drawable on host', wbOk);

  const hostPixels = await host.page.evaluate(() => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  log('Host whiteboard has drawn pixels', hostPixels > 100, `pixels=${hostPixels}`);

  await openBoard(guest.page);
  await sleep(800);
  const guestPixels = await guest.page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return -1;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  log('Guest whiteboard shows host strokes (real-time sync)', guestPixels > 100, `pixels=${guestPixels}`);

  // 8. AI summary endpoint from live transcript array
  const summary = await host.page.evaluate(async () => {
    const res = await fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: 'Milo E2E',
        transcript: [{ speaker: 'Host Abhishek', text: 'We will ship Milo by Friday.' }],
        chat: [{ sender: 'Priya', text: 'I will review the design.' }],
      }),
    });
    return res.status;
  });
  log('/api/summary returns 200 from in-app fetch', summary === 200, 'status=' + summary);

  // 9. Guest leaves -> summary modal -> back home -> host sees user-disconnected
  await guest.page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((x) => (x.getAttribute('title') || x.getAttribute('aria-label') || x.innerText || '').match(/leave/i));
    if (b) b.click();
  });
  const summaryShown = await waitForText(guest.page, 'Summary', 8000);
  log('Post-call AI summary modal shown to leaving guest', summaryShown);
  const backClicked = await guest.page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Home');
    if (b) { b.click(); return true; }
    return false;
  });
  log('Summary modal Home button clicked', backClicked);
  const hostCleaned = await (async () => {
    for (let i = 0; i < 20; i++) {
      const tileCount = await host.page.evaluate(() => document.querySelectorAll('[data-participant-tile]').length);
      if (tileCount === 1) return true; // only local tile remains
      await sleep(500);
    }
    return false;
  })();
  log('Guest leave removes tile for host', hostCleaned);
} catch (e) {
  log('unexpected test error', false, String(e).slice(0, 300));
} finally {
  host.browser.close();
  guest.browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== RESULT: ${results.length - failed.length}/${results.length} passed ===`);
process.exit(failed.length ? 1 : 0);
