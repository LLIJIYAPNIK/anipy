// Готовит видео для фона панели SDK: без звука, MP4 (H.264) и WebM (VP9) для веба, постер в WebP.
// Usage: node scripts/prepare-video.mjs <исходник> <имя> [--poster <секунда>] [--height <px>]
// Результат: public/media/<имя>.mp4, <имя>.webm, <имя>-poster.webp. ffmpeg — из PATH или $FFMPEG.
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [input, name, ...rest] = process.argv.slice(2);
if (!input || !name) {
  console.error('Usage: node scripts/prepare-video.mjs <source> <name> [--poster <seconds>] [--height <px>]');
  process.exit(1);
}
const option = (key, fallback) => {
  const i = rest.indexOf(key);
  return i >= 0 ? rest[i + 1] : fallback;
};
const posterAt = option('--poster', '2');
// 720px по высоте: панель вытянута по вертикали и видео приглушено — больше не нужно.
const height = option('--height', '720');

const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const out = join('public', 'media');
mkdirSync(out, { recursive: true });
const run = (args) => execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', input, ...args], { stdio: 'inherit' });
const scale = `scale=-2:${height}:flags=lanczos`;

const mp4 = join(out, `${name}.mp4`);
const webm = join(out, `${name}.webm`);
const poster = join(out, `${name}-poster.webp`);

// faststart — видео начинает играть до полной загрузки.
run(['-an', '-vf', scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
run(['-an', '-vf', scale, '-c:v', 'libvpx-vp9', '-crf', '40', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', webm]);
execFileSync(ffmpeg, ['-v', 'error', '-y', '-ss', posterAt, '-i', input, '-frames:v', '1', '-vf', scale, '-c:v', 'libwebp', '-quality', '75', poster], {
  stdio: 'inherit',
});

for (const file of [mp4, webm, poster]) console.log(`${file}  ${(statSync(file).size / 1024 / 1024).toFixed(2)} MB`);
