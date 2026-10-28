import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:3000';
const results = [];
const log = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openBrowser(tag, viewport = null) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  if (viewport) await page.setViewport(viewport);
  page.on('pageerror', (e) => console.log(`[${tag}:pageerror]`, String(e).slice(0, 200)));
  return { browser, page };
}

async function waitForText(page, text, timeout = 10000) {
  try {
    await page.waitForFunction((t) => document.body && document.body.innerText.includes(t), { timeout }, text);
    return true;
  } catch { return false; }
}

async function clickEl(page, matcherText) {
  return page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find(
      (b) => b.innerText.trim().includes(t) || (b.getAttribute('title') || '').includes(t),
    );
    if (el) { el.click(); return true; }
    return false;
  }, matcherText);
}

async function joinAsHost(page) {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await clickEl(page, 'New meeting');
  await sleep(300);
  await clickEl(page, 'Start an instant meeting');
  await waitForText(page, 'Ready to join?');
  const code = await page.evaluate(() => (location.pathname.match(/\/meet\/([a-z-]+)/) || [])[1]);
  return code;
}

// ============ Desktop feature pass ============
const { browser, page } = await openBrowser('feat');
try {
  // Settings dialog behind the header gear
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await clickEl(page, 'Settings');
  const settingsOpen = await page
    .waitForSelector('[data-settings-modal]', { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  log('Settings dialog opens from header gear', settingsOpen);

  await page.evaluate(() => document.querySelector('[data-settings-tab="video"]').click());
  const camPreview = await page
    .waitForFunction(
      () => {
        const v = document.querySelector('[data-camera-preview]');
        return !!v && !!v.srcObject && v.readyState >= 2 && v.videoWidth > 0;
      },
      { timeout: 8000, polling: 100 },
    )
    .then(() => true)
    .catch(() => false);
  log('Settings video tab shows live camera preview', camPreview);

  await page.evaluate(() => document.querySelector('[data-settings-tab="audio"]').click());
  await sleep(2000);
  const testLevels = [];
  for (let i = 0; i < 15 && !testLevels.some((v) => v > 0); i++) {
    testLevels.push(
      await page.evaluate(() => {
        const bar = document.querySelector('[data-mic-test-meter] > div');
        return bar ? parseInt(bar.style.width) || 0 : 0;
      }),
    );
    await sleep(200);
  }
  log('Settings audio tab mic test meter responds', testLevels.some((v) => v > 0), `samples=${testLevels.join(',')}`);

  await page.evaluate(() => document.querySelector('[data-settings-tab="general"]').click());
  await page.click('[data-setting="displayName"]');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.type('Priya');
  await sleep(250);
  const savedName = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('milo.settings') || '{}').displayName;
    } catch {
      return null;
    }
  });
  log('General settings persist display name', savedName === 'Priya', `saved=${savedName}`);

  await clickEl(page, 'Reset to defaults');
  await sleep(250);
  const resetName = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('milo.settings') || '{}').displayName;
    } catch {
      return null;
    }
  });
  log('Reset to defaults restores preferences', resetName === 'Abhishek', `saved=${resetName}`);

  await page.evaluate(() => document.querySelector('[data-settings-done]').click());
  await sleep(300);
  const settingsClosed = await page.evaluate(() => !document.querySelector('[data-settings-modal]'));
  log('Settings dialog closes with Done', settingsClosed);

  // Mic level meter animates under fake mic input
  await joinAsHost(page);
  await sleep(1500);
  const meterWidths = [];
  for (let i = 0; i < 12; i++) {
    const w = await page.evaluate(() => {
      const m = document.querySelector('[data-mic-meter] > div > div');
      return m ? m.style.width : null;
    });
    meterWidths.push(w);
    await sleep(150);
  }
  const nonzero = meterWidths.filter((w) => w && parseInt(w) > 0).length;
  log('Lobby mic level meter animates with input', nonzero >= 3, `samples=${meterWidths.join(',')}`);

  // Lobby device dropdown must be fully visible over the video card (portal + clamped)
  await clickEl(page, 'Select microphone');
  await page
    .waitForFunction(() => document.querySelectorAll('[data-device-menu="audio"] button').length >= 1, {
      timeout: 8000,
      polling: 100,
    })
    .catch(() => {});
  const menuGeom = await page.evaluate(() => {
    const m = document.querySelector('[data-device-menu="audio"]');
    if (!m) return null;
    const r = m.getBoundingClientRect();
    const corners = [
      [r.left + 6, r.top + 6],
      [r.right - 6, r.top + 6],
      [r.left + 6, r.bottom - 6],
      [r.right - 6, r.bottom - 6],
    ];
    const visible = corners.every(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return !!el && m.contains(el);
    });
    return {
      fits: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
      visible,
      l: Math.round(r.left),
      r: Math.round(r.right),
      t: Math.round(r.top),
      b: Math.round(r.bottom),
    };
  });
  log(
    'Device dropdown fully visible over video card (no clipping)',
    !!menuGeom && menuGeom.fits && menuGeom.visible,
    menuGeom ? `l=${menuGeom.l} r=${menuGeom.r} t=${menuGeom.t} b=${menuGeom.b} visible=${menuGeom.visible}` : 'no menu',
  );
  await page.keyboard.press('Escape');
  await sleep(200);
  const menuClosedByEsc = await page.evaluate(() => !document.querySelector('[data-device-menu="audio"]'));
  log('Device dropdown closes on Escape', menuClosedByEsc);

  await clickEl(page, 'Join now');
  await waitForText(page, 'HOST');

  // Low Data mode via More options
  await clickEl(page, 'More options');
  await sleep(300);
  await clickEl(page, 'Enable Low Data Saver');
  const badge = await waitForText(page, 'Low Data Mode Active', 5000);
  log('Low Data Mode badge appears on tile', badge);
  await clickEl(page, 'More options');
  await sleep(200);
  await clickEl(page, 'Disable Low Data Saver');
  await sleep(400);
  const badgeGone = await page.evaluate(() => !document.body.innerText.includes('Low Data Mode Active'));
  log('Low Data Mode badge clears when disabled', badgeGone);

  // Raise hand
  await clickEl(page, 'Raise hand');
  const hand = await waitForText(page, 'Hand Raised', 4000);
  log('Hand raised indicator on tile', hand);
  await clickEl(page, 'Lower hand');

  // Captions bar + Indian language selector
  await clickEl(page, 'Turn on captions');
  const ccBar = await waitForText(page, 'Captions', 5000) || await waitForText(page, 'captions', 5000);
  const hasHindi = await page.evaluate(() =>
    [...document.querySelectorAll('option')].some((o) => o.value === 'hi-IN') &&
    [...document.querySelectorAll('option')].some((o) => o.value === 'ta-IN'));
  log('Captions bar visible with Indian language options', ccBar && hasHindi);

  // Breakout rooms via dedicated panel (More options -> Breakout Rooms)
  await clickEl(page, 'More options');
  await sleep(300);
  await clickEl(page, 'Breakout Rooms');
  await sleep(400);
  const breakoutUI = await page.evaluate(() => document.body.innerText.includes('Create 2 Rooms'));
  log('Host breakout panel shows room creation controls', breakoutUI);
  const created = await clickEl(page, 'Create 2 Rooms');
  await sleep(500);
  const roomsShown = await page.evaluate(() => (document.body.innerText.match(/Breakout Room \d/g) || []).length >= 2);
  log('Host creates 2 breakout rooms, listed in panel', created && roomsShown);

  // Reactions tray
  await clickEl(page, 'Send a reaction');
  await sleep(300);
  const tray = await page.evaluate(() => {
    const isEmoji = (s) => s.length > 0 && /^[\uD800-\uDBFF][\uDC00-\uDFFF]$|^[\u2600-\u27BF]$/.test(s);
    return [...document.querySelectorAll('button')].filter((x) => isEmoji(x.textContent.trim())).length;
  });
  log('Reaction tray opens with emoji set', tray >= 8, `emoji buttons=${tray}`);

  // Device pickers (mic + camera)
  const menuOpen = (kind) => page.evaluate((k) => !!document.querySelector(`[data-device-menu="${k}"]`), kind);
  const countOptions = (kind) =>
    page.evaluate((k) => document.querySelectorAll(`[data-device-menu="${k}"] button`).length, kind);

  const openPicker = async (kind) => {
    if (await menuOpen(kind)) return true;
    const title = kind === 'audio' ? 'Select microphone' : 'Select camera';
    await clickEl(page, title);
    await sleep(200);
    return menuOpen(kind);
  };

  const waitForOptions = async (kind, timeout = 8000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (!(await menuOpen(kind))) await openPicker(kind);
      const n = await countOptions(kind);
      if (n >= 1) return n;
      await sleep(150);
    }
    const diag = await page.evaluate(async (k) => {
      const m = document.querySelector(`[data-device-menu="${k}"]`);
      const raw = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      return {
        menuOpen: !!m,
        text: m ? m.innerText.replace(/\n/g, ' | ') : 'none',
        raw: raw.filter((d) => d.kind === (k === 'audio' ? 'audioinput' : 'videoinput')).length,
      };
    }, kind);
    console.log(`[diag ${kind}]`, JSON.stringify(diag));
    return 0;
  };

  await openPicker('audio');
  const micOptions = await waitForOptions('audio');
  log('Mic device picker lists available devices', micOptions >= 1, `options=${micOptions}`);
  const switched = await page.evaluate(() => {
    const b = document.querySelector('[data-device-menu="audio"] button');
    if (!b) return false;
    b.click();
    return true;
  });
  await page.waitForFunction(
    () => !document.querySelector('[data-device-menu="audio"]'),
    { timeout: 4000, polling: 100 },
  ).catch(() => {});
  await sleep(800);
  const micMenuClosed = await page.evaluate(() => !document.querySelector('[data-device-menu="audio"]'));
  log('Selecting a microphone closes picker and applies', switched && micMenuClosed);

  await openPicker('video');
  const camOptions = await waitForOptions('video');
  log('Camera device picker lists available cameras', camOptions >= 1, `options=${camOptions}`);
  await page.evaluate(() => {
    const b = document.querySelector('[data-device-menu="video"] button');
    if (b) b.click();
  });
  await sleep(600);

  // Milo Board: in-board nib cursor + smooth, nib-aligned drawing
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '').includes('Milo Board'));
    if (b) b.click();
  });
  await sleep(700);
  const boardState = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const cur = document.querySelector('[data-canvas-cursor]');
    return c
      ? {
          cursor: getComputedStyle(c).cursor,
          tool: c.getAttribute('data-tool'),
          customCursor: !!cur,
          cursorTool: cur ? cur.getAttribute('data-canvas-cursor') : null,
        }
      : null;
  });
  log(
    'Pen tool hides OS cursor and uses in-board pen',
    !!boardState && boardState.cursor === 'none' && boardState.customCursor && boardState.cursorTool === 'pen',
  );
  log('Whiteboard starts with pen tool active', !!boardState && boardState.tool === 'pen');

  const canvasEl = await page.$('canvas');
  let canvasBox = null;
  let drewPixels = 0;
  if (canvasEl) canvasBox = await canvasEl.boundingBox();
  if (canvasBox) {
    // The nib must sit exactly under the pointer *before* any ink is laid down
    const px = canvasBox.x + 120;
    const py = canvasBox.y + 140;
    await page.mouse.move(px, py);
    await sleep(150);
    const cursorGeom = await page.evaluate(() => {
      const el = document.querySelector('[data-canvas-cursor]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, w: r.width, h: r.height, display: getComputedStyle(el).display };
    });
    const nibX = cursorGeom ? cursorGeom.left + (cursorGeom.w / 28) * 4 : 0;
    const nibY = cursorGeom ? cursorGeom.top + (cursorGeom.h / 28) * 24 : 0;
    const aligned =
      !!cursorGeom &&
      cursorGeom.display !== 'none' &&
      Math.abs(nibX - px) < 1.5 &&
      Math.abs(nibY - py) < 1.5;
    log(
      'Pen nib sits exactly under the pointer',
      aligned,
      cursorGeom
        ? `pointer=(${Math.round(px)},${Math.round(py)}) nib=(${Math.round(nibX)},${Math.round(nibY)})`
        : 'no cursor element',
    );

    // A click must deposit ink at the nib, not beside it
    await page.mouse.down();
    await page.mouse.up();
    await sleep(150);
    const inkAtPointer = await page.evaluate(
      ({ x, y }) => {
        const c = document.querySelector('canvas');
        const r = c.getBoundingClientRect();
        const sx = c.width / r.width;
        const sy = c.height / r.height;
        const d = c
          .getContext('2d')
          .getImageData(Math.round((x - r.left) * sx), Math.round((y - r.top) * sy), 1, 1).data;
        return d[3] > 0;
      },
      { x: px, y: py },
    );
    log('Ink is deposited exactly at the nib position', inkAtPointer);

    await page.mouse.move(canvasBox.x + 60, canvasBox.y + 60);
    await page.mouse.down();
    for (let i = 0; i < 40; i++) {
      await page.mouse.move(canvasBox.x + 60 + i * 8, canvasBox.y + 100 + Math.sin(i / 3) * 40);
    }
    await page.mouse.up();
    await sleep(300);
    drewPixels = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n;
    });
  }
  log('Smooth pen strokes render on canvas', drewPixels > 200, `pixels=${drewPixels}`);

  await clickEl(page, 'Eraser');
  if (canvasBox) await page.mouse.move(canvasBox.x + 200, canvasBox.y + 120);
  await sleep(200);
  const eraserState = await page.evaluate(() => {
    const el = document.querySelector('[data-canvas-cursor]');
    return el
      ? { tool: el.getAttribute('data-canvas-cursor'), display: getComputedStyle(el).display }
      : null;
  });
  log(
    'Eraser tool swaps to eraser cursor',
    !!eraserState && eraserState.tool === 'eraser' && eraserState.display !== 'none',
  );
} catch (e) {
  log('feature test crashed', false, String(e).slice(0, 200));
} finally {
  await browser.close();
}

// ============ Mobile viewport pass ============
const mob = await openBrowser('mobile', { width: 390, height: 844, isMobile: true, hasTouch: true });
try {
  await joinAsHost(mob.page);
  const lobbyOk = await mob.page.evaluate(() => {
    const card = document.querySelector('video, [style*="border-radius"]');
    return !!card && document.body.scrollHeight <= window.innerHeight * 2.2;
  });
  log('Mobile lobby (390px) fits without extreme overflow', lobbyOk);
  await mob.page.screenshot({ path: 'e2e-mobile-lobby.png' });

  await clickEl(mob.page, 'Join now');
  await waitForText(mob.page, 'HOST');
  const gridOk = await mob.page.evaluate(() => {
    const tile = document.querySelector('[data-participant-tile]');
    if (!tile) return false;
    const r = tile.getBoundingClientRect();
    return r.width > 100 && r.width <= window.innerWidth + 2;
  });
  log('Mobile in-call video tile fits viewport width', gridOk);
  const barVisible = await mob.page.evaluate(() => {
    const leave = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('title') || '').match(/leave/i));
    if (!leave) return false;
    const r = leave.getBoundingClientRect();
    return r.bottom <= window.innerHeight + 2 && r.width > 0;
  });
  log('Mobile control bar visible with Leave button', barVisible);
  await mob.page.screenshot({ path: 'e2e-mobile-call.png' });
} catch (e) {
  log('mobile test crashed', false, String(e).slice(0, 200));
} finally {
  await mob.browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== FEATURE RESULT: ${results.length - failed.length}/${results.length} passed ===`);
process.exit(failed.length ? 1 : 0);
