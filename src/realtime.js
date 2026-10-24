// 실시간 저장소. Firebase 설정(.env)이 있으면 Firebase Realtime Database를 쓰고,
// 없으면 같은 브라우저의 탭끼리만 통하는 로컬 테스트 모드로 동작한다.
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, onValue, set, update, serverTimestamp } from 'firebase/database'

const env = import.meta.env
export const isMock = !env.VITE_FIREBASE_DATABASE_URL

let db
if (!isMock) {
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  })
  db = getDatabase(app)
}

// ---- 로컬 테스트 모드 ----
const KEY = 'nahoot-mock'
const listeners = new Set()
const channel = isMock ? new BroadcastChannel(KEY) : null
const notify = () => listeners.forEach((l) => l())
if (channel) channel.onmessage = notify

const keysOf = (path) => path.split('/').filter(Boolean)
const readTree = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}
const getAt = (tree, path) => keysOf(path).reduce((n, k) => (n == null ? undefined : n[k]), tree)
const setAt = (tree, path, value) => {
  const keys = keysOf(path)
  let node = tree
  for (const k of keys.slice(0, -1)) {
    if (typeof node[k] !== 'object' || node[k] === null) node[k] = {}
    node = node[k]
  }
  if (value === null || value === undefined) delete node[keys.at(-1)]
  else node[keys.at(-1)] = value
}
const commit = (fn) => {
  const tree = readTree()
  fn(tree)
  localStorage.setItem(KEY, JSON.stringify(tree))
  notify()
  channel.postMessage('changed')
}

// ---- 공통 API ----
export function listen(path, cb) {
  if (!isMock) return onValue(ref(db, path), (snap) => cb(snap.val()))
  const l = () => cb(getAt(readTree(), path) ?? null)
  listeners.add(l)
  queueMicrotask(l)
  return () => listeners.delete(l)
}

export function write(path, value) {
  if (!isMock) return set(ref(db, path), value)
  commit((tree) => setAt(tree, path, value))
}

// updates 의 키는 path 기준 상대 경로 (예: 'players/abc/score')
export function patch(path, updates) {
  if (!isMock) return update(ref(db, path), updates)
  commit((tree) => {
    for (const [k, v] of Object.entries(updates)) setAt(tree, `${path}/${k}`, v)
  })
}

// 서버 기준 시각. 점수 계산에 쓰여서 기기마다 시계가 달라도 공정하다.
export const stamp = () => (isMock ? Date.now() : serverTimestamp())

// localStorage 가 막혀 있어도 앱은 동작해야 한다.
// 참가자 ID 는 로컬 테스트 모드에서 탭마다 달라야 하므로 sessionStorage 에 둔다.
const area = (perTab) => (perTab && isMock ? sessionStorage : localStorage)
export const storage = {
  get(key, perTab = false) {
    try {
      return area(perTab).getItem(key)
    } catch {
      return null
    }
  },
  set(key, value, perTab = false) {
    try {
      area(perTab).setItem(key, value)
    } catch {
      /* 무시 */
    }
  },
}
