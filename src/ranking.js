// 잔액 내림차순, 동점이면 먼저 입장한 사람이 위
export function rankPlayers(players) {
  return Object.entries(players || {})
    .map(([id, p]) => ({ id, ...p, balance: p.balance ?? 100 }))
    .sort((a, b) => b.balance - a.balance || (a.joinedAt || 0) - (b.joinedAt || 0))
}

// 최종 발표 순서: 3등 → 2등 → 1등 → 꼴등(4명 이상일 때만)
export function finalSteps(count) {
  const steps = []
  if (count >= 3) steps.push(3)
  if (count >= 2) steps.push(2)
  if (count >= 1) steps.push(1)
  if (count >= 4) steps.push('last')
  return steps
}
