import { useEffect, useMemo, useState } from 'react'
import { listen, write, stamp, storage } from './realtime'
import { questions, COLORS, SHAPES } from './questions'
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
        <span className="player-score">{(me.score || 0).toLocaleString()}점</span>
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
    write(`games/${pin}/players/${pid}`, { name: trimmed, score: 0, joinedAt: stamp() })
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

function PlayerBody({ pin, pid, game, me }) {
  const q = game.q
  const question = questions[q]
  const myAnswer = game.answers?.[q]?.[pid]

  if (game.state === 'lobby')
    return (
      <div className="player-center">
        <p className="status-big">✅</p>
        <p className="status-title">입장 완료!</p>
        <p className="muted">화면을 봐주세요. 곧 시작해요</p>
      </div>
    )

  if (game.state === 'question') {
    if (myAnswer)
      return (
        <div className="player-center">
          <p className="status-big">⏳</p>
          <p className="status-title">제출 완료!</p>
          <p className="muted">두근두근… 다른 사람들을 기다리는 중</p>
        </div>
      )
    return (
      <div className="player-question">
        <p className="player-q-text">
          {q + 1}. {question.text}
          {question.double && <span className="double-chip small">🔥 2배</span>}
        </p>
        <div className={`player-options count-${question.options.length}`}>
          {question.options.map((opt, i) => (
            <button
              key={i}
              className="player-option"
              style={{ background: COLORS[i] }}
              onClick={() => write(`games/${pin}/answers/${q}/${pid}`, { choice: i, at: stamp() })}
            >
              <span className="shape">{SHAPES[i]}</span>
              <span>{opt}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (game.state === 'reveal') {
    const last = me.last?.q === q ? me.last : null
    if (!last)
      return (
        <div className="player-center">
          <p className="status-title">다음 문제부터 참여해요</p>
        </div>
      )
    return (
      <div className={`player-center result ${last.correct ? 'good' : 'bad'}`}>
        <p className="status-big">{last.correct ? '⭕' : last.answered ? '❌' : '⏰'}</p>
        <p className="status-title">
          {last.correct ? '정답!' : last.answered ? '땡!' : '시간 초과'}
        </p>
        {last.correct && <p className="points">+{last.points.toLocaleString()}</p>}
        {last.correct && last.streak >= 2 && (
          <p className="combo-line">🔥 {last.streak}연속! ×{last.combo}</p>
        )}
        {last.broke && <p className="combo-line">💔 콤보 끊김</p>}
      </div>
    )
  }

  // final
  const ranked = rankPlayers(game.players)
  const done = (game.step || 0) >= finalSteps(ranked.length).length
  if (!done)
    return (
      <div className="player-center">
        <p className="status-big">🥁</p>
        <p className="status-title">결과 발표 중…</p>
        <p className="muted">화면을 봐주세요</p>
      </div>
    )
  const rank = ranked.findIndex((p) => p.id === pid) + 1
  const isLast = ranked.length >= 4 && rank === ranked.length
  return (
    <div className="player-center">
      <p className="status-big">{rank === 1 ? '👑' : rank <= 3 ? '🏅' : isLast ? '😇' : '🙌'}</p>
      <p className="status-title">{rank}등</p>
      <p className="muted">
        {isLast ? '나를 제일 모르는 사람' : `${ranked.length}명 중 ${rank}등`}
      </p>
      <p className="points">{(me.score || 0).toLocaleString()}점</p>
    </div>
  )
}
