// 토스 미니앱 배지(.ai = PDF 호환)를 투명 PNG로 뽑는다. 한 번만 쓰는 준비용 스크립트.
// 사용: node src/badge-extract.mjs <toss_miniapp_badge_kr.ai> [출력 폴더=assets/badge]
// 필요: promo/.tools 에 pdfjs-dist (npm i pdfjs-dist@4.10.38)
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser } from './capture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(process.argv[2] ?? '');
const outDir = path.resolve(process.argv[3] ?? path.join(ROOT, 'assets', 'badge'));
const pdfjs = pathToFileURL(path.join(ROOT, '.tools', 'node_modules', 'pdfjs-dist', 'build')).href;
await mkdir(outDir, { recursive: true });

const browser = await launchBrowser({ args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(ROOT, '.tools')).href + '/');
  const pages = await page.evaluate(
    async ({ pdfjs, file }) => {
      const lib = await import(`${pdfjs}/pdf.mjs`);
      lib.GlobalWorkerOptions.workerSrc = `${pdfjs}/pdf.worker.mjs`;
      const data = new Uint8Array(await (await fetch(file)).arrayBuffer());
      const doc = await lib.getDocument({ data }).promise;
      const out = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const pg = await doc.getPage(i);
        const base = pg.getViewport({ scale: 1 });
        const scale = 1600 / Math.max(base.width, base.height);
        const vp = pg.getViewport({ scale });
        const c = document.createElement('canvas');
        c.width = Math.ceil(vp.width);
        c.height = Math.ceil(vp.height);
        await pg.render({ canvasContext: c.getContext('2d'), viewport: vp, background: 'rgba(0,0,0,0)' }).promise;
        out.push({ w: c.width, h: c.height, png: c.toDataURL('image/png') });
      }
      return out;
    },
    { pdfjs, file: pathToFileURL(src).href }
  );
  for (const [i, p] of pages.entries()) {
    const f = path.join(outDir, `page-${i + 1}.png`);
    await writeFile(f, Buffer.from(p.png.split(',')[1], 'base64'));
    console.log(`✔ ${path.relative(ROOT, f)} ${p.w}×${p.h}`);
  }
} finally {
  await browser.close();
}
