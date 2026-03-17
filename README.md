# Screen Solver

스크린샷이나 이미지를 AI가 분석해서 문제를 풀어주는 웹앱입니다.
Google Gemini 2.0 Flash를 사용하며 Vercel에 배포됩니다.

## 기능

- **붙여넣기 / 파일 업로드**: 스크린샷을 Ctrl+V로 붙여넣거나 파일로 올리면 즉시 분석
- **화면 공유 (실시간)**: 화면을 공유하면 변화가 감지될 때마다 자동 스캔 (PC)
- **카메라 (실시간)**: 카메라로 문제를 비추면 자동 분석 (모바일)
- **다양한 문제 유형 지원**: 수학, 코딩 오류, 객관식, 번역, 영문법, 논리 퍼즐 등

## 배포 (Vercel)

### 1. 환경변수 설정

Vercel 대시보드 → 프로젝트 → **Settings → Environment Variables**

| 키 | 값 |
|---|---|
| `GOOGLE_API_KEY` | Google AI Studio API 키 |

API 키 발급: https://aistudio.google.com/apikey

### 2. 배포

```bash
vercel --prod
```

또는 GitHub 연동 시 push하면 자동 배포됩니다.

## 로컬 실행

```bash
# .env 파일 생성
echo "GOOGLE_API_KEY=AIza..." > .env

# 서버 실행
node server.js

# 브라우저에서 열기
open http://localhost:3333
```

## 구조

```
screen-solver/
  index.html        # 프론트엔드
  api/
    messages.js     # Vercel Serverless Function (Gemini API 프록시)
  server.js         # 로컬 개발용 서버
  vercel.json       # Vercel 설정
```
