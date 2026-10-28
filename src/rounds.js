// 베팅 라운드. 배당은 토토 방식으로 건 금액 비율에 따라 자동 계산된다
// type
//   quiz      : 정답(answer)이 미리 정해져 있음. reveal 이 있으면 정답 공개 때 크게 보여줌
//   number    : 발표자가 그 자리에서 숫자를 입력하면 홀(0)/짝(1) 자동 판정
//   stopwatch : 초시계 결과로 자동 판정 (bands 기준)
export const START_BALANCE = 100
export const MIN_BET = 50
export const BET_TIME = 20

const ODD_EVEN = ['홀', '짝']

export const rounds = [
  {
    type: 'quiz',
    tag: '🎲 홀짝',
    text: '지금 제 카톡에 안 읽은 메시지 수는 홀? 짝?',
    options: ODD_EVEN,
    answer: 0,
    reveal: '593개',
  },
  {
    type: 'stopwatch',
    tag: '⏱️ LIVE 도전',
    text: '제가 눈 감고 8초를 세면, 실제로는 몇 초일까요?',
    target: 8,
    options: ['그 외', '7.50 ~ 8.50초', '7.80 ~ 8.20초', '7.95 ~ 8.05초'],
    // 8초에서 벗어난 허용 범위. 더 좁은 칸에 들어가면 그 칸만 당첨
    bands: [Infinity, 0.5, 0.2, 0.05],
    note: '더 좁은 칸에 들어가면 그 칸만 당첨!',
  },
  {
    type: 'number',
    tag: '🎲 홀짝 · 즉석 공개',
    text: '지금 제 폰 배터리 %는 홀? 짝?',
    options: ODD_EVEN,
    unit: '%',
  },
  {
    type: 'quiz',
    tag: '📸 퀴즈',
    text: '이 사진은 몇 살 때 저일까요?',
    image: '/q3-photo.webp',
    options: ['초1', '초3', '초5', '중1'],
    answer: 2,
  },
  {
    type: 'quiz',
    tag: '💸 퀴즈',
    text: '지난 1년 동안 제가 배달음식에 쓴 금액은?',
    options: ['110만 원', '310만 원', '510만 원', '1100만 원'],
    answer: 1,
  },
  {
    type: 'number',
    tag: '🎲 홀짝 · 즉석 공개',
    text: '오늘 제 걸음 수는 홀? 짝?',
    options: ODD_EVEN,
    unit: '걸음',
  },
  {
    type: 'quiz',
    tag: '🧠 진실 2 · 거짓 1',
    text: '다음 중 거짓은?',
    options: [
      'PLAF 동아리를 재밌게 활동하고 있다',
      '이번 학기에 수업을 한 번도 빠지지 않았다',
      '최근 들어 살이 3kg 쪘다',
    ],
    answer: 1,
  },
]

// 화면에 보이는 값(소수 둘째 자리)으로 판정해야 청중이 납득한다
export function judgeStopwatch(round, seconds) {
  const diff = Math.abs(Math.round(seconds * 100) / 100 - round.target)
  let win = 0
  round.bands.forEach((band, i) => {
    if (diff <= band + 1e-9) win = i
  })
  return win
}

// 칸별 베팅 인원·금액과 토토 배당(전체 금액 ÷ 그 칸 금액)
export function tally(bets, n) {
  const pools = Array(n).fill(0)
  const counts = Array(n).fill(0)
  for (const b of Object.values(bets || {})) {
    pools[b.choice] += b.amount
    counts[b.choice] += 1
  }
  const total = pools.reduce((a, b) => a + b, 0)
  const odds = pools.map((p) => (p > 0 ? total / p : null))
  return { pools, counts, total, odds }
}

export const fmtOdds = (o) => (o == null ? '×?' : `×${o >= 10 ? Math.floor(o) : o.toFixed(1)}`)
export const COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c']
export const coin = (n) => `🪙${Math.round(n).toLocaleString()}`
