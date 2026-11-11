import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

const slots = new Map()
const cleanups = []
const services = new Map([['uiWorkspace', {
  openSession(sessionId) {
    window.dispatchEvent(new CustomEvent('baton-preview:navigate', { detail: sessionId }))
  },
}]])
window.__ModuleLoader__ = {
  load({ factory }) {
    factory(name => {
      if (name === 'react') return React
      throw new Error('Unknown preview module: ' + name)
    }).apply({
      get(name) { return services.get(name) },
      effect(fn) { const cleanup = fn(); if (cleanup) cleanups.push(cleanup) },
      slots: {
        inject(_name, register) { register() },
        register({ name }, component) { slots.set(name, component); return () => {} },
      },
    })
  },
}

await import('../client.js')
const SidebarIcon = slots.get('sidebar.panellist')
const MainPanel = slots.get('main')

function App() {
  const [sessionId, setSessionId] = useState(null)
  useEffect(() => {
    const navigate = event => setSessionId(event.detail)
    window.addEventListener('baton-preview:navigate', navigate)
    return () => window.removeEventListener('baton-preview:navigate', navigate)
  }, [])
  return <>
    <div className="preview-bar"><span>DSH <small>WORKBENCH</small></span><span>交互预览 · 示例数据 <button onClick={() => document.documentElement.classList.toggle('dark')}>切换明暗</button></span></div>
    <div className="preview-workbench">
      <aside><strong>工作区</strong><p>产品研发</p><p>接口联调</p><p>交互体验优化</p><button className="bt-trigger" aria-label="打开接力" onClick={() => setSessionId(null)}><SidebarIcon active={!sessionId} /> 接力</button></aside>
      <section style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0, height: '100%' }}>
        {sessionId ? <div role="status" style={{ padding: 24 }}>已打开示例会话：{sessionId}</div> : <MainPanel />}
      </section>
    </div>
  </>
}

createRoot(document.getElementById('root')).render(<App />)
window.addEventListener('beforeunload', () => cleanups.forEach(cleanup => cleanup()))
