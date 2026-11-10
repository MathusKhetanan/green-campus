// วัดความแม่นของ AI Green Checker กับรูปจริงของวิทยาลัย
// วิธีใช้:  cd server && node tools/eval-ai.js
// เตรียมรูปไว้ที่ server/samples/<รหัสภารกิจ>/yes/*.jpg  (รูปถูกต้อง)
//                            server/samples/<รหัสภารกิจ>/no/*.jpg   (รูปผิด: ไม่เกี่ยวข้อง เบลอ จากเน็ต ภาพหน้าจอ ฯลฯ)
// รหัสภารกิจ เช่น D_WASTE, D_LIGHT, W_TREE, W_CLEAN, S_GREENWEEK (ดูได้จากตาราง missions)
import '../env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { default: db } = await import('../db.js');
const { checkEvidence, AI_ENABLED } = await import('../ai.js');
if (!AI_ENABLED) { console.error('ยังไม่ได้ตั้ง ANTHROPIC_API_KEY ในไฟล์ .env — โหมดจำลองวัดผลไม่ได้'); process.exit(1); }

const root = process.argv[2] || path.join(here, '..', 'samples');
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const tally = { yes: { approved: 0, rejected: 0, needs_review: 0, n: 0 }, no: { approved: 0, rejected: 0, needs_review: 0, n: 0 } };
const wrongApprovals = [];

for (const code of fs.existsSync(root) ? fs.readdirSync(root) : []) {
  const mission = db.prepare('SELECT * FROM missions WHERE code=?').get(code);
  if (!mission) { console.warn(`ข้ามโฟลเดอร์ ${code}: ไม่มีภารกิจรหัสนี้`); continue; }
  for (const kind of ['yes', 'no']) {
    const dir = path.join(root, code, kind); if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const mime = MIME[path.extname(f).toLowerCase()]; if (!mime) continue;
      const r = await checkEvidence({ filePath: path.join(dir, f), mime, mission });
      tally[kind].n++; tally[kind][r.status]++;
      if (kind === 'no' && r.status === 'approved') wrongApprovals.push(`${code}/${f}`);
      console.log(`${code}  ${kind.padEnd(3)}  ${r.status.padEnd(12)} ${(r.confidence * 100).toFixed(0).padStart(3)}%  ${f}  — ${r.reason}`);
    }
  }
}
const pct = (a, n) => n ? (a / n * 100).toFixed(0) + '%' : '-';
console.log('\n=========== สรุป ===========');
console.log(`รูปถูกต้อง ${tally.yes.n} รูป: ผ่านเอง ${pct(tally.yes.approved, tally.yes.n)} · ส่งครู ${pct(tally.yes.needs_review, tally.yes.n)} · ปฏิเสธ(พลาด) ${pct(tally.yes.rejected, tally.yes.n)}`);
console.log(`รูปผิด     ${tally.no.n} รูป: ผ่านเอง(อันตราย) ${pct(tally.no.approved, tally.no.n)} · ส่งครู ${pct(tally.no.needs_review, tally.no.n)} · ปฏิเสธ(ถูก) ${pct(tally.no.rejected, tally.no.n)}`);
if (wrongApprovals.length) console.log('\nรูปผิดที่ AI ปล่อยผ่าน (ควรปรับ ai_hint หรือเพิ่ม AI_PASS ใน .env):\n  ' + wrongApprovals.join('\n  '));
console.log('\nแนวทางอ่านผล: ตัวเลข "รูปผิดที่ผ่านเอง" ควรใกล้ 0% ถ้าสูงให้เพิ่ม AI_PASS (เช่น 0.9) หรือทำให้ ai_hint เจาะจงขึ้น แล้วรันซ้ำ');
console.log('ตัวอย่าง 20-30 รูปต่อภารกิจเป็นจุดเริ่มต้นที่พอใช้ แต่ยังเป็นการประเมินคร่าว ๆ ควรสุ่มตรวจรูปจริงต่อเนื่องด้วย');
