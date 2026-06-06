# 코어노트 (CoreNote) — 로컬 RAG

PDF를 색인해두고 **내 자료 전체에 질문**하면, 관련 부분을 찾아 **출처와 함께** 답해주는 학습 도우미입니다. 임베딩·검색·답변이 전부 내 컴퓨터(Ollama)에서 돌아가서 **API 비용 0원**, 데이터도 밖으로 안 나갑니다.

> 환경: **Windows 10 64bit** / Node.js 18+ / Ollama / 권장 GPU VRAM 8GB(RTX 3070급)

## 1. 사전 준비 (최초 1회)

1) **Node.js 설치** — https://nodejs.org (LTS, Windows .msi)
2) **Ollama 설치** — https://ollama.com/download (Windows). 설치 시 백그라운드 자동 실행.
3) **모델 2개 받기** — PowerShell 또는 명령 프롬프트에서:
   ```powershell
   ollama pull qwen3:8b     # 답변 생성
   ollama pull bge-m3       # 임베딩(검색) · 한국어에 강함
   ```

## 2. 실행

가장 쉬운 방법: 폴더의 **`start.bat` 더블클릭** (최초 1회 자동 의존성 설치).

또는 터미널:
```powershell
npm install        # 최초 1회
npm run dev
```
실행 후 브라우저에서 **http://localhost:5173** 접속 → PDF 추가 → 질문.

## 3. 사용 흐름

1. 왼쪽 **내 자료**에서 PDF를 추가하면 자동으로 색인(임베딩)됩니다.
2. 오른쪽 **질문하기**에 궁금한 걸 입력하면, 관련 조각을 찾아 답하고 아래에 **출처**를 보여줍니다.
3. 여러 PDF를 넣으면 자료 전체를 가로질러 검색합니다.

## 동작 구조 (RAG)

```
[색인]  PDF → 텍스트 추출 → 청크 분할 → 임베딩(bge-m3) → 벡터 저장(data/store.json)
[질문]  질문 → 임베딩 → 코사인 유사도 검색(top-k) → 관련 조각 + 질문 → qwen3:8b → 답변 + 출처
```

## 설정 바꾸기 (선택)

`.env.example` 를 `.env` 로 복사 후 수정:
```powershell
Copy-Item .env.example .env
```
모델은 `OLLAMA_MODEL`/`EMBED_MODEL`, 검색 개수는 `TOP_K`, 청크 크기는 `MAX_CHUNK_CHARS`.

## 자주 나오는 문제

- **"Ollama에 연결할 수 없어요"** → Ollama 실행 확인(`ollama list`). 설치 후 보통 자동 실행.
- **"임베딩/답변 모델이 없어요"** → 위의 `ollama pull` 2개 실행.
- **"읽을 수 있는 텍스트가 거의 없음"** → 스캔 이미지 PDF (OCR 필요, 현재 미지원).
- **색인 데이터 초기화** → `data/` 폴더 삭제.

자세한 개발 안내는 `CLAUDE.md` 참고.
