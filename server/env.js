// โหลด .env (ไม่ต้องใช้ dotenv) — ต้อง import ก่อนไฟล์อื่น
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const f = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m && !l.trim().startsWith('#') && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
