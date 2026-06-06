@echo off
chcp 65001 >nul
title 코어노트 (CoreNote · 로컬 RAG)
echo ============================================
echo   코어노트 (CoreNote) - 로컬 RAG 학습 도우미
echo ============================================
echo.
echo [확인] Ollama 실행 중 + 모델 2개가 받아져 있어야 합니다:
echo        ollama pull qwen3:8b      (답변 생성)
echo        ollama pull bge-m3        (임베딩/검색)
echo.
if not exist node_modules (
  echo [최초 1회] 의존성 설치 중... (npm install)
  call npm install
  echo.
)
echo 개발 서버 시작. 잠시 후 http://localhost:5173 로 접속하세요.
echo (종료: 이 창에서 Ctrl + C)
echo.
call npm run dev
pause
