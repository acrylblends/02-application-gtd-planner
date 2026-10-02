// acryl-gtd board (browser half)
// Type:     desktop.main registration, through acryl-app-shell
// Surfaces: web desktop (no main-surface slot exists on tui - this file is simply not loaded there)
// Teaches:  a domain plugin's own main UI is always a slot registration, never a Host route. Two earlier
//           versions of this file got that wrong in two different ways, both found live and both rejected by
//           the owner directly: first a `tool.call.toolview` chat card linking out, then a Host-served HTML
//           page at `/` reached by a browser navigation ("we have routers for custom apps - that's bullshit...
//           why we need routes?"). The board is now a real React tree, claiming `desktop.main` the same way
//           `plugins/acryl-workspace` claims it for the IDE (`acryl-app-shell`, extracted from that package
//           for exactly this reuse) - rendered inline in the app's own window, no new tab, no URL to open.
//           It still talks to the Host over the same three JSON routes `index.js` always served
//           (/api/acryl-gtd/state, /capture, /triage) - a real UI still needs a real way to read and write
//           server-side state; only the presentation changed.
window.__ModuleLoader__.load({ id: 'acryl-gtd', factory: (require) => {
var module = { exports: {} }; var exports = module.exports;

const React = require('react')
const { useCallback, useEffect, useMemo, useState } = React
const h = React.createElement
const { Button, Input, Tag } = require('@deepseek-ai/dsh-client-ui-primitives')
const { applyAdvancedShell, resolveShellEnvironment } = require('acryl-app-shell/client')

// Bumped by hand on every edit to this file. This extension is a buildless, hand-written client bundle
// installed into a per-profile copy (.dsh/profiles/<surface>/node_modules/acryl-gtd) that a plain app restart
// does NOT refresh from source for a PROJECT-scoped extension (acryl-extension-context's own security
// boundary: a changed project source is only ever reported, never auto-applied, so a git pull cannot silently
// run new code) - only a full `rm -rf .dsh` or an explicit `/reload` picks up an edit. Rendered in the board's
// own header and logged on boot so a stale install is visible at a glance, in the browser, not just grep'd
// from a shell - this is the engineer's sanity check that was missing before.
const BUILD_STAMP = '2026-10-02T16:50Z-drag-drop-workspace-autocreate'

const BUCKETS = ['inbox', 'next', 'waiting', 'someday', 'reference']
const LABEL = { inbox: 'Inbox', next: 'Next Actions', waiting: 'Waiting For', someday: 'Someday/Maybe', reference: 'Reference' }
const DOT = { inbox: '#f59f00', next: '#4dabf7', waiting: '#ff6b6b', someday: '#868e96', reference: '#51cf66' }
const TABS = [['list', 'List'], ['board', 'Board'], ['calendar', 'Calendar'], ['projects', 'Projects']]

function readJson(response) {
  if (response.ok) return response.json()
  return response.json().catch(() => ({})).then((body) => { throw new Error(body.error || ('HTTP ' + String(response.status))) })
}
function apiGet(path) { return fetch(path).then(readJson) }
function apiPost(path, body) {
  return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(readJson)
}

/** Owns the board's data and the two mutations every view shares; the Host is the source of truth. */
function useGtdState() {
  const [state, setState] = useState({ items: [] })
  const [error, setError] = useState(undefined)
  const reload = useCallback(() => {
    apiGet('/api/acryl-gtd/state').then((next) => { setState(next); setError(undefined) }).catch((cause) => { setError(cause.message) })
  }, [])
  useEffect(() => { reload() }, [reload])
  const capture = useCallback((title) => {
    apiPost('/api/acryl-gtd/capture', { title }).then(setState).catch((cause) => { setError(cause.message) })
  }, [])
  const triage = useCallback((id, status) => {
    apiPost('/api/acryl-gtd/triage', { id, status }).then(setState).catch((cause) => { setError(cause.message) })
  }, [])
  return { state, error, capture, triage }
}

function itemLabel(item) {
  const bits = [item.title]
  if (item.project) bits.push('[' + item.project + ']')
  if (item.due) bits.push('due ' + item.due)
  return bits.join('   ')
}

function MoveButtons({ item, onTriage }) {
  const targets = BUCKETS.filter((status) => status !== item.status)
  return h('div', { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
    targets.map((status) => h(Button, { key: status, variant: 'outline', size: 'sm', onClick: () => { onTriage(item.id, status) } }, LABEL[status])),
    h(Button, { key: 'done', variant: 'outline', size: 'sm', onClick: () => { onTriage(item.id, 'done') } }, 'Done'))
}

function CaptureRow({ onCapture }) {
  const [value, setValue] = useState('')
  const submit = () => { if (value.trim() !== '') { onCapture(value.trim()); setValue('') } }
  return h('div', { style: { margin: '10px 0 16px' } },
    h(Input, {
      placeholder: 'Capture something - press Enter',
      value,
      onChange: (event) => { setValue(event.target.value) },
      onKeyDown: (event) => { if (event.key === 'Enter') submit() },
    }))
}

function BucketPicker({ state, bucket, onPick }) {
  return h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 } },
    BUCKETS.map((status) => {
      const count = state.items.filter((item) => item.status === status).length
      const on = bucket === status
      return h('button', {
        key: status,
        type: 'button',
        onClick: () => { onPick(status) },
        style: {
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRadius: 8, padding: '6px 12px',
          border: on ? '1px solid #1971c2' : '1px solid var(--dsw-alias-border-l1)',
          background: on ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
          color: 'inherit', font: 'inherit',
        },
      },
        h('span', { style: { width: 8, height: 8, borderRadius: 999, background: DOT[status] } }),
        LABEL[status],
        h('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11 } }, String(count)))
    }))
}

function ListView({ state, onTriage }) {
  const [bucket, setBucket] = useState('next')
  const [tag, setTag] = useState('')
  const allTags = useMemo(() => Array.from(new Set(state.items.flatMap((item) => item.tags))).sort(), [state.items])
  const items = state.items.filter((item) => item.status === bucket && (tag === '' || item.tags.includes(tag)))
  return h('div', null,
    h(BucketPicker, { state, bucket, onPick: setBucket }),
    allTags.length > 0 && h('div', { style: { marginBottom: 10, display: 'flex', gap: 4, flexWrap: 'wrap' } },
      allTags.map((t) => h('span', {
        key: t,
        onClick: () => { setTag(tag === t ? '' : t) },
        style: { cursor: 'pointer', opacity: tag === '' || tag === t ? 1 : 0.5 },
      }, h(Tag, null, '@' + t)))),
    items.length === 0
      ? h('div', { style: { color: 'var(--dsw-alias-label-secondary)', padding: '10px 4px' } }, '(nothing here)')
      : items.map((item) => h('div', {
        key: item.id,
        style: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: '1px solid var(--dsw-alias-border-l2)' },
      },
        h('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11, width: 28, flex: 'none' } }, '#' + String(item.id)),
        h('span', { style: { flex: 1 } }, itemLabel(item)),
        h(MoveButtons, { item, onTriage }))))
}

/** HTML5 drag-and-drop between board columns; `onTriage` (the existing capture/triage API) is the only write
 * path either way, so a drag and a MoveButtons click always leave the board in the same state. */
function BoardView({ state, onTriage }) {
  const [draggingId, setDraggingId] = useState(undefined)
  const [overStatus, setOverStatus] = useState(undefined)
  return h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10 } },
    BUCKETS.map((status) => {
      const items = state.items.filter((item) => item.status === status)
      return h('div', {
        key: status,
        style: {
          border: overStatus === status ? '1.5px solid #1971c2' : '1px solid var(--dsw-alias-border-l1)',
          borderRadius: 8, minHeight: 60,
          background: overStatus === status ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
        },
        onDragOver: (event) => { event.preventDefault(); setOverStatus(status) },
        onDragLeave: () => { setOverStatus((current) => current === status ? undefined : current) },
        onDrop: (event) => {
          event.preventDefault()
          setOverStatus(undefined)
          const id = Number(event.dataTransfer.getData('text/plain')) || draggingId
          if (id !== undefined) onTriage(id, status)
          setDraggingId(undefined)
        },
      },
        h('h3', {
          style: { fontSize: 12, margin: 0, padding: '7px 8px', borderBottom: '1px solid var(--dsw-alias-border-l1)', display: 'flex', gap: 6, alignItems: 'center' },
        },
          h('span', { style: { width: 8, height: 8, borderRadius: 999, background: DOT[status] } }),
          LABEL[status],
          h('span', { style: { marginLeft: 'auto', color: 'var(--dsw-alias-label-secondary)' } }, String(items.length))),
        h('div', { style: { padding: 6, display: 'flex', flexDirection: 'column', gap: 6 } },
          items.map((item) => h('div', {
            key: item.id,
            draggable: true,
            onDragStart: (event) => {
              event.dataTransfer.setData('text/plain', String(item.id))
              event.dataTransfer.effectAllowed = 'move'
              setDraggingId(item.id)
            },
            onDragEnd: () => { setDraggingId(undefined); setOverStatus(undefined) },
            style: {
              border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '6px 8px',
              cursor: 'grab', opacity: draggingId === item.id ? 0.4 : 1,
            },
          },
            item.project && h('div', { style: { fontSize: 10, color: 'var(--dsw-alias-label-secondary)', marginBottom: 4 } }, item.project),
            h('div', null, item.title),
            h('div', { style: { marginTop: 6 } }, h(MoveButtons, { item, onTriage }))))))
    }))
}

function isoDay(date) { return date.toISOString().slice(0, 10) }
function addDays(day, n) { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return isoDay(d) }
function startOfWeek(day) { const d = new Date(day + 'T00:00:00Z'); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return isoDay(d) }
function startOfMonth(day) { return day.slice(0, 7) + '-01' }
const today = isoDay(new Date())

function CalendarView({ state }) {
  const [mode, setMode] = useState('week')
  const [anchor, setAnchor] = useState(today)
  const [selected, setSelected] = useState(today)
  const byDay = useMemo(() => {
    const grouped = {}
    for (const item of state.items) {
      if (item.due && item.status !== 'done' && item.status !== 'trash') (grouped[item.due] ??= []).push(item)
    }
    return grouped
  }, [state.items])
  const days = useMemo(() => {
    if (mode === 'day') return [anchor]
    if (mode === 'week') { const start = startOfWeek(anchor); return [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(start, n)) }
    const first = startOfWeek(startOfMonth(anchor))
    return Array.from({ length: 42 }, (_, n) => addDays(first, n))
  }, [mode, anchor])
  const nav = (n) => { setAnchor(mode === 'month' ? addDays(startOfMonth(anchor), n * 31) : addDays(anchor, n * (mode === 'day' ? 1 : 7))) }
  const due = byDay[selected] ?? []
  return h('div', null,
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
      ['day', 'week', 'month'].map((m) => h(Button, { key: m, variant: mode === m ? 'primary' : 'outline', size: 'sm', onClick: () => { setMode(m) } }, m[0].toUpperCase() + m.slice(1))),
      h('span', { style: { marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' } },
        h(Button, { variant: 'outline', size: 'sm', onClick: () => { nav(-1) } }, '<'),
        h('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11 } }, anchor),
        h(Button, { variant: 'outline', size: 'sm', onClick: () => { nav(1) } }, '>'))),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 4 } },
      days.map((day) => {
        const count = (byDay[day] ?? []).length
        return h('div', {
          key: day,
          onClick: () => { setSelected(day) },
          style: {
            aspectRatio: '1', borderRadius: 6, padding: 4, fontSize: 11, fontFamily: 'monospace', position: 'relative', cursor: 'pointer',
            border: day === selected ? '1.5px solid #1971c2' : '1px solid var(--dsw-alias-border-l1)',
            background: day === today ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
          },
        },
          day.slice(8, 10),
          count > 0 && h('span', {
            style: {
              position: 'absolute', bottom: 3, right: 3, width: 15, height: 15, borderRadius: 999, background: '#1971c2',
              color: '#fff', fontSize: 8, fontWeight: 700, lineHeight: '15px', textAlign: 'center',
            },
          }, String(count)))
      })),
    h('div', { style: { marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--dsw-alias-border-l1)' } },
      h('div', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11, marginBottom: 4 } }, 'Due ' + selected),
      due.length === 0
        ? h('div', { style: { color: 'var(--dsw-alias-label-secondary)' } }, '(nothing due)')
        : due.map((item) => h('div', { key: item.id, style: { padding: '3px 0' } }, itemLabel(item)))))
}

function ProjectsView({ state }) {
  const byProject = useMemo(() => {
    const grouped = {}
    for (const item of state.items) { if (item.project) (grouped[item.project] ??= []).push(item) }
    return grouped
  }, [state.items])
  const names = Object.keys(byProject).sort()
  if (names.length === 0) return h('div', { style: { color: 'var(--dsw-alias-label-secondary)', padding: '10px 4px' } }, '(no items have a project yet)')
  return h('div', null, names.map((name) => {
    const items = byProject[name]
    const done = items.filter((item) => item.status === 'done').length
    const pct = Math.round((done / items.length) * 100)
    return h('div', { key: name, style: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 } },
      h('b', null, name), ' ',
      h('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11 } }, String(items.length - done) + ' open, ' + String(done) + ' done'),
      h('div', { style: { height: 4, borderRadius: 999, background: 'var(--dsw-alias-border-l2)', margin: '6px 0', overflow: 'hidden' } },
        h('div', { style: { height: '100%', width: pct + '%', background: '#51cf66' } })),
      items.map((item) => h('div', {
        key: item.id,
        style: { fontSize: 11, textDecoration: item.status === 'done' ? 'line-through' : 'none', color: item.status === 'done' ? 'var(--dsw-alias-label-secondary)' : 'inherit' },
      }, itemLabel(item))))
  }))
}

const VIEWS = { list: ListView, board: BoardView, calendar: CalendarView, projects: ProjectsView }

/** Registers the app's own folder as a real DSH Workspace, once, the first time it is known. Without this,
 * "Ask the agent" has no workspace to select and gets stuck on a permanent "Choose a workspace to start"
 * picker with nothing in it to pick (measured live) - a DSH chat cannot open at all until some Workspace
 * exists, and a GTD app has no "open folder" UI of its own to create one by hand. */
function useAutoWorkspace(getWorkspaces, cwd) {
  const created = React.useRef(false)
  useEffect(() => {
    if (created.current || cwd === undefined) return
    const workspaces = getWorkspaces()
    if (workspaces === undefined) return // not yet provided; the next render (state/cwd unchanged) retries
    created.current = true
    workspaces.create({ path: cwd }).catch(() => { created.current = false })
  })
}

/** The board: this plugin's entire `desktop.main`. `renderConversation` stays reachable through a small
 * toggle rather than a full tab-strip rebuild - this is a todo app, not a second IDE. */
function GtdMain({ renderConversation, getWorkspaces }) {
  const { state, error, capture, triage } = useGtdState()
  const [tab, setTab] = useState('list')
  const [showChat, setShowChat] = useState(false)
  useAutoWorkspace(getWorkspaces, state.cwd)
  if (showChat) {
    return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      h('div', { style: { padding: '8px 12px', borderBottom: '1px solid var(--dsw-alias-border-l1)' } },
        h(Button, { variant: 'ghost', size: 'sm', onClick: () => { setShowChat(false) } }, '< Back to the board')),
      h('div', { style: { flex: 1, minHeight: 0 } }, renderConversation()))
  }
  const View = VIEWS[tab]
  return h('div', { style: { height: '100%', overflowY: 'auto', padding: '14px 16px 40px' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 } },
      h('h1', { style: { fontSize: 15, margin: 0, fontWeight: 700 } }, 'GTD'),
      h('span', { title: 'client.js build stamp - if this looks old, the installed copy is stale: rm -rf .dsh and restart', style: { fontSize: 9, color: 'var(--dsw-alias-label-secondary)', opacity: 0.5, fontFamily: 'monospace' } }, BUILD_STAMP),
      h('span', { style: { marginLeft: 'auto', color: 'var(--dsw-alias-label-secondary)', fontSize: 12 } }, state.items.length + ' item(s)'),
      h(Button, { variant: 'ghost', size: 'sm', onClick: () => { setShowChat(true) } }, 'Ask the agent')),
    h('div', { style: { display: 'flex', gap: 6, marginBottom: 12 } },
      TABS.map(([id, label]) => h(Button, { key: id, variant: tab === id ? 'primary' : 'outline', size: 'sm', onClick: () => { setTab(id) } }, label))),
    error !== undefined && h('div', { style: { color: '#ff6b6b', padding: 10, marginBottom: 10 } }, 'GTD board: ' + error),
    h(CaptureRow, { onCapture: capture }),
    h(View, { state, onTriage: triage }))
}

exports.inject = ['slots', 'theme']

exports.apply = function apply(ctx) {
  console.log('[acryl-gtd] client.js build:', BUILD_STAMP)
  const environment = resolveShellEnvironment(window.location.hash)
  if (environment.mode !== 'advanced') return // compatibility mode keeps the stock upstream frame
  applyAdvancedShell(ctx, environment)
  ctx.slots.inject('desktop.main', () => ctx.slots.register({
    name: 'desktop.main',
    priority: -1, // lower wins for a `single` slot; beats acryl-app-shell's own fallback (100)
    inject: () => ({ getWorkspaces: () => ctx.get('workspaces') }),
  }, GtdMain))
}

return module.exports; } });
