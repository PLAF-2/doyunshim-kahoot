import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import confetti from 'canvas-confetti'
import { listen, write, patch, stamp, storage, isMock } from './realtime'
import {
  rounds, START_BALANCE, MIN_BET, BET_TIME, COLORS, judgeStopwatch, coin, tally, fmtOdds,
} from './rounds'
import { rankPlayers, finalSteps } from './ranking'

const PIN_KEY = 'nahoot-host-pin'
const newPin = () => String(Math.floor(100000 + Math.random() * 900000))
const isGoKey = (e) => e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter'

// 잔액이 부족한 사람은 폰의 대출 버튼으로 직접 채운다
function startRound(pin, r) {
  patch(`games/${pin}`, { state: 'betting', r, answer: null, shown: null, refund: null })
}

export default function Host() {
  const [pin, setPin] = useState(() => {
    const saved = storage.get(PIN_KEY)
    if (saved) return saved
    const p = newPin()
    storage.set(PIN_KEY, p)
    return p
  })
  const [game, setGame] = useState(null)

  useEffect(() => {
    setGame(null)
    return listen(`games/${pin}`, (g) => {
      if (g === null) {
        write(`games/${pin}`, { state: 'lobby', r: -1, step: 0, settledR: -1, createdAt: stamp() })
        return
      }
      setGame(g)
    })
  }, [pin])

  // 브라우저 확인 창은 막히는 환경이 있어서, 3초 안에 두 번 누르면 새 게임
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    if (!confirming) return
    const id = setTimeout(() => setConfirming(false), 3000)
    return () => clearTimeout(id)
  }, [confirming])

  const startNewGame = () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    const p = newPin()
    storage.set(PIN_KEY, p)
    setPin(p)
  }

  if (!game) return <div className="host center"><p className="muted">게임 준비 중…</p></div>

  const inRound = ['betting', 'play', 'result'].includes(game.state)

  return (
    <div className="host">
      <header className="host-bar">
        <span className="logo">도훗</span>
        {game.state !== 'lobby' && <span className="pin-chip">PIN {pin}</span>}
        {isMock && <span className="mock-chip">로컬 테스트 모드</span>}
        <button className={`ghost ${confirming ? 'confirming' : ''}`} onClick={startNewGame}>
          {confirming ? '한 번 더 누르면 새 게임' : '새 게임'}
        </button>
      </header>
      {game.state === 'lobby' && <Lobby pin={pin} game={game} />}
      {/* 판마다 새로 마운트해서 타이머·초시계가 이전 판 값을 물려받지 않게 한다 */}
      {inRound && <RoundStage key={game.r} pin={pin} game={game} />}
      {game.state === 'final' && <Final pin={pin} game={game} />}
    </div>
  )
}

function useSpaceKey(action) {
  useEffect(() => {
    if (!action) return
    const onKey = (e) => {
      if (!isGoKey(e) || e.repeat) return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [action])
}

function Lobby({ pin, game }) {
  const [qr, setQr] = useState('')
  const joinUrl = `${window.location.origin}/?pin=${pin}`
  const players = rankPlayers(game.players).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { width: 640, margin: 1 }).then(setQr)
  }, [joinUrl])

  const start = useCallback(() => {
    if (players.length > 0) startRound(pin, 0)
  }, [pin, players.length])
  useSpaceKey(start)

  return (
    <main className="lobby">
      <section className="lobby-join">
        <h1 className="title">저에게 걸어보세요 🎰</h1>
        <p className="lobby-rule">
          기본금 {coin(START_BALANCE)} · 매 판 최소 {coin(MIN_BET)} · 배당은 베팅 비율로 결정!
        </p>
        <div className="join-card">
          {qr && <img className="qr" src={qr} alt="참가 QR 코드" />}
          <div className="join-info">
            <p className="muted">QR을 찍거나 접속해서 PIN 입력</p>
            <p className="join-url">{window.location.host}</p>
            <p className="pin-label">PIN</p>
            <p className="pin">{pin}</p>
          </div>
        </div>
      </section>
      <section className="lobby-players">
        <div className="lobby-count">
          <span className="big-num">{players.length}</span>명 입장
        </div>
        <ul className="name-cloud">
          {players.map((p) => (
            <li key={p.id} className="name-tag">{p.name}</li>
          ))}
        </ul>
        {players.length === 0 && <p className="muted waiting">참가자를 기다리는 중…</p>}
      </section>
      <button className="primary corner" onClick={start} disabled={players.length === 0}>
        시작하기 ▶
      </button>
    </main>
  )
}

function RoundStage({ pin, game }) {
  const r = game.r
  const round = rounds[r]
  const { state } = game
  const players = game.players || {}
  const playerIds = Object.keys(players)
  const rBets = game.bets?.[r] || {}
  const betCount = Object.keys(rBets).length
  const isLast = r === rounds.length - 1

  // 베팅 남은 시간 (발표 화면 기준)
  const [remaining, setRemaining] = useState(BET_TIME)
  useEffect(() => {
    if (state !== 'betting') return
    const start = Date.now()
    const id = setInterval(() => {
      setRemaining(Math.max(0, BET_TIME - (Date.now() - start) / 1000))
    }, 100)
    return () => clearInterval(id)
  }, [state])

  const closedRef = useRef(false)
  const closeBets = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    patch(`games/${pin}`, { state: 'play' })
  }, [pin])

  useEffect(() => {
    if (state !== 'betting') return
    if (remaining <= 0 || (playerIds.length > 0 && betCount >= playerIds.length)) closeBets()
  }, [state, remaining, betCount, playerIds.length, closeBets])

  // 토토 정산: 맞힌 사람들이 전체 판돈을 건 금액 비율대로 나눠 갖는다.
  // 아무도 못 맞히면 전원 환불, 안 걸었으면 최소 베팅만큼 몰수
  const settledRef = useRef(false)
  const reveal = useCallback(
    (answer, shown = null) => {
      if (settledRef.current || game.settledR >= r) return
      settledRef.current = true
      const amounts = {}
      for (const [pid, bet] of Object.entries(rBets)) {
        const balance = players[pid]?.balance ?? START_BALANCE
        amounts[pid] = Math.min(bet.amount, balance)
      }
      const total = Object.values(amounts).reduce((a, b) => a + b, 0)
      const winPool = Object.entries(amounts)
        .filter(([pid]) => rBets[pid].choice === answer)
        .reduce((a, [, amt]) => a + amt, 0)
      const refund = winPool === 0
      const updates = { state: 'result', answer, settledR: r, shown, refund }
      for (const [pid, p] of Object.entries(players)) {
        const balance = p.balance ?? START_BALANCE
        const bet = rBets[pid]
        let delta
        if (!bet) delta = -Math.min(MIN_BET, balance)
        else if (refund) delta = 0
        else if (bet.choice === answer) delta = Math.floor((amounts[pid] * total) / winPool) - amounts[pid]
        else delta = -amounts[pid]
        updates[`players/${pid}/balance`] = balance + delta
        updates[`players/${pid}/last`] = {
          r, delta, missed: !bet, refund: !!bet && refund, win: !!bet && !refund && bet.choice === answer,
        }
      }
      patch(`games/${pin}`, updates)
    },
    [pin, r, game.settledR, players, rBets],
  )

  const next = useCallback(() => {
    if (isLast) patch(`games/${pin}`, { state: 'final', step: 0 })
    else startRound(pin, r + 1)
  }, [pin, r, isLast])

  const revealQuiz = () => reveal(round.answer, round.reveal ?? null)
  let spaceAction = null
  if (state === 'betting') spaceAction = closeBets
  else if (state === 'play' && round.type === 'quiz') spaceAction = revealQuiz
  else if (state === 'result') spaceAction = next
  useSpaceKey(spaceAction)

  const { pools, counts, odds } = tally(rBets, round.options.length)
  const isResult = state === 'result'

  // 이번 판 결과 요약
  const winners = isResult
    ? Object.values(players)
        .filter((p) => p.last?.r === r && p.last.win)
        .sort((a, b) => b.last.delta - a.last.delta)
    : []

  let action = null
  if (state === 'betting') action = <button className="primary stage-action" onClick={closeBets}>베팅 마감 ⏹</button>
  else if (state === 'play' && round.type === 'quiz')
    action = <button className="primary stage-action" onClick={revealQuiz}>정답 공개 ▶</button>
  else if (isResult)
    action = <button className="primary stage-action" onClick={next}>{isLast ? '최종 결과 🏆' : '다음 판 ▶'}</button>

  return (
    <main className="stage">
      <div className="stage-top">
        <span className="q-num">ROUND {r + 1} / {rounds.length}</span>
        <span className="label-chip">{round.tag}</span>
        {action}
      </div>
      <h1 className="question">{round.text}</h1>

      <div className="stage-middle">
        {state === 'betting' && (
          <>
            <div className="timer" style={{ '--p': remaining / BET_TIME }}>{Math.ceil(remaining)}</div>
            {round.image ? <img className="q-image" src={round.image} alt="" /> : <BetPrompt />}
            <div className="answered">
              <span className="big-num">{betCount}</span>
              <span>/ {playerIds.length} 베팅</span>
            </div>
          </>
        )}
        {state === 'play' && round.type === 'stopwatch' && (
          <Stopwatch
            target={round.target}
            onDone={(sec) => reveal(judgeStopwatch(round, sec), `${sec.toFixed(2)}초`)}
          />
        )}
        {state === 'play' && round.type === 'number' && (
          <NumberReveal unit={round.unit} onSubmit={(n) => reveal(n % 2 === 1 ? 0 : 1, `${n.toLocaleString()}${round.unit}`)} />
        )}
        {state === 'play' && round.type === 'quiz' && (
          <div className="center-msg">
            {round.image && <img className="q-image" src={round.image} alt="" />}
            <p className="center-big">베팅 마감! 배당 확정</p>
          </div>
        )}
        {isResult && (
          <div className="center-msg">
            {game.shown && <p className="result-time">{game.shown}</p>}
            {round.image && <img className="q-image small" src={round.image} alt="" />}
            <p className="center-big">
              {betCount === 0
                ? '🤷 아무도 베팅하지 않았어요'
                : game.refund
                  ? '🤷 아무도 못 맞혀서 전액 환불!'
                  : `🎉 ${winners.length}명 적중!`}
            </p>
            {winners[0] && (
              <p className="jackpot-line">
                이번 판 최고 수익 <b>{winners[0].name}</b> +{coin(winners[0].last.delta)}
              </p>
            )}
          </div>
        )}
      </div>

      {round.note && <p className="slot-note">{round.note}</p>}
      <div className={`slots count-${round.options.length}`}>
        {round.options.map((opt, i) => {
          const correct = isResult && i === game.answer
          return (
            <div
              key={i}
              className={`slot ${odds[i] >= 5 ? 'jackpot' : ''} ${isResult && !correct ? 'dim' : ''} ${correct ? 'correct' : ''}`}
              style={{ '--c': COLORS[i] }}
            >
              <span className="mult">{fmtOdds(odds[i])}</span>
              <span className="slot-label">{opt}</span>
              <span className="slot-count">👤 {counts[i]} · {coin(pools[i])}</span>
              {correct && <span className="slot-check">✔</span>}
            </div>
          )
        })}
      </div>
    </main>
  )
}

function NumberReveal({ unit, onSubmit }) {
  const [value, setValue] = useState('')
  return (
    <form
      className="center-msg number-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (value !== '') onSubmit(Number(value))
      }}
    >
      <p className="center-big">🔴 베팅 마감! 지금 공개하세요</p>
      <div className="number-row">
        <input
          autoFocus
          inputMode="numeric"
          placeholder="숫자"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
        />
        <span className="number-unit">{unit}</span>
        <button className="primary" disabled={value === ''}>공개 ▶</button>
      </div>
      <p className="muted">숫자를 입력하고 엔터를 누르면 홀짝이 자동으로 판정돼요</p>
    </form>
  )
}

function BetPrompt() {
  return (
    <div className="center-msg">
      <p className="center-big">폰에서 칸을 고르고 베팅하세요!</p>
      <p className="muted">적게 걸린 칸일수록 배당이 커져요 · 안 걸면 {coin(MIN_BET)} 몰수</p>
    </div>
  )
}

// 스페이스: 0부터 측정 시작 → 즉시 멈춤 → 결과 공개
function Stopwatch({ target, onDone }) {
  const [phase, setPhase] = useState('idle')
  const [display, setDisplay] = useState(0)
  const phaseRef = useRef('idle')
  const startRef = useRef(0)
  const resultRef = useRef(0)
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })

  const go = useCallback((p) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  const press = useCallback(() => {
    const now = performance.now()
    const p = phaseRef.current
    if (p === 'idle') {
      startRef.current = now
      go('running')
    } else if (p === 'running') {
      // 키를 누른 그 순간의 시각으로 계산해서 렌더링 지연과 무관하게 멈춘다
      const sec = Math.round((now - startRef.current) / 10) / 100
      resultRef.current = sec
      setDisplay(sec)
      go('stopped')
    } else if (p === 'stopped') {
      go('done')
      onDoneRef.current(resultRef.current)
    }
  }, [go])

  useEffect(() => {
    if (phase !== 'running') return
    let id
    const tick = () => {
      setDisplay((performance.now() - startRef.current) / 1000)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [phase])

  useSpaceKey(press)

  return (
    <div className="stopwatch-wrap" onClick={press}>
      {phase === 'idle' && (
        <>
          <p className="stopwatch">0.00</p>
          <p className="muted">스페이스를 누르면 바로 시작해요 · 목표 {target}초</p>
        </>
      )}
      {phase === 'running' && (
        <>
          <p className="stopwatch running">{display.toFixed(2)}</p>
          <p className="muted">스페이스를 누르면 멈춰요</p>
        </>
      )}
      {(phase === 'stopped' || phase === 'done') && (
        <>
          <p className="stopwatch stopped">{display.toFixed(2)}</p>
          <p className="muted">스페이스를 누르면 결과를 공개해요</p>
        </>
      )}
    </div>
  )
}

function Final({ pin, game }) {
  const ranked = rankPlayers(game.players)
  const steps = finalSteps(ranked.length)
  const step = game.step || 0
  const shown = steps.slice(0, step)
  const current = shown.at(-1)
  const done = step >= steps.length

  useEffect(() => {
    if (current !== 1) return
    const end = Date.now() + 2500
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0 } })
      confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1 } })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [current])

  const next = useCallback(() => {
    if (!done) patch(`games/${pin}`, { step: step + 1 })
  }, [pin, step, done])
  useSpaceKey(done ? null : next)

  const last = ranked.at(-1)
  const showLast = current === 'last'

  return (
    <main className="final">
      <h1 className="title">{step === 0 ? '최종 결과를 발표합니다 🥁' : '🏆 최종 순위'}</h1>

      <div className="podium">
        {[2, 1, 3].map((place) => {
          const p = ranked[place - 1]
          if (!p) return <div key={place} className="podium-slot empty" />
          const visible = shown.includes(place)
          return (
            <div key={place} className={`podium-slot place-${place} ${visible ? 'visible' : ''}`}>
              <div className="podium-name">
                {visible ? (
                  <>
                    <span className="podium-player">{p.name}</span>
                    <span className="podium-score">{coin(p.balance)}</span>
                  </>
                ) : (
                  <span className="podium-player">?</span>
                )}
              </div>
              <div className="podium-block">
                {place === 1 && visible && <span className="crown">👑</span>}
                <span>{place}</span>
              </div>
            </div>
          )
        })}
      </div>

      {showLast && last && (
        <div className="last-overlay">
          <div className="last-card">
            <p className="last-label">😇 나를 제일 모르는 사람</p>
            <p className="last-name">{last.name}</p>
            <p className="last-score">{coin(last.balance)}</p>
          </div>
        </div>
      )}

      {!done && (
        <button className="primary corner" onClick={next}>
          {steps[step] === 'last' ? '꼴등 공개 😇' : `${steps[step]}등 공개`}
        </button>
      )}
    </main>
  )
}
