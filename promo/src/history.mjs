// 게시 이력(history.json) 갱신: node src/history.mjs <history.json> <id> '<json 필드>'
// 같은 id가 있으면 필드를 합치고, 없으면 새로 추가한다.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const [file, id, patch = '{}'] = process.argv.slice(2);
const list = JSON.parse(await readFile(file, 'utf8').catch(() => '[]'));
const entry = list.find((h) => h.id === id);
const fields = { ...JSON.parse(patch), updatedAt: new Date().toISOString() };
if (entry) Object.assign(entry, fields);
else list.push({ id, ...fields });
await mkdir(path.dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(list, null, 2) + '\n');
