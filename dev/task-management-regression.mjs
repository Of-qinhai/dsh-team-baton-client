/** Real React/client layout against an isolated, in-memory API boundary. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const { chromium, expect } = createRequire(import.meta.url)('playwright/test')
const base = process.env.BATON_PREVIEW_URL ?? 'http://127.0.0.1:4371'
const harness = (await build({
  stdin: { resolveDir: fileURLToPath(new URL('.', import.meta.url)), contents: `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    const slots = new Map()
    window.__ModuleLoader__ = { load({factory}) {
      factory(name => { if(name === 'react') return React; throw new Error(name) }).apply({
        effect(fn) { fn() }, get() { return { openSession() {}, pickDirectory: async () => '/example/picked' } },
        slots: { inject(name,register) { register() }, register({name},component) { slots.set(name,component); return () => {} } }
      })
    } }
    await import('../client.js')
    createRoot(document.getElementById('root')).render(React.createElement('div',
      {style:{height:'100dvh',minHeight:0,display:'flex'}},React.createElement(slots.get('main'))))
  ` }, bundle: true, write: false, format: 'esm', target: 'es2022',
})).outputFiles[0].text
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE })
const failures = []

async function check(name, run, viewport = { width: 1280, height: 800 }) {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(3500)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.request.post(base + '/__preview', { data: { reset: true } })
  const initial = await (await page.request.get(base + '/__preview/state')).json()
  const state = structuredClone(initial)
  const calls = []
  const visibility = task => task.from.userId === state.userId ? task.fromVisibility ?? 'active' : task.toVisibility ?? 'active'
  await page.route('**/app.js', route => route.fulfill({ contentType: 'text/javascript', body: harness }))
  await page.route('**/api/baton', async route => {
    const body = route.request().postDataJSON()
    calls.push(body)
    const task = state.tasks.find(item => item.taskId === body.taskId)
    const reply = data => route.fulfill({ json: data })
    if (body.action === 'snapshot') return reply({ ...state, tasks: state.tasks.filter(item => visibility(item) !== 'deleted') })
    if (body.action === 'counts') return reply({ ok: true, attention: 0 })
    if (body.action === 'detail') return reply({ ok: true, task, brief: 'Isolated task brief', executionBrief: state.local[body.taskId]?.executionBrief ?? 'Isolated task brief', cwd: '/example/workspace/web', local: state.local[body.taskId] })
    if (body.action === 'accept') {
      task.status = 'accepted'
      const record = { taskId: task.taskId, phase: 'submitted', sessionId: 'edited-session', executionBrief: body.brief }
      state.local[task.taskId] = record
      return reply({ ok: true, record, sessionId: record.sessionId })
    }
    if (body.action === 'environments.list') return reply({ ok: true, environments: state.environments })
    if (body.action === 'environments.save') {
      state.environments = body.environments
      const metadata = body.environments.map(({ key, label }) => ({ key, label }))
      for (const room of state.rooms) for (const member of room.members) if (member.userId === state.userId) member.environments = metadata
      return reply({ ok: true, environments: state.environments, published: true })
    }
    if (['archive', 'restore', 'delete'].includes(body.action)) {
      if (body.action === 'delete') assert.equal(body.confirmed, true)
      const field = task.from.userId === state.userId ? 'fromVisibility' : 'toVisibility'
      task[field] = { archive: 'archived', restore: 'active', delete: 'deleted' }[body.action]
      return reply({ ok: true, taskId: task.taskId, purged: task.fromVisibility === 'deleted' && task.toVisibility === 'deleted' })
    }
    if (body.action === 'send') return reply({ ok: true, task: { ...body, status: 'pending' } })
    return reply({ ok: false, error: 'Unhandled fixture action: ' + body.action })
  })
  try {
    await page.goto(base)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: '发起接力', exact: true })).toBeVisible()
    await run({ page, state, calls, refresh: async () => { await page.getByRole('button', { name: '刷新接力', exact: true }).click() } })
    assert.deepEqual(errors, [])
    console.log('PASS: ' + name)
  } catch (error) { failures.push(name); console.error('FAIL: ' + name + '\n' + error.message) }
  finally { await page.close() }
}

try {
  await check('recipient edits survive task switching; validation and original comparison precede acceptance', async ({ page, state, calls }) => {
    const first = page.locator('.bt-task').filter({ hasText: '登录页接口联调' })
    await first.click()
    const editor = page.getByRole('textbox', { name: '启动任务说明', exact: true })
    await expect(editor).toHaveValue('Isolated task brief')
    await editor.fill('Recipient corrected goal\nOnly inspect the login flow.')
    await page.locator('.bt-task').filter({ hasText: '确认新版工作台' }).click()
    await expect(editor).toHaveValue('Isolated task brief')
    await first.click()
    await expect(editor).toHaveValue('Recipient corrected goal\nOnly inspect the login flow.')
    await page.getByRole('button', { name: '刷新接力', exact: true }).click()
    await expect(editor).toHaveValue('Recipient corrected goal\nOnly inspect the login flow.')
    await page.getByText('查看发送方原文', { exact: true }).click()
    await expect(page.locator('.bt-original-brief')).toContainText('Isolated task brief')
    await page.getByRole('button', { name: '恢复原文', exact: true }).click()
    await expect(editor).toHaveValue('Isolated task brief')
    await editor.fill('  \n ')
    await expect(page.getByRole('button', { name: '接受并启动', exact: true })).toBeDisabled()
    await editor.fill('汉'.repeat(2731))
    await expect(page.getByRole('button', { name: '接受并启动', exact: true })).toBeDisabled()
    await editor.fill('Final approved recipient text')
    await page.getByRole('button', { name: /^已发出的/ }).click()
    await page.locator('.bt-task').filter({ hasText: '完善自动化部署' }).click()
    await expect(editor).toHaveCount(0)
    await page.getByRole('button', { name: /^收件箱/ }).click()
    await first.click()
    await expect(editor).toHaveValue('Final approved recipient text')
    await page.getByRole('button', { name: '接受并启动', exact: true }).click()
    await expect(editor).toHaveCount(0)
    assert.equal(calls.filter(body => body.action === 'accept').length, 1)
    assert.equal(calls.find(body => body.action === 'accept').brief, 'Final approved recipient text')
    assert.equal(Object.values(state.local).find(record => record.sessionId === 'edited-session').executionBrief, 'Final approved recipient text')
  })

  await check('quiet session link and collapsible navigation', async ({ page }) => {
    const link = page.locator('.bt-task-link').first()
    assert.ok(await link.evaluate(node => parseFloat(getComputedStyle(node).fontSize)) <= 11)
    const toggle = page.getByRole('button', { name: '收起接力导航', exact: true })
    await toggle.click()
    await expect(page.locator('.bt-sidebar')).toHaveClass(/collapsed/)
    await expect(page.getByRole('button', { name: '展开接力导航', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '展开接力导航', exact: true }).click()
    await expect(page.locator('.bt-sidebar')).not.toHaveClass(/collapsed/)
  })

  await check('delete, restore and permanent delete preserve session state and peer task', async ({ page, state, calls }) => {
    const originalLocal = structuredClone(state.local)
    const row = page.locator('.bt-task').filter({ hasText: '核对支付回调' })
    await row.getByRole('button', { name: '删除任务', exact: true }).click()
    await page.getByRole('dialog', { name: '移入已删除？' }).getByRole('button', { name: '确认删除', exact: true }).click()
    await expect(row).toHaveCount(0)
    await page.getByRole('button', { name: /^已删除/ }).click()
    await expect(page.locator('.bt-task').filter({ hasText: '核对支付回调' })).toContainText('已删除')
    await page.getByRole('button', { name: '恢复任务', exact: true }).first().click()
    await page.getByRole('button', { name: /^收件箱/ }).click()
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: '删除任务', exact: true }).click()
    await page.getByRole('dialog', { name: '移入已删除？' }).getByRole('button', { name: '确认删除', exact: true }).click()
    await page.getByRole('button', { name: /^已删除/ }).click()
    await page.getByRole('button', { name: '永久删除任务', exact: true }).first().click()
    const dialog = page.getByRole('dialog', { name: '永久删除这条任务？' })
    await expect(dialog).toContainText('双方')
    await expect(dialog).toContainText('会话')
    await dialog.getByRole('button', { name: '确认永久删除', exact: true }).click()
    await expect(page.locator('.bt-task').filter({ hasText: '核对支付回调' })).toHaveCount(0)
    const stored = state.tasks.find(task => task.title.includes('核对支付回调'))
    assert.equal(stored.toVisibility, 'deleted')
    assert.notEqual(stored.fromVisibility, 'deleted')
    assert.deepEqual(state.local, originalLocal)
    assert.ok(!calls.some(body => /session.*delete|delete.*session/.test(body.action)))
  })

  for (const viewport of [{ width: 1280, height: 540 }, { width: 390, height: 700 }]) {
    await check(`both tabs scroll within viewport ${viewport.width}x${viewport.height}`, async ({ page, state, refresh }) => {
      const incoming = state.tasks.find(task => task.to.userId === state.userId)
      const outgoing = state.tasks.find(task => task.from.userId === state.userId)
      state.tasks = Array.from({ length: 160 }, (_, index) => ({ ...(index % 2 ? outgoing : incoming), taskId: `scroll-${index}`, title: `Scrollable task ${index}`, createdAt: Date.now() - index * 1000 }))
      await refresh()
      for (const name of [/^收件箱/, /^已发出的/]) {
        await page.getByRole('button', { name }).click()
        await expect(page.locator('.bt-task')).toHaveCount(80)
        const metrics = await page.locator('.bt-task-list').evaluate(node => {
          node.scrollTop = node.scrollHeight
          return { client: node.clientHeight, height: node.scrollHeight, top: node.scrollTop, pageHeight: document.scrollingElement.scrollHeight, viewport: innerHeight }
        })
        assert.ok(metrics.client > 100 && metrics.height > metrics.client && metrics.top > 0, JSON.stringify(metrics))
        assert.ok(metrics.pageHeight <= metrics.viewport + 1, JSON.stringify(metrics))
      }
    }, viewport)
  }

  await check('narrow embedded pane keeps header and tabs inside its own width', async ({ page }) => {
    await page.locator('.bt-panel-page').evaluate(node => { node.parentElement.style.maxWidth = '260px' })
    for (const selector of ['.bt-topbar', '.bt-page-title-row', '.bt-tabs']) {
      const size = await page.locator(selector).evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth }))
      assert.ok(size.scroll <= size.width + 1, selector + ': ' + JSON.stringify(size))
    }
    await expect(page.getByRole('button', { name: '配置执行环境', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^已删除/ })).toBeVisible()
  })

  await check('configure local directory and choose only recipient environments', async ({ page, calls }) => {
    await page.getByRole('button', { name: '配置执行环境', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '本机执行环境' })
    await dialog.locator('.bt-env-row').first().locator('input').nth(2).fill('/example/new-local-project')
    await dialog.getByRole('button', { name: '保存', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    assert.equal(calls.find(body => body.action === 'environments.save').environments[0].cwd, '/example/new-local-project')
    await page.getByRole('button', { name: '发起接力', exact: true }).click()
    const send = page.getByRole('dialog', { name: '发起一次接力' })
    await send.locator('select').nth(0).selectOption('GREEN8')
    await send.locator('select').nth(1).selectOption('22222222-2222-4222-8222-222222222222')
    await send.getByRole('combobox').last().click()
    await expect(send.getByRole('option', { name: /design/ })).toBeVisible()
    await expect(send.getByRole('option', { name: /backend/ })).toHaveCount(0)
    await expect(send).not.toContainText('/example/new-local-project')
  })
} finally { await browser.close() }
if (failures.length) throw new Error('Failed: ' + failures.join('; '))
