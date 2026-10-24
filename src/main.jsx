import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Host from './Host.jsx'
import Player from './Player.jsx'

// /host 는 발표 화면, 그 외 경로는 청중 폰 화면
const isHost = window.location.pathname.startsWith('/host')

createRoot(document.getElementById('root')).render(
  <StrictMode>{isHost ? <Host /> : <Player />}</StrictMode>,
)
