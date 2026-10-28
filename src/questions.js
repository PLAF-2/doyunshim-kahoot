// 퀴즈 문제. answer 는 options 의 인덱스(0부터 시작), short 는 마지막 비교 화면에 쓰는 이름
export const TIME_LIMIT = 15

export const questions = [
  {
    text: '제 MBTI는?',
    short: 'MBTI',
    options: ['INFP', 'ENTJ', 'ISFJ', 'ESTP'],
    answer: 1,
  },
  {
    text: '제가 제일 싫어하는 음식은?',
    short: '싫어하는 음식',
    options: ['호박', '당근', '오이', '가지'],
    answer: 0,
  },
  {
    text: '이 사진은 몇 살 때 저일까요?',
    short: '사진 속 나',
    image: '/q3-photo.webp',
    options: ['초3', '초4', '초5', '초6'],
    answer: 2,
  },
  {
    text: '지난 1년 동안 제가 배달음식에 쓴 금액은?',
    short: '1년 배달비',
    options: ['120만 원', '320만 원', '520만 원', '1200만 원'],
    answer: 1,
  },
  {
    text: '다음 중 거짓은?',
    short: '거짓말',
    label: '진실 2개 · 거짓 1개',
    options: [
      'PLAF 동아리를 재밌게 활동하고 있다',
      '이번 학기에 수업을 한 번도 빠지지 않았다',
      '최근 들어 살이 3kg 쪘다',
    ],
    answer: 1,
    double: true,
  },
]

export const COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c']
export const SHAPES = ['▲', '◆', '●', '■']

// 연속 정답 배율: 1번째 ×1, 2연속 ×1.5, 3연속 ×2, 4연속 ×3, 5연속 ×5
export const COMBO = [1, 1.5, 2, 3, 5]
export const comboMultiplier = (streak) => COMBO[Math.min(Math.max(streak, 1), COMBO.length) - 1]
