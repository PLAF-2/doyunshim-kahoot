// 퀴즈 문제. answer 는 options 의 인덱스(0부터 시작)
export const TIME_LIMIT = 15

export const questions = [
  {
    text: '제 MBTI는?',
    options: ['INFP', 'ENTJ', 'ISFJ', 'ESTP'],
    answer: 1,
    comment: 'INFP 고르신 분들, 저를 너무 순하게 보셨네요 😎',
  },
  {
    text: '제가 제일 싫어하는 음식은?',
    options: ['호박', '당근', '오이', '가지'],
    answer: 0,
    comment: '호박은... 아직도 용서가 안 됩니다 🎃',
  },
  {
    text: '이 사진은 몇 살 때 저일까요?',
    image: '/q3-photo.webp',
    options: ['초3', '초4', '초5', '초6'],
    answer: 2,
    comment: '초등학교 5학년 때의 저였습니다 📸',
  },
  {
    text: '지난 1년 동안 제가 배달음식에 쓴 금액은?',
    options: ['110만 원', '310만 원', '510만 원', '1100만 원'],
    answer: 1,
    comment: '치킨으로 환산하면 약 155마리 🍗',
  },
  {
    text: '다음 중 거짓은?',
    label: '진실 2개 · 거짓 1개',
    options: [
      'PLAF 동아리를 재밌게 활동하고 있다',
      '이번 학기에 수업을 한 번도 빠지지 않았다',
      '최근 들어 살이 3kg 쪘다',
    ],
    answer: 1,
    double: true,
    comment: '사실... 몇 번 빠졌습니다 🙏',
  },
]

export const COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c']
export const SHAPES = ['▲', '◆', '●', '■']
