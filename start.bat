@echo off
chcp 65001 >nul
title 코어노트 (CoreNote)
echo ============================================
echo   코어노트 (CoreNote) - 로컬 PDF 학습 정리
echo ============================================
echo.
echo [확인] Ollama가 설치/실행 중이고 모델이 받아져 있어야 합니다.
echo        모델 받기:  ollama pull qwen3:8b
echo.
if not exist node_modules (
  echo [최초 1회] 의존성 설치 중... (npm install)
  call npm install
  echo.
)
echo 개발 서버 시작. 잠시 후 브라우저에서 http://localhost:5173 로 접속하세요.
echo (종료하려면 이 창에서 Ctrl + C)
echo.
call npm run dev
pause
