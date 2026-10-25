import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import confetti from 'canvas-confetti'
import { listen, write, patch, stamp, storage, isMock } from './realtime'
import { questions, TIME_LIMIT, COLORS, SHAPES } from './questions'
import { rankPlayers, finalSteps } from './ranking'

const PIN_KEY = 'nahoot-host-pin'
const newPin = () => String(Math.floor(100000 + Math.random() * 900000))

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
        write(`games/${pin}`, { state: 'lobby', q: -1, step: 0, scoredQ: -1, createdAt: stamp() })
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
      {/* 문제마다 새로 마운트해서 타이머가 이전 문제 값을 물려받지 않게 한다 */}
      {(game.state === 'question' || game.state === 'reveal') && (
        <QuestionStage key={game.q} pin={pin} game={game} />
      )}
      {game.state === 'final' && <Final pin={pin} game={game} />}
    </div>
  )
}

function useSpaceKey(action) {
  useEffect(() => {
    if (!action) return
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
        e.preventDefault()
        action()
      }
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
    if (players.length === 0) return
    patch(`games/${pin}`, { state: 'question', q: 0, startedAt: stamp() })
  }, [pin, players.length])
  useSpaceKey(start)

  return (
    <main className="lobby">
      <section className="lobby-join">
        <h1 className="title">여러분은 저를 얼마나 알고 계신가요?</h1>
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

function QuestionStage({ pin, game }) {
  const q = game.q
  const question = questions[q]
  const isReveal = game.state === 'reveal'
  const playerIds = Object.keys(game.players || {})
  const qAnswers = game.answers?.[q] || {}
  const answeredCount = Object.keys(qAnswers).length
  const isLast = q === questions.length - 1

  // 남은 시간은 발표 화면 기준으로만 보여준다 (점수는 서버 시각으로 계산)
  const [remaining, setRemaining] = useState(TIME_LIMIT)
  useEffect(() => {
    if (isReveal) return
    const start = Date.now()
    setRemaining(TIME_LIMIT)
    const id = setInterval(() => {
      setRemaining(Math.max(0, TIME_LIMIT - (Date.now() - start) / 1000))
    }, 100)
    return () => clearInterval(id)
  }, [q, isReveal])

  const revealedRef = useRef(-1)
  const reveal = useCallback(() => {
    if (revealedRef.current === q || game.scoredQ >= q) return
    revealedRef.current = q
    const updates = { state: 'reveal', scoredQ: q }
    for (const [pid, p] of Object.entries(game.players || {})) {
      const a = qAnswers[pid]
      const correct = a?.choice === question.answer
      let points = 0
      if (correct) {
        const elapsed = Math.min(Math.max((a.at - game.startedAt) / 1000, 0), TIME_LIMIT)
        points = Math.round(1000 * (1 - elapsed / TIME_LIMIT / 2)) * (question.double ? 2 : 1)
      }
      updates[`players/${pid}/score`] = (p.score || 0) + points
      updates[`players/${pid}/last`] = { q, correct, points, answered: !!a }
    }
    patch(`games/${pin}`, updates)
  }, [pin, q, game, qAnswers, question])

  // 시간이 끝나거나 모두 답하면 자동 공개
  useEffect(() => {
    if (isReveal) return
    if (remaining <= 0 || (playerIds.length > 0 && answeredCount >= playerIds.length)) reveal()
  }, [isReveal, remaining, answeredCount, playerIds.length, reveal])

  const next = useCallback(() => {
    if (isLast) patch(`games/${pin}`, { state: 'final', step: 0 })
    else patch(`games/${pin}`, { state: 'question', q: q + 1, startedAt: stamp() })
  }, [pin, q, isLast])
  useSpaceKey(isReveal ? next : null)

  const counts = question.options.map(
    (_, i) => Object.values(qAnswers).filter((a) => a.choice === i).length,
  )
  const maxCount = Math.max(1, ...counts)

  return (
    <main className="stage">
      <div className="stage-top">
        <span className="q-num">
          {q + 1} / {questions.length}
        </span>
        {question.double && <span className="double-chip">🔥 점수 2배!</span>}
        {question.label && <span className="label-chip">{question.label}</span>}
        {isReveal ? (
          <button className="primary stage-action" onClick={next}>
            {isLast ? '최종 결과 🏆' : '다음 문제 ▶'}
          </button>
        ) : (
          <button className="ghost stage-action" onClick={reveal}>
            바로 공개
          </button>
        )}
      </div>
      <h1 className="question">{question.text}</h1>

      <div className="stage-middle">
        {!isReveal ? (
          <>
            <div className="timer" style={{ '--p': remaining / TIME_LIMIT }}>
              {Math.ceil(remaining)}
            </div>
            {question.image ? (
              <img className="q-image" src={question.image} alt="" />
            ) : (
              <div className="q-image-spacer" />
            )}
            <div className="answered">
              <span className="big-num">{answeredCount}</span>
              <span>/ {playerIds.length} 응답</span>
            </div>
          </>
        ) : (
          <div className="reveal">
            <div className="bars">
              {counts.map((c, i) => (
                <div key={i} className={`bar-col ${i === question.answer ? 'is-correct' : 'is-wrong'}`}>
                  <span className="bar-count">{c}</span>
                  <div
                    className="bar"
                    style={{ height: `${(c / maxCount) * 100}%`, background: COLORS[i] }}
                  />
                  <span className="bar-shape" style={{ background: COLORS[i] }}>
                    {SHAPES[i]} {i === question.answer && '✔'}
                  </span>
                </div>
              ))}
            </div>
            {question.image && <img className="q-image small" src={question.image} alt="" />}
          </div>
        )}
      </div>


      <div className={`options count-${question.options.length}`}>
        {question.options.map((opt, i) => (
          <div
            key={i}
            className={`option ${isReveal && i !== question.answer ? 'dim' : ''}`}
            style={{ background: COLORS[i] }}
          >
            <span className="shape">{SHAPES[i]}</span>
            <span className="opt-text">{opt}</span>
            {isReveal && i === question.answer && <span className="check">✔</span>}
          </div>
        ))}
      </div>
    </main>
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
                    <span className="podium-score">{p.score.toLocaleString()}점</span>
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
            <p className="last-score">{last.score.toLocaleString()}점</p>
          </div>
        </div>
      )}

      {!done && (
        <button className="primary corner" onClick={next}>
          {step === 0 ? `${steps[0]}등 공개` : steps[step] === 'last' ? '꼴등 공개 😇' : `${steps[step]}등 공개`}
        </button>
      )}
    </main>
  )
}
