import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Chrome's built-in fake video device ends its track after ~30s, which makes
// remote-video assertions flaky. A looping y4m file keeps the camera live.
const FILE = path.resolve('.e2e/fake-camera.y4m');
const W = 160;
const H = 120;
const FRAMES = 150;

function ensureFakeCamera() {
  if (existsSync(FILE)) return;
  mkdirSync(path.dirname(FILE), { recursive: true });
  const ySize = W * H;
  const cSize = (W / 2) * (H / 2);
  const frames = [];
  for (let f = 0; f < FRAMES; f++) {
    const y = Buffer.alloc(ySize);
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) y[r * W + c] = (c + r + f * 3) % 256;
    }
    frames.push(Buffer.from('FRAME\n'), y, Buffer.alloc(cSize, 128), Buffer.alloc(cSize, 128));
  }
  writeFileSync(
    FILE,
    Buffer.concat([
      Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg\n`),
      ...frames,
    ]),
  );
}

export function fakeMediaArgs() {
  ensureFakeCamera();
  return [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${FILE}`,
    '--autoplay-policy=no-user-gesture-required',
  ];
}
