# 코어노트 (CoreNote)

> PDF 강의자료를 올리면 로컬 LLM이 핵심 요약·개념 정리·암기 포인트·복습 퀴즈를 자동으로 만들어주는 학습 도우미

**인터넷 전송 없음 · API 키 불필요 · 완전 무료**

---

## 주요 기능

- **핵심 요약** — 문서 전체를 4~7개 포인트로 압축
- **주요 개념** — 핵심 용어와 설명 카드
- **암기 포인트** — 시험·복습용 핵심 정리
- **복습 퀴즈** — 자기 평가(알았어 ✓ / 몰랐어 ✗), 오답 모음, 셔플
- **내 메모** — 개념 카드에 직접 메모 추가
- **복습 스케줄** — 1→3→7→14→30일 간격 반복 복습 알림
- **히스토리** — 최근 20개 결과 자동 저장 (IndexedDB)
- **내보내기** — Markdown 다운로드, 전체 복사, 인쇄

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 18 + Vite |
| 백엔드 | Node.js + Express |
| LLM | Ollama (`qwen3:8b`) |
| PDF 파싱 | pdf-parse v2 |
| 요약 방식 | 청킹 + map-reduce (병렬) |

---

## 구성 환경

| 장비 | 역할 |
|------|------|
| 🖥 Windows PC (집) | Ollama + LLM 실행 |
| 💻 Mac (노트북) | 코드 편집 + 앱 실행 + 브라우저 접속 |

---

## 🖥 Windows PC 설정 (최초 1회)

### 1. Ollama 설치 및 모델 받기

1. [Ollama 다운로드](https://ollama.com/download) → Windows용 설치 (백그라운드 자동 실행)
2. PowerShell에서 모델 설치:
   ```powershell
   ollama pull qwen3:8b
   ```
   > 8GB VRAM 기준. 더 가벼운 대안: `llama3.1:8b`

### 2. Mac에서 접속할 수 있도록 Ollama 외부 접근 허용

**시스템 환경변수 추가**

1. `Win + S` → "환경 변수" → **시스템 환경 변수 편집**
2. **환경 변수** → **시스템 변수** → **새로 만들기**
3. 이름: `OLLAMA_HOST` / 값: `0.0.0.0:11434` → 확인
4. Ollama 트레이 아이콘 우클릭 → Quit 후 재실행

**방화벽 포트 허용**

1. `Win + S` → "Windows Defender 방화벽" → **고급 설정**
2. **인바운드 규칙** → **새 규칙** → **포트**
3. TCP / `11434` → **연결 허용** → 이름: `Ollama` → 마침

**로컬 IP 확인**

```powershell
ipconfig
```
`IPv4 주소` 항목 메모 (예: `192.168.0.10`)

---

## 💻 Mac 설정 및 실행

### 1. 사전 준비 (최초 1회)

[Node.js LTS](https://nodejs.org) 설치 후:

```bash
npm install
```

### 2. `.env` 파일에 Windows PC IP 설정

```env
OLLAMA_URL=http://192.168.0.10:11434
```

### 3. 연결 테스트

```bash
curl http://192.168.0.10:11434/api/tags
```
JSON 응답이 오면 성공.

### 4. 실행

```bash
npm run dev
```

브라우저에서 **http://localhost:5173** 접속 후 PDF 업로드.

### 5. 프로덕션 빌드 (선택)

```bash
npm run build && npm start   # http://localhost:3001
```

---

## 외부 네트워크에서 사용하기 (Tailscale)

학교·카페 등 집 WiFi 밖에서는 `192.168.x.x`로 접속할 수 없습니다.  
[Tailscale](https://tailscale.com) 을 사용하면 어디서든 연결할 수 있습니다.

| 단계 | 장비 | 작업 |
|------|------|------|
| 1 | 🖥 Windows PC | Tailscale 설치 → 로그인 → Tailscale IP(`100.x.x.x`) 확인 |
| 2 | 💻 Mac | `brew install tailscale && sudo tailscale up` → 같은 계정 로그인 |
| 3 | 💻 Mac | `tailscale status` 로 Windows PC IP 확인 |
| 4 | 💻 Mac | `.env`에서 `OLLAMA_URL=http://100.x.x.x:11434` 로 변경 |

> Tailscale IP는 고정되므로 한 번 설정하면 유지됩니다.

---

## 동작 구조

```
💻 Mac (브라우저)
  └─ PDF → base64 → POST /api/summarize
                          │
                          ├─ 1) pdf-parse로 텍스트 추출
                          ├─ 2) 청크 분할 (최대 6000자 × 12개)
                          ├─ 3) 각 청크 병렬 요약 (map)
                          ├─ 4) 불릿 통합 → 최종 JSON 생성 (reduce)
                          └─ 5) SSE로 진행률 스트리밍
                                    │
                          🖥 Windows PC — Ollama (qwen3:8b)
```

---

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama 주소 |
| `OLLAMA_MODEL` | `qwen3:8b` | 사용 모델 |
| `MAX_CHUNK_CHARS` | `6000` | 청크당 최대 글자 수 |
| `MAX_CHUNKS` | `12` | 최대 청크 수 |
| `PORT` | `3001` | 백엔드 포트 |

---

## 자주 나오는 문제

| 오류 | 해결 |
|------|------|
| Ollama 연결 불가 | Windows PC에서 Ollama 실행 중인지 확인 (`ollama list`) |
| 모델 없음 | `ollama pull qwen3:8b` 실행 |
| 텍스트 없음 | 스캔 이미지 PDF → OCR 필요 (현재 미지원) |
| 요약 느림 | 분량이 많을수록 정상. 8B + 8GB VRAM 기준 |
| 내용 잘림 | `.env`에서 `MAX_CHUNKS` 값 늘리기 (속도 느려짐) |
