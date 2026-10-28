import { useEffect, useMemo, useState } from 'react'
import { listen, write, patch, stamp, storage } from './realtime'
import { rounds, START_BALANCE, MIN_BET, COLORS, coin, tally, fmtOdds } from './rounds'
import { rankPlayers, finalSteps } from './ranking'

const randomId = () => Math.random().toString(36).slice(2, 10)

export default function Player() {
  const [pin, setPin] = useState(() => new URLSearchParams(window.location.search).get('pin') || '')
  if (!pin) return <PinEntry onSubmit={setPin} />
  return <Game pin={pin} onLeave={() => setPin('')} />
}

function PinEntry({ onSubmit }) {
  const [value, setValue] = useState('')
  return (
    <div className="player center">
      <h1 className="logo big">도훗</h1>
      <form
        className="join-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) onSubmit(value.trim())
        }}
      >
        <input
          inputMode="numeric"
          placeholder="게임 PIN"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
          autoFocus
        />
        <button className="primary">입장</button>
      </form>
    </div>
  )
}

function Game({ pin, onLeave }) {
  const pidKey = `nahoot-pid-${pin}`
  const pid = useMemo(() => storage.get(pidKey, true) || randomId(), [pidKey])
  const [game, setGame] = useState(undefined)

  useEffect(() => listen(`games/${pin}`, setGame), [pin])

  if (game === undefined) return <Screen><p className="muted">연결 중…</p></Screen>
  if (game === null)
    return (
      <Screen>
        <p className="status-big">😢</p>
        <p>게임을 찾을 수 없어요</p>
        <button className="ghost" onClick={onLeave}>PIN 다시 입력</button>
      </Screen>
    )

  const me = game.players?.[pid]
  if (!me) return <NameEntry pin={pin} pid={pid} pidKey={pidKey} />

  return (
    <div className="player">
      <header className="player-bar">
        <span className="player-name">{me.name}</span>
        <span className="player-score">{coin(me.balance ?? START_BALANCE)}</span>
      </header>
      <PlayerBody pin={pin} pid={pid} game={game} me={me} />
    </div>
  )
}

function Screen({ children }) {
  return <div className="player center">{children}</div>
}

function NameEntry({ pin, pid, pidKey }) {
  const [name, setName] = useState('')
  const join = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    storage.set(pidKey, pid, true)
    write(`games/${pin}/players/${pid}`, { name: trimmed, balance: START_BALANCE, joinedAt: stamp() })
  }
  return (
    <div className="player center">
      <h1 className="logo big">도훗</h1>
      <form className="join-form" onSubmit={join}>
        <input
          placeholder="닉네임"
          maxLength={12}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <button className="primary">들어가기</button>
      </form>
    </div>
  )
}

function Center({ icon, title, children, className = '' }) {
  return (
    <div className={`player-center ${className}`}>
      {icon && <p className="status-big">{icon}</p>}
      {title && <p className="status-title">{title}</p>}
      {children}
    </div>
  )
}

function BetSummary({ round, bet }) {
  if (!bet) return null
  return (
    <p className="bet-summary">
      <b>{round.options[bet.choice]}</b>에 {coin(bet.amount)}
    </p>
  )
}

function PlayerBody({ pin, pid, game, me }) {
  const r = game.r
  const round = rounds[r]
  const myBet = game.bets?.[r]?.[pid]
  const balance = me.balance ?? START_BALANCE

  if (game.state === 'lobby')
    return (
      <Center icon="✅" title="입장 완료!">
        <p className="muted">기본금 {coin(START_BALANCE)}으로 시작해요</p>
        <p className="muted">화면을 봐주세요. 곧 시작해요</p>
      </Center>
    )

  if (game.state === 'betting') {
    const loaned = me.loanR === r
    if (myBet)
      return (
        <Center icon="🎲" title="베팅 완료!">
          <BetSummary round={round} bet={myBet} />
          <p className="muted">마감까지 기다려주세요</p>
        </Center>
      )
    if (balance < MIN_BET)
      return (
        <Center icon="💸" title="파산!">
          <p className="muted">잔액이 최소 베팅 {coin(MIN_BET)}보다 적어요</p>
          <button
            className="loan-button"
            onClick={() =>
              patch(`games/${pin}/players/${pid}`, { balance: MIN_BET, loans: (me.loans || 0) + 1, loanR: r })
            }
          >
            🏦 대출 {coin(MIN_BET)}
          </button>
        </Center>
      )
    return (
      <BetForm key={r} pin={pin} pid={pid} r={r} round={round} balance={balance} loaned={loaned} bets={game.bets?.[r]} />
    )
  }

  if (game.state === 'play')
    return (
      <Center icon="👀" title="베팅 마감!">
        {myBet ? (
          <BetSummary round={round} bet={myBet} />
        ) : (
          <p className="muted">이번 판은 베팅하지 않아서 {coin(MIN_BET)}이 몰수돼요</p>
        )}
        <p className="muted">화면을 봐주세요</p>
      </Center>
    )

  if (game.state === 'result') {
    const last = me.last?.r === r ? me.last : null
    if (!last) return <Center title="다음 판부터 참여해요" />
    if (last.refund)
      return (
        <Center icon="↩️" title="전액 환불">
          <p className="muted">아무도 못 맞혀서 건 금액을 돌려받았어요</p>
        </Center>
      )
    if (last.missed)
      return (
        <Center icon="⏰" title="미참여" className="result bad">
          <p className="points">-{coin(-last.delta)}</p>
        </Center>
      )
    return (
      <Center icon={last.win ? '🎉' : '💸'} title={last.win ? '적중!' : '꽝!'} className={`result ${last.win ? 'good' : 'bad'}`}>
        <p className="points">
          {last.win ? '+' : '-'}
          {coin(Math.abs(last.delta))}
        </p>
      </Center>
    )
  }

  // final
  const ranked = rankPlayers(game.players)
  const done = (game.step || 0) >= finalSteps(ranked.length).length
  if (!done) return <Center icon="🥁" title="결과 발표 중…"><p className="muted">화면을 봐주세요</p></Center>
  const rank = ranked.findIndex((p) => p.id === pid) + 1
  const isLast = ranked.length >= 4 && rank === ranked.length
  return (
    <Center icon={rank === 1 ? '👑' : rank <= 3 ? '🏅' : isLast ? '😇' : '🙌'} title={`${rank}등`}>
      <p className="muted">{isLast ? '나를 제일 모르는 사람' : `${ranked.length}명 중 ${rank}등`}</p>
      <p className="points">{coin(balance)}</p>
    </Center>
  )
}

function BetForm({ pin, pid, r, round, balance, loaned, bets }) {
  const [choice, setChoice] = useState(null)
  const [amount, setAmount] = useState(MIN_BET)
  const max = Math.max(balance, MIN_BET)
  const clamp = (n) => Math.min(max, Math.max(MIN_BET, n))
  const { pools, total, odds } = tally(bets, round.options.length)
  // 내 베팅까지 더했을 때의 예상 배당 (마감 전까지 계속 바뀐다)
  const expected = choice == null ? 0 : Math.floor((amount * (total + amount)) / (pools[choice] + amount))

  const submit = () => {
    if (choice == null) return
    write(`games/${pin}/bets/${r}/${pid}`, { choice, amount: clamp(amount), at: stamp() })
  }

  return (
    <div className="bet-form">
      {loaned && <p className="loan-banner">🏦 대출 {coin(MIN_BET)}을 받았어요</p>}
      <p className="player-q-text">
        {r + 1}. {round.text}
      </p>
      <div className={`bet-slots count-${round.options.length}`}>
        {round.options.map((opt, i) => (
          <button
            key={i}
            className={`bet-slot ${choice === i ? 'selected' : ''} ${choice != null && choice !== i ? 'faded' : ''}`}
            style={{ background: COLORS[i] }}
            onClick={() => setChoice(i)}
          >
            <span className="bet-mult">{fmtOdds(odds[i])}</span>
            <span className="bet-label">{opt}</span>
          </button>
        ))}
      </div>

      <div className="amount-box">
        <div className="amount-row">
          <button className="amount-step" onClick={() => setAmount((a) => clamp(a - 10))}>−</button>
          <span className="amount">{coin(amount)}</span>
          <button className="amount-step" onClick={() => setAmount((a) => clamp(a + 10))}>+</button>
        </div>
        <div className="quick-row">
          <button onClick={() => setAmount(MIN_BET)}>최소</button>
          <button onClick={() => setAmount(clamp(Math.floor(balance / 2)))}>절반</button>
          <button onClick={() => setAmount(max)}>올인</button>
        </div>
      </div>

      <button className="primary bet-submit" disabled={choice == null} onClick={submit}>
        {choice == null ? '칸을 먼저 골라주세요' : `${coin(amount)} 걸기 · 지금 적중하면 약 ${coin(expected)}`}
      </button>
    </div>
  )
}
