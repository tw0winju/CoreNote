<div align="center">

# 🧠 CoreNote

**로컬 RAG 학습 도우미**

PDF · DOCX · TXT · 웹페이지를 색인해두고 내 자료 전체에 질문하면,  
관련 부분을 찾아 **출처와 함께** 답해주는 AI 학습 도우미입니다.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-black?logo=ollama)
![License](https://img.shields.io/badge/license-MIT-blue)

> 임베딩 · 검색 · 답변이 전부 **내 컴퓨터**에서 돌아갑니다.  
> API 비용 0원, 데이터 외부 전송 없음.

</div>

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 💬 **RAG 질문 답변** | 하이브리드 검색(벡터 + BM25) · RRF 통합 · 출처 표시 |
| 📄 **문서 요약** | 자동 요약 생성 · 캐싱 · 원본과 나란히 비교 |
| 📝 **퀴즈 생성** | 색인 문서에서 객관식 퀴즈 자동 생성 |
| 📁 **폴더 관리** | 문서 폴더 분류 · 드롭다운으로 이동 |
| 🌐 **URL 색인** | 웹페이지 URL 입력만으로 색인 |
| 🔍 **OCR 지원** | 스캔 이미지 PDF → Tesseract 텍스트 추출 (한국어 + 영어) |
| ⚙️ **설정 UI** | 모델 · 청크 크기 · TOP_K · HyDE · 재순위화 UI 조정 |
| 🌙 **다크 / 라이트 테마** | 토글로 즉시 전환 |

---

## 🖥️ 권장 환경

| 항목 | 권장 사양 |
|------|-----------|
| OS | Windows 10 64bit |
| Runtime | Node.js 18+ |
| GPU VRAM | 8GB 이상 (RTX 3070급) |
| RAM | 16GB 이상 |
| LLM | Ollama (`qwen3:8b` + `bge-m3`) |

---

## 🚀 시작하기

### 1단계 — 사전 준비 (최초 1회)

**① Node.js 설치**
- https://nodejs.org → LTS 버전 Windows `.msi` 설치

**② Ollama 설치**
- https://ollama.com/download → Windows 설치 (백그라운드 자동 실행)

**③ 모델 다운로드**

```powershell
ollama pull qwen3:8b   # 답변 생성 모델
ollama pull bge-m3     # 임베딩(검색) 모델 · 한국어에 강함
```

### 2단계 — 실행

가장 쉬운 방법: **`start.bat` 더블클릭** (최초 1회 자동으로 의존성 설치)

또는 터미널:

```powershell
npm install   # 최초 1회
npm run dev   # 개발 서버 시작
```

브라우저에서 **http://localhost:5173** 접속

> **프로덕션 빌드**
> ```powershell
> npm run build
> npm start     # http://localhost:3001
> ```

---

## 📖 사용 흐름

```
① 내 자료 추가   →   ② 대화 탭에서 질문   →   ③ 학습 탭에서 요약 · 퀴즈
```

1. 왼쪽 사이드바 **내 자료**에서 PDF / DOCX / TXT 또는 웹페이지 URL 추가 → 자동 색인
2. **대화** 탭에서 자유롭게 질문 → 관련 조각 검색 후 답변 + 출처 표시
3. **학습 → 문서요약** 탭에서 요약 생성, **원본 보기**로 원문과 나란히 비교
4. **학습 → 퀴즈** 탭에서 선택한 문서로 객관식 퀴즈 생성 후 풀기

---

## ⚙️ 동작 구조 (RAG)

```
┌─────────────────────────────────────────────────────────┐
│  색인                                                    │
│  파일 / URL                                              │
│    → 텍스트 추출 (PDF · DOCX · TXT · OCR)               │
│    → 청크 분할 (기본 1200자, overlap 200자)               │
│    → 임베딩 (bge-m3)                                     │
│    → LanceDB 저장 (data/lancedb/)                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  질문                                                    │
│  질문 입력                                               │
│    → (HyDE ON: 가상 답변 생성)                           │
│    → 임베딩                                              │
│    → 벡터 검색 + BM25 키워드 검색                        │
│    → RRF 통합 → (재순위화)                               │
│    → 관련 조각 + 대화 맥락 → qwen3:8b                   │
│    → 답변 스트리밍 + 출처                                │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ 자주 나오는 문제

<details>
<summary><b>"Ollama에 연결할 수 없어요"</b></summary>

Ollama가 실행 중인지 확인하세요.

```powershell
ollama list
```

설치 후 보통 백그라운드에서 자동 실행됩니다. 없으면 Ollama 앱을 직접 실행하세요.
</details>

<details>
<summary><b>"임베딩 / 답변 모델이 없어요"</b></summary>

아래 명령으로 모델을 먼저 받아야 합니다.

```powershell
ollama pull qwen3:8b
ollama pull bge-m3
```
</details>

<details>
<summary><b>OCR이 너무 느려요</b></summary>

스캔 PDF는 페이지마다 렌더링 + OCR을 거칩니다. 페이지 수가 많을수록 오래 걸리는 게 정상입니다.  
색인할 페이지 범위를 지정(`pageFrom` / `pageTo`)해 범위를 줄이면 빨라집니다.
</details>

<details>
<summary><b>답변 품질이 낮아요</b></summary>

오른쪽 상단 ⚙️ 설정 UI에서 조정해보세요.

- `MAX_CHUNK_CHARS` ↓ (더 작게) — 청크를 세밀하게 나눠 검색 정확도 향상
- `TOP_K` ↑ (더 크게) — 더 많은 조각을 참고해 답변
- `HyDE` ON — 가상 답변으로 검색 품질 향상 (추가 LLM 호출 발생)
</details>

<details>
<summary><b>색인 데이터를 초기화하고 싶어요</b></summary>

`data/` 폴더를 삭제하면 모든 색인 · 설정 · 요약 캐시가 초기화됩니다.

```powershell
Remove-Item -Recurse -Force data/
```
</details>

---

## 📁 프로젝트 구조

```
corenote/
├── server.js          # Express 백엔드 (색인 · 검색 · 답변 · 요약)
├── src/
│   ├── App.jsx        # 최상위 레이아웃
│   └── components/
│       ├── Chat.jsx           # 대화 탭
│       ├── LearnPage.jsx      # 학습 탭 (요약 · 퀴즈 · 즐겨찾기)
│       ├── Library.jsx        # 내 자료 사이드바
│       ├── SessionSidebar.jsx # 다크 사이드바 + 탭 네비게이션
│       └── SettingsModal.jsx  # 설정 모달
├── data/              # 런타임 생성 (gitignore)
│   ├── lancedb/       # 벡터 저장소
│   ├── docs.json      # 문서 메타데이터
│   ├── summaries.json # 요약 캐시
│   └── settings.json  # 사용자 설정
└── CLAUDE.md          # 개발자 안내 문서
```

---

<div align="center">

자세한 개발 · 구조 안내는 [`CLAUDE.md`](./CLAUDE.md) 참고

</div>
