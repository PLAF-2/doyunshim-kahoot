# 도훗 (Dohoot)

> 여러분은 저를 얼마나 알고 계신가요?

PLAF 2기 **This is ME Project**. 저(doyunshim)에 대한 문제만 나오는 카훗 스타일 실시간 퀴즈예요.

## 사용법
- **발표 화면**: `/host` 에 접속하면 QR 코드와 PIN 이 떠요.
- **참가자**: QR 을 찍거나 사이트에 접속해 PIN 과 닉네임을 입력해요.
- 발표자는 버튼이나 **스페이스바**로 진행해요.
- 정답을 빨리 맞힐수록 점수가 높고(문제당 15초), 마지막 문제는 점수 2배예요.
- 최종 결과는 3등 → 2등 → 1등 순으로 공개하고, 마지막에 **나를 제일 모르는 사람(꼴등)** 을 공개해요.

## 기술
React (Vite) · Firebase Realtime Database · Vercel

## 로컬 실행
```bash
npm install
cp .env.example .env   # Firebase 설정값 입력 (비워두면 같은 브라우저 탭끼리만 되는 테스트 모드)
npm run dev
```

문제 수정은 `src/questions.js` 에서 해요.
