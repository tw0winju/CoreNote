# 코어노트 (CoreNote) — 로컬 버전

PDF를 올리면 **내 컴퓨터에서 도는 로컬 LLM(Ollama)** 이 핵심 요약·주요 개념·암기 포인트·복습 퀴즈로 정리해주는 학습 도우미입니다. 인터넷 전송도, API 키도, 사용료도 없습니다.

---

## 구성

| 장비 | 역할 |
|------|------|
| 🖥 Windows PC (집) | Ollama + LLM 실행 |
| 💻 Mac (노트북) | 코드 편집 + 앱 실행 + 브라우저 접속 |

---

## 🖥 Windows PC에서 할 일 (최초 1회)

### 1. Ollama 설치 및 모델 받기

1. **Ollama 설치** — https://ollama.com/download (Windows용). 설치하면 백그라운드에서 자동 실행됩니다.
2. **모델 받기** — PowerShell 또는 명령 프롬프트에서:
   ```powershell
   ollama pull qwen3:8b
   ```
   (8GB VRAM에 적합. 더 가벼운 대안: `llama3.1:8b`)

### 2. Ollama 외부 접근 허용 (Mac에서 접속하려면 필수)

**시스템 환경변수에 `OLLAMA_HOST` 추가**

1. `Win + S` → "환경 변수" 검색 → **시스템 환경 변수 편집** 클릭
2. **환경 변수(N)...** → **시스템 변수** 영역에서 **새로 만들기**
3. 변수 이름: `OLLAMA_HOST` / 변수 값: `0.0.0.0:11434` 입력 후 확인
4. Ollama 완전 종료(트레이 아이콘 우클릭 → Quit) 후 재실행

**Windows 방화벽 포트 허용**

1. `Win + S` → "Windows Defender 방화벽" → **고급 설정**
2. **인바운드 규칙** → **새 규칙** → **포트** 선택
3. TCP, 특정 로컬 포트: `11434` → **연결 허용** → 이름: `Ollama` → 마침

**Windows PC의 로컬 IP 확인**

```powershell
ipconfig
```
`IPv4 주소` 항목을 메모해둡니다. (예: `192.168.0.10`)

---

## 💻 Mac에서 할 일

### 1. 사전 준비 (최초 1회)

**Node.js 설치** — https://nodejs.org (LTS 버전)

### 2. 프로젝트 설정 (최초 1회)

```bash
npm install
```

프로젝트 루트의 `.env` 파일에서 `OLLAMA_URL`을 Windows PC의 IP로 변경합니다.

```
OLLAMA_URL=http://192.168.0.10:11434
```

### 3. Ollama 연결 테스트

```bash
curl http://192.168.0.10:11434/api/tags
```
모델 목록 JSON이 출력되면 성공입니다.

### 4. 앱 실행

```bash
npm run dev
```

브라우저에서 **http://localhost:5173** 으로 접속해 PDF를 올리면 됩니다.

### 5. 프로덕션 빌드 (선택)

```bash
npm run build      # dist/ 생성
npm start          # http://localhost:3001 에서 프론트+API 함께 서빙
```

---

## 외부 네트워크에서 접속하기 (Tailscale)

학교·카페 등 집 WiFi가 아닌 곳에서 Mac을 쓸 때는 같은 내부망이 아니므로 `192.168.x.x` IP로 접속할 수 없습니다. **Tailscale**을 사용하면 어디서든 Mac → Windows PC Ollama에 접속할 수 있습니다.

### 1단계 — 🖥 Windows PC: Tailscale 설치 및 로그인

1. https://tailscale.com/download → Windows용 설치
2. 설치 후 Google/GitHub 계정으로 로그인
3. 트레이 아이콘 클릭 → **This device** 항목에서 Tailscale IP 확인 (예: `100.x.x.x`)

### 2단계 — 💻 Mac: Tailscale 설치 및 로그인

```bash
brew install tailscale
sudo tailscale up
```

브라우저가 열리면 **Windows PC와 같은 계정**으로 로그인합니다.

### 3단계 — 💻 Mac: 연결된 장비 확인

```bash
tailscale status
```

Windows PC의 Tailscale IP(`100.x.x.x`)가 보이면 연결 성공입니다.

### 4단계 — 💻 Mac: `.env` 파일 수정

```
OLLAMA_URL=http://100.x.x.x:11434
```

> Tailscale IP는 장비가 바뀌지 않는 한 고정되므로 한 번 설정하면 유지됩니다.

---

## 동작 구조

```
💻 Mac 브라우저(React) ─PDF(base64)─▶ Express(/api/summarize)
                                           │  1) PDF에서 텍스트 추출 (pdf-parse)
                                           │  2) 긴 문서는 청크로 분할
                                           │  3) 각 청크 요약 후 통합(map-reduce)
                                           └─▶ 🖥 Windows Ollama(:11434) → 로컬 모델
```

---

## 설정 바꾸기 (선택)

프로젝트 루트의 `.env` 파일에서 값을 수정합니다. (`.env.example` 참고)
모델은 `OLLAMA_MODEL`, 청크 크기는 `MAX_CHUNK_CHARS` 로 조절합니다.

---

## 자주 나오는 문제

- **"Ollama 서버에 연결할 수 없습니다"** → Windows PC에서 Ollama가 실행 중인지 확인(`ollama list`). `.env`의 `OLLAMA_URL`이 올바른 IP인지 확인하세요.
- **"모델이 없습니다"** → Windows PC에서 `ollama pull qwen3:8b` 실행.
- **"읽을 수 있는 텍스트가 거의 없습니다"** → 스캔된 이미지 PDF입니다. OCR이 필요합니다(현재 미지원).
- **요약이 느림** → 문서가 길수록 청크가 많아져 오래 걸립니다. 8B 모델 + 8GB VRAM 기준 정상입니다.

자세한 개발 안내는 `CLAUDE.md` 참고.
