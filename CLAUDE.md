# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고하는 안내 문서입니다.

## 프로젝트 개요

**코어노트(CoreNote)** 는 **로컬 RAG** 학습 도우미입니다. 문서를 색인해두고 사용자가 질문하면,
관련 부분을 검색해 **출처와 함께** 답합니다. 임베딩·검색·답변 생성이 전부 로컬(Ollama)에서
동작하므로 **API 키·사용료가 없고, 데이터가 외부로 나가지 않습니다.**

RAG = Retrieval-Augmented Generation. 문서를 통째로 요약하는 게 아니라, 질문과 관련된 조각만
"검색"해서 모델에 넘겨 답하게 하는 구조입니다. (단순 요약기가 아님)

## 대상 환경

- **OS:** Windows 10 64bit / **런타임:** Node.js 18+
- **LLM:** Ollama, `http://localhost:11434`
  - 답변: `qwen3:8b` (env `OLLAMA_MODEL`, 설정 UI로도 변경 가능)
  - 임베딩: `bge-m3` (env `EMBED_MODEL`, 한국어에 강함)
- **권장 하드웨어:** GPU VRAM 8GB(RTX 3070급), RAM 16GB+

## 기술 스택

- **프론트엔드:** React 18 + Vite (단일 컴포넌트 `src/App.jsx`, 인라인 스타일)
- **백엔드:** Node.js + Express (`server.js`)
- **텍스트 추출:**
  - PDF: `pdf-parse` v2 (`PDFParse` 클래스)
  - 스캔 PDF(OCR): `pdfjs-dist` + `canvas` + `tesseract.js` (한국어+영어)
  - DOCX: `mammoth`
  - TXT / MD: UTF-8 직접 읽기
- **벡터 저장소:** `@lancedb/lancedb` — `data/lancedb/` 디렉터리 (임베디드, 설치 불필요)
- **문서 메타:** `data/docs.json` (id, name, addedAt, chunkCount, SHA-256 hash)
- **설정:** `data/settings.json` (모델명, 청크 크기, TOP_K, HyDE, 재순위화 플래그)
- **검색:** 하이브리드 — 벡터(코사인) + BM25 키워드, Reciprocal Rank Fusion(RRF)으로 통합
- **임베딩/생성:** Ollama (`/api/embed`, `/api/chat`)

## 디렉터리 구조

```
corenote/
├── CLAUDE.md              이 파일
├── README.md              Windows 설치/실행 안내
├── start.bat              Windows 더블클릭 실행
├── package.json
├── vite.config.js         Vite + /api 프록시
├── index.html
├── server.js              색인 + 검색 + 답변 (RAG 백엔드)
├── test-pipeline.mjs      전체 파이프라인 통합 테스트 (Mock Ollama 내장)
├── .env.example           환경변수 템플릿 (선택)
└── data/                  (런타임 생성, gitignore됨)
    ├── lancedb/           벡터 저장소 (LanceDB)
    ├── docs.json          문서 메타데이터
    └── settings.json      사용자 설정
└── src/
    ├── main.jsx
    ├── App.jsx            자료 목록(좌) + 질문/답변(우) UI
    └── index.css          전역 스타일·폰트·애니메이션
```

## 실행

```powershell
ollama pull qwen3:8b
ollama pull bge-m3
npm install          # 최초 1회
npm run dev          # 프론트(5173) + 백엔드(3001) 동시 실행
```
접속: http://localhost:5173 (또는 `start.bat` 더블클릭).  
프로덕션: `npm run build` 후 `npm start` (server.js가 dist/ 와 /api 서빙, 3001).

## RAG 데이터 흐름 (중요)

```
[색인]  POST /api/index { file, filename }  또는  POST /api/index-url { url }
  파일(base64) → extractText() → (스캔 PDF이면 extractTextOCR())
              → chunkText(maxChunkChars) + overlap(200자)
              → embed(chunks, 배치 16) (Ollama /api/embed)
              → LanceDB chunks 테이블에 {id, docId, docName, index, text, vector} 추가
              → docs.json에 메타 추가 (SHA-256 중복 방지)
              → SSE로 progress / done 이벤트 전송

[질문]  POST /api/ask { question, history?, docIds? }
  (HyDE ON이면 question → /api/chat → 가상 답변 생성)
  → embed(queryText) → LanceDB vectorSearch(TOP_K*4 후보)
  → BM25 점수 계산 → RRF로 코사인+BM25 통합 → 상위 TOP_K*2 선택
  (rerankEnabled ON이면 → LLM 재순위화 단일 호출)
  → SSE sources 이벤트 먼저 전송
  → 컨텍스트 구성 → /api/chat(stream:true) → SSE token 이벤트 스트리밍
  → <think> 블록 실시간 필터
```

핵심 함수(`server.js`):
- `extractText(base64, filename)` — 확장자 기반 분기. .txt/.md(UTF-8), .docx(mammoth), .pdf(pdf-parse).
- `extractTextOCR(buf, onProgress)` — pdfjs-dist로 페이지 렌더링 → canvas PNG → tesseract.js OCR.
- `chunkText(text, maxChars)` — 문단 경계 분할. 기본 1200자.
- `indexTextSSE(text, name, hash, send)` — 청킹+임베딩+LanceDB 저장 공통 로직. `/api/index`와 `/api/index-url`이 공유.
- `embed(input)` — `/api/embed` 호출. 문자열/배열 → `number[][]`.
- `cosine(a, b)` — 코사인 유사도.
- `bm25Scores(query, chunks)` — 한국어/CJK 토크나이저 포함 BM25.
- `rankOf(scores)` — 점수 배열 → 순위 배열 (RRF용).
- `llmRerank(question, candidates)` — LLM 단일 호출로 후보 재정렬. rerankEnabled일 때만 사용.
- `processToken(token)` — `<think>` 블록 상태머신 + 코드펜스 제거 (스트리밍 중 실시간).
- 저장소: `docs` 배열(메모리) ↔ `data/docs.json`. LanceDB는 `chunksTable`(lazy open).
- 설정: `settings` 객체(메모리) ↔ `data/settings.json`. 기본값은 `DEFAULT_SETTINGS`.

## API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/index` | `{file, filename}` 파일 색인 → SSE (progress / done / error) |
| POST | `/api/index-url` | `{url}` 웹페이지 색인 → SSE (progress / done / error) |
| GET  | `/api/docs` | 색인된 문서 목록 (addedAt 내림차순) |
| PATCH | `/api/docs/:id` | `{name}` 문서 이름 변경 |
| DELETE | `/api/docs/:id` | 문서 + 해당 청크 삭제 |
| POST | `/api/ask` | `{question, history?, docIds?}` → SSE (sources / token / error) |
| GET  | `/api/settings` | 현재 설정 조회 |
| POST | `/api/settings` | 설정 변경 (chatModel, embedModel, maxChunkChars, topK, hydeEnabled, rerankEnabled) |
| GET  | `/api/health` | Ollama 연결·모델 설치·문서 수 |

### SSE 이벤트 타입

`/api/index`, `/api/index-url`:
- `{ type: "status", message }` — OCR 등 장시간 단계 진행 메시지
- `{ type: "progress", done, total }` — 임베딩 진행률
- `{ type: "done", docId, name, chunkCount }` — 색인 완료
- `{ type: "error", error }` — 오류

`/api/ask`:
- `{ type: "sources", sources[] }` — 검색 완료 즉시 전송 (답변 스트리밍 전)
- `{ type: "token", text }` — 답변 토큰 스트리밍
- `{ type: "error", error }` — 오류

`sources[]` 항목: `{ n, docName, index, score, snippet }`.

## 오류 응답 규약

| 코드 | 의미 |
|------|------|
| `400` | 입력 누락 / 문서 없는데 질문 |
| `409` | 동일 내용 문서 중복 업로드 (SHA-256 해시로 감지) |
| `422` | 텍스트 추출 실패 / 페이지 텍스트 없음 |
| `424` | 모델 미설치 (`ollama pull` 필요) |
| `502` | 기타 처리 오류 |
| `503` | Ollama 연결 불가 |

SSE 스트림 중 오류는 `{ type: "error", error }` 이벤트로 전송.

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3001` | 서버 포트 |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama 주소 |
| `OLLAMA_MODEL` | `qwen3:8b` | 답변 모델 (settings.json으로 덮어씀) |
| `EMBED_MODEL` | `bge-m3` | 임베딩 모델 (settings.json으로 덮어씀) |
| `MAX_CHUNK_CHARS` | `1200` | 청크 최대 크기 (settings.json으로 덮어씀) |
| `TOP_K` | `5` | 검색 상위 개수 (settings.json으로 덮어씀) |
| `OVERLAP_CHARS` | `200` | 청크 간 겹침 문자 수 (env만) |
| `DATA_DIR` | `./data` | 데이터 저장 경로 (테스트용 격리에 사용) |

> `settings.json`이 존재하면 env 기본값보다 우선합니다.

## 코딩 컨벤션

- 들여쓰기 2칸, ES 모듈, `"type":"module"`.
- `App.jsx`/`server.js` 는 단일 파일 유지. 색상은 `App.jsx` 상단 `C` 객체.
- UI 텍스트는 한국어.
- SSE 이벤트 스키마 또는 `sources` 형태를 바꾸면 `server.js`와 `App.jsx`를 함께 수정.
- LanceDB 컬럼: `id(str)`, `docId(str)`, `docName(str)`, `index(int)`, `text(str)`, `vector(float[])`.
  `c.vector`는 LanceDB `Vector` 타입이므로 코사인 계산 시 `Array.from(c.vector)` 필요.

## 테스트

```bash
node test-pipeline.mjs
```

Mock Ollama 서버(포트 21434)와 임시 DATA_DIR을 직접 띄워 외부 의존성 없이 전체 파이프라인 검증.  
커버 항목: 헬스체크, 색인(진행률 SSE), 중복 방지(409), 문서 목록, Q&A 스트리밍, 대화 맥락, docIds 필터, 문서 삭제.

## 알려진 제약 / 주의

- 8GB VRAM에서 답변 모델 + 임베딩 모델을 함께 쓰면 Ollama가 둘을 번갈아 로드해 약간의 지연이 생길 수 있음.
- HyDE와 LLM 재순위화는 각각 추가 LLM 호출을 발생시켜 응답 지연이 늘어남. 필요할 때만 활성화.
- LLM 재순위화는 모델 출력을 파싱하므로 모델 품질에 따라 결과가 달라질 수 있음.
- URL 색인은 JS 렌더링 없이 HTML만 파싱하므로 SPA(React/Vue) 페이지는 내용이 비어있을 수 있음.
- OCR은 페이지당 2× 스케일 렌더링 후 Tesseract 실행으로 느림. 페이지가 많은 스캔 PDF는 시간이 걸림.
- 답변 품질은 청크 크기·TOP_K·임베딩 모델에 민감. 검색이 엉뚱하면 설정 UI에서 `MAX_CHUNK_CHARS`(작게)·`TOP_K`(키워서) 조정.
