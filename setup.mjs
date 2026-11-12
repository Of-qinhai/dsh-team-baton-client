#!/usr/bin/env node
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'

const base = process.env.BATON_HOME || join(homedir(), '.dsh', 'baton')
const secretFile = process.env.BATON_SECRET_FILE || join(homedir(), '.config', 'baton', 'secret')
const settingsFile = join(base, 'settings.json')
const piped = !process.stdin.isTTY
let pipedLines = []
if (piped) {
  process.stdin.setEncoding('utf8')
  let pipedText = ''
  for await (const chunk of process.stdin) pipedText += chunk
  pipedLines = pipedText.split(/\r?\n/)
}
let pipedIndex = 0

function fail(message) {
  console.error(`错误：${message}`)
  process.exit(1)
}

function trim(value) {
  return value.trim()
}

function charLength(value) {
  return Array.from(value).length
}

async function existingServer() {
  try {
    const parsed = JSON.parse(await readFile(settingsFile, 'utf8'))
    return typeof parsed?.serverUrl === 'string' ? parsed.serverUrl : ''
  } catch {
    return ''
  }
}

async function existingSecret() {
  try {
    return (await readFile(secretFile, 'utf8')).length > 0
  } catch {
    return false
  }
}

async function ask(rl, prompt, mask = false) {
  if (piped) {
    process.stdout.write(prompt)
    const value = pipedLines[pipedIndex++] ?? ''
    process.stdout.write(mask ? '*' : value)
    process.stdout.write('\n')
    return value
  }
  return rl.question(prompt)
}

async function hiddenQuestion(rl, prompt) {
  if (piped) return ask(rl, prompt, true)
  rl.close()
  process.stdout.write(prompt)
  return await new Promise((resolve) => {
    const stdin = process.stdin
    let value = ''
    let escaping = false
    const cleanup = () => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.removeListener('data', onData)
    }
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\u0003') {
          cleanup()
          process.stdout.write('\n')
          process.exit(130)
        }
        if (escaping) {
          if (char === '~' || /[A-Za-z]/.test(char)) escaping = false
          continue
        }
        if (char === '\u001b') {
          escaping = true
          continue
        }
        if (char === '\r' || char === '\n') {
          cleanup()
          process.stdout.write('\n')
          resolve(value)
          return
        }
        if (char === '\u007f' || char === '\b') {
          if (value) {
            value = Array.from(value).slice(0, -1).join('')
            process.stdout.write('\b \b')
          }
          continue
        }
        value += char
        process.stdout.write('*')
      }
    }
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.resume()
    stdin.on('data', onData)
  })
}

async function main() {
  console.log('Baton 本机配置')
  console.log(`配置文件：${settingsFile}`)
  console.log(`密钥文件：${secretFile}`)
  console.log('')

  const serverDefault = await existingServer()
  const hasSecret = await existingSecret()
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  let displayName
  try {
    displayName = trim(await ask(rl, '显示名称（1-40 个字符）：'))
    if (!displayName) fail('显示名称不能为空')
    if (charLength(displayName) > 40) fail('显示名称不能超过 40 个字符')

    const serverPrompt = serverDefault
      ? `服务地址（留空保留 ${serverDefault}）：`
      : '服务地址（wss://...，可留空稍后在 profile patch 配置）：'
    let serverUrl = trim(await ask(rl, serverPrompt))
    if (!serverUrl) serverUrl = serverDefault
    if (serverUrl && !/^wss:\/\//.test(serverUrl) && !/^ws:\/\/(127\.0\.0\.1|localhost):/.test(serverUrl)) {
      fail('服务地址必须是 wss://，本机调试可用 ws://127.0.0.1:端口或 ws://localhost:端口')
    }

    const secretPrompt = hasSecret ? '团队密钥（留空保留现有密钥）：' : '团队密钥（输入不回显，至少 32 字符）：'
    const secret = await hiddenQuestion(rl, secretPrompt)

    if (!secret && !hasSecret) fail('密钥不能为空')
    if (secret && charLength(secret) < 32) fail('密钥至少 32 个字符')

    if (secret) {
      await mkdir(dirname(secretFile), { recursive: true })
      await writeFile(secretFile, `${secret}\n`, { mode: 0o600 })
    }
    try { await chmod(secretFile, 0o600) } catch {}

    await mkdir(base, { recursive: true })
    const settings = { displayName }
    if (serverUrl) settings.serverUrl = serverUrl
    await writeFile(settingsFile, `${JSON.stringify(settings)}\n`, { mode: 0o600 })
    try { await chmod(base, 0o700) } catch {}
    try { await chmod(settingsFile, 0o600) } catch {}

    console.log('')
    console.log(`已保存：${settingsFile}`)
    console.log(`密钥已保存：${secretFile}`)
    if (!serverUrl) console.log('注意：没有服务地址，插件暂不会连接；请重新运行并填写，或在 profile patch 里配置。')
    console.log('重启 DSH 或重新加载 Baton 插件后生效。')
  } finally {
    rl.close()
  }
}

await main()
