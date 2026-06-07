/**
 * OCR 파이프라인 단독 테스트
 * pdftoppm + tesseract.js 동작 확인
 */
import fs from "fs";
import path from "path";
import os from "os";
import { execFile, execFileSync } from "child_process";
import { promisify } from "util";
import { createWorker } from "tesseract.js";

const execFileAsync = promisify(execFile);

let passed = 0, failed = 0;
function ok(label, detail = "")  { console.log(`  ✓ ${label}${detail ? " — " + detail : ""}`); passed++; }
function fail(label, e) { console.log(`  ✗ ${label}: ${e?.message || e}`); failed++; }

// ── 1. pdftoppm 확인 ──────────────────────────────────────────────────────────
console.log("\n[ 1. pdftoppm 확인 ]");
try {
  const out = execFileSync("pdftoppm", ["-v"], { encoding: "utf8", stdio: ["ignore","pipe","pipe"] });
  ok("pdftoppm 설치 확인", out.trim().split("\n")[0].trim());
} catch (e) {
  // pdftoppm -v 는 stderr로 출력됨
  try {
    const { stderr } = await execFileAsync("pdftoppm", ["-v"]);
    ok("pdftoppm 설치 확인", stderr.trim().split("\n")[0]);
  } catch (e2) {
    fail("pdftoppm 없음 — brew install poppler 필요", e2);
  }
}

// ── 2. tesseract.js worker 초기화 ─────────────────────────────────────────────
console.log("\n[ 2. tesseract.js kor+eng 워커 초기화 ]");
let worker;
try {
  worker = await createWorker("kor+eng");
  ok("워커 초기화 성공 (kor+eng)");
} catch (e) {
  fail("워커 초기화 실패", e);
  process.exit(1);
}

// ── 3. 샘플 PDF 탐색 ──────────────────────────────────────────────────────────
console.log("\n[ 3. 샘플 PDF 탐색 ]");
const searchDirs = [
  os.homedir() + "/Downloads",
  os.homedir() + "/Desktop",
  os.homedir() + "/Documents",
];
let samplePdf = null;
for (const dir of searchDirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".pdf"));
  if (files.length) {
    samplePdf = path.join(dir, files[0]);
    ok(`샘플 PDF 발견: ${files[0]}`);
    break;
  }
}
if (!samplePdf) {
  console.log("  - 샘플 PDF 없음 → tesseract.js 단독 인식 테스트로 대체");
}

// ── 4. tesseract.js 텍스트 인식 (간단한 이미지 없이 API 확인) ─────────────────
console.log("\n[ 4. tesseract.js 인식 테스트 ]");
if (samplePdf) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "corenote-ocr-test-"));
  const outPrefix = path.join(tmpDir, "page");
  try {
    console.log(`  → PDF → PNG 변환 중 (pdftoppm -r 150, 1~2페이지)…`);
    await execFileAsync("pdftoppm", ["-r", "150", "-png", "-f", "1", "-l", "2", samplePdf, outPrefix]);
    const pngs = fs.readdirSync(tmpDir).filter(f => f.endsWith(".png")).sort();
    ok(`PDF → PNG 변환: ${pngs.length}개 페이지`);

    if (pngs.length > 0) {
      console.log(`  → 1페이지 OCR 인식 중…`);
      const { data: { text } } = await worker.recognize(path.join(tmpDir, pngs[0]));
      const preview = text.replace(/\s+/g, " ").trim().slice(0, 120);
      ok(`OCR 인식 성공 (${text.trim().length}자)`, `"${preview}${text.length > 120 ? "…" : ""}"`);
    }
  } catch (e) {
    fail("OCR 테스트 실패", e);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
} else {
  // 샘플 PDF 없으면 worker가 살아있는지만 확인
  ok("tesseract.js 워커 생성 완료 (PDF 없어 실제 인식 스킵)");
}

// ── 5. 병렬 처리 ─────────────────────────────────────────────────────────────
console.log("\n[ 5. 병렬 워커 테스트 ]");
const CONCURRENCY = Math.min(os.cpus().length, 4);
try {
  const workers = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => createWorker("kor+eng"))
  );
  ok(`${CONCURRENCY}개 병렬 워커 초기화 성공`);
  await Promise.all(workers.map(w => w.terminate()));
  ok("워커 정상 종료");
} catch (e) {
  fail("병렬 워커 테스트 실패", e);
}

await worker.terminate();

// ── 결과 ──────────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(44));
console.log(`결과: ${passed}/${passed + failed} 통과`);
if (failed) process.exit(1);
