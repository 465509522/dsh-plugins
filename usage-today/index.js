/**
 * Host half of @local/usage-today.
 *
 * Folds every committed `assistant/message` usage report into per-local-day
 * buckets, prices them with a configurable table, and serves the result as
 * JSON on an exact Web route so the Client half can render it below the
 * composer. Nothing here touches the session log: the numbers are a derived
 * cache and every event is read-only.
 */
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export const name = 'usage-today'
export const inject = ['webServer']

/** Fixed route: the Client half hardcodes the same path. */
const ROUTE_PATH = '/local-usage-today/status'
/** Day buckets kept on disk. */
const KEEP_DAYS = 60
const DEFAULT_PRICE = { input: 2, cacheRead: 0.5, cacheWrite: 0, output: 8 }

function homeDirectory() {
  const home = process.env.DSH_HOME
  if (typeof home === 'string' && home.trim()) return home.trim()
  return path.join(os.homedir(), '.dsh')
}

function dataFile() {
  return path.join(homeDirectory(), 'plugin-data', 'usage-today.json')
}

function dayKeyOf(time) {
  const value = typeof time === 'number' && Number.isFinite(time) ? time : Date.now()
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function emptyDay() {
  return { requests: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0, models: {} }
}

function emptyModel() {
  return { requests: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 }
}

function positive(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function priceEntry(source, fallback) {
  const raw = source && typeof source === 'object' ? source : {}
  return {
    input: 'input' in raw ? positive(raw.input) : fallback.input,
    cacheRead: 'cacheRead' in raw ? positive(raw.cacheRead) : fallback.cacheRead,
    cacheWrite: 'cacheWrite' in raw ? positive(raw.cacheWrite) : fallback.cacheWrite,
    output: 'output' in raw ? positive(raw.output) : fallback.output,
  }
}

function normalizeConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const fallback = priceEntry(source.defaultPrice, DEFAULT_PRICE)
  /** @type {Record<string, ReturnType<typeof priceEntry>>} */
  const prices = {}
  const table = source.prices && typeof source.prices === 'object' ? source.prices : {}
  for (const key of Object.keys(table)) prices[key] = priceEntry(table[key], fallback)
  return {
    currency: typeof source.currency === 'string' && source.currency ? source.currency : '¥',
    prices,
    fallback,
    persist: source.persist !== false,
    /* Observed wire reports (openai-completions style) send `inputTokens` as
       the uncached prompt only and `cacheReadTokens` beside it, so the two are
       summed unless a provider reports an inclusive prompt. */
    inputIncludesCache: source.inputIncludesCache === true,
  }
}

/** Priced per one million tokens, off a whole day/model bucket. */
function costOf(bucket, price, inputIncludesCache) {
  const missInput = inputIncludesCache ? Math.max(0, bucket.input - bucket.cacheRead) : bucket.input
  const amount =
    (missInput * price.input +
      bucket.cacheRead * price.cacheRead +
      bucket.cacheWrite * price.cacheWrite +
      /* reasoning tokens are a subset of outputTokens on every provider we
         read, so they are shown but never priced twice */ bucket.output * price.output) /
    1e6
  return Math.round(amount * 1e6) / 1e6
}

function priceFor(cfg, provider, model) {
  if (model && model in cfg.prices) return cfg.prices[model]
  if (model && provider && `${provider}/${model}` in cfg.prices) return cfg.prices[`${provider}/${model}`]
  if (provider && provider in cfg.prices) return cfg.prices[provider]
  return cfg.fallback
}

export function apply(ctx, config) {
  const cfg = normalizeConfig(config)

  /** @type {{ days: Record<string, ReturnType<typeof emptyDay>>, updatedAt: number }} */
  const store = { days: {}, updatedAt: 0 }
  const seen = new Set()
  let saveTimer = null
  let closed = false
  let pollHits = 0

  const prune = () => {
    const today = dayKeyOf(Date.now())
    const keys = Object.keys(store.days)
      .filter((key) => key !== today)
      .sort()
    while (keys.length > KEEP_DAYS) {
      const drop = keys.shift()
      if (drop) delete store.days[drop]
    }
  }

  const ready = (async () => {
    if (!cfg.persist) return
    try {
      const text = await fsp.readFile(dataFile(), 'utf8')
      const parsed = JSON.parse(text)
      const days = parsed && typeof parsed === 'object' ? parsed.days : null
      if (days && typeof days === 'object') {
        for (const key of Object.keys(days)) {
          const raw = days[key]
          if (!raw || typeof raw !== 'object') continue
          const day = emptyDay()
          day.requests = positive(raw.requests)
          day.input = positive(raw.input)
          day.cacheRead = positive(raw.cacheRead)
          day.cacheWrite = positive(raw.cacheWrite)
          day.output = positive(raw.output)
          day.reasoning = positive(raw.reasoning)
          const models = raw.models && typeof raw.models === 'object' ? raw.models : {}
          for (const modelKey of Object.keys(models)) {
            const item = models[modelKey] || {}
            day.models[modelKey] = {
              requests: positive(item.requests),
              input: positive(item.input),
              cacheRead: positive(item.cacheRead),
              cacheWrite: positive(item.cacheWrite),
              output: positive(item.output),
              reasoning: positive(item.reasoning),
            }
          }
          store.days[key] = day
        }
        store.updatedAt = positive(parsed.updatedAt)
        prune()
      }
    } catch {
      /* first run, unreadable file, or corrupt JSON: start from zero */
    }
  })()

  const flush = () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (!cfg.persist || closed) return
    const payload = JSON.stringify({ version: 1, updatedAt: store.updatedAt, days: store.days })
    const target = dataFile()
    const temp = `${target}.tmp`
    void (async () => {
      try {
        await fsp.mkdir(path.dirname(target), { recursive: true })
        await fsp.writeFile(temp, payload, 'utf8')
        await fsp.rename(temp, target)
      } catch {
        /* persistence is best effort; the in-memory fold keeps working */
      }
    })()
  }

  const scheduleFlush = () => {
    if (!cfg.persist) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      flush()
    }, 1500)
    if (typeof saveTimer.unref === 'function') saveTimer.unref()
  }

  const record = (session, event) => {
    if (!event || event.type !== 'assistant/message') return
    const usage = event.data && event.data.usage
    if (!usage || typeof usage !== 'object') return
    const input = positive(usage.inputTokens)
    const output = positive(usage.outputTokens)
    const cacheRead = positive(usage.cacheReadTokens)
    const cacheWrite = positive(usage.cacheWriteTokens)
    const reasoning = positive(usage.reasoningTokens)
    if (input === 0 && output === 0 && cacheRead === 0 && cacheWrite === 0) return

    const sessionId = session && session.id ? String(session.id) : 'unknown'
    const marker = `${sessionId}:${String(event.seq)}:${String(event.time)}`
    if (seen.has(marker)) return
    if (seen.size > 20000) seen.clear()
    seen.add(marker)

    const source = (event.data.message && event.data.message.source) || {}
    const provider = typeof source.provider === 'string' ? source.provider : ''
    const model = typeof source.model === 'string' ? source.model : ''
    const modelKey = model || provider || 'unknown'

    const dayKey = dayKeyOf(event.time)
    const day = (store.days[dayKey] = store.days[dayKey] || emptyDay())
    day.requests += 1
    day.input += input
    day.cacheRead += cacheRead
    day.cacheWrite += cacheWrite
    day.output += output
    day.reasoning += reasoning
    const modelBucket = (day.models[modelKey] = day.models[modelKey] || emptyModel())
    modelBucket.requests += 1
    modelBucket.input += input
    modelBucket.cacheRead += cacheRead
    modelBucket.cacheWrite += cacheWrite
    modelBucket.output += output
    modelBucket.reasoning += reasoning
    store.updatedAt = Date.now()
    scheduleFlush()
  }

  ctx.effect(() => {
    const onEvent = (session, event) => {
      try {
        record(session, event)
      } catch {
        /* one malformed event must never break the append feed */
      }
    }
    let dispose = null
    try {
      /* `session/event` is scope-filtered: a root listener needs `global` to
         observe sessions that were entered through another agent context. */
      dispose = ctx.on('session/event', onEvent, { global: true })
    } catch {
      dispose = null
    }
    if (typeof dispose !== 'function') {
      try {
        dispose = ctx.on('session/event', onEvent)
      } catch {
        dispose = null
      }
    }
    return () => {
      closed = true
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      if (typeof dispose === 'function') {
        try {
          dispose()
        } catch {
          /* already disposed */
        }
      }
      flush()
    }
  })

  const snapshot = () => {
    const todayKey = dayKeyOf(Date.now())
    const day = store.days[todayKey] || emptyDay()
    const models = Object.keys(day.models)
      .map((modelKey) => {
        const bucket = day.models[modelKey]
        const price = priceFor(cfg, modelKey.split('/')[0], modelKey)
        return {
          model: modelKey,
          requests: bucket.requests,
          input: bucket.input,
          cacheRead: bucket.cacheRead,
          cacheWrite: bucket.cacheWrite,
          output: bucket.output,
          reasoning: bucket.reasoning,
          cost: costOf(bucket, price, cfg.inputIncludesCache),
        }
      })
      .sort((a, b) => b.cost - a.cost)
    return {
      ok: true,
      day: todayKey,
      currency: cfg.currency,
      updatedAt: store.updatedAt || null,
      pollHits,
      totals: {
        requests: day.requests,
        input: day.input,
        cacheRead: day.cacheRead,
        cacheWrite: day.cacheWrite,
        output: day.output,
        reasoning: day.reasoning,
        cost: models.reduce((sum, item) => sum + item.cost, 0),
      },
      models,
    }
  }

  const respond = (res, status, body) => {
    const text = JSON.stringify(body)
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(text),
    })
    res.end(text)
  }

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PATH,
      handler: async (request, response) => {
        const method = (request && request.method) || 'GET'
        if (method !== 'GET' && method !== 'HEAD') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        /* Read-only data, but still refuse a foreign http(s) Origin so another
           page cannot read the numbers out of this loopback listener. */
        const headers = (request && request.headers) || {}
        const origin = headers.origin
        if (typeof origin === 'string' && origin && origin !== 'null') {
          const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(String(headers.host || ''))
          let allowed = true
          if (/^https?:/i.test(origin)) {
            try {
              allowed = new URL(origin).host === String(headers.host || '')
            } catch {
              allowed = false
            }
          } else if (/^app:/i.test(origin)) {
            /* Electron shell presented as an app:// document */
            allowed = local
          }
          if (!allowed) {
            response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
            response.end('cross-origin request rejected')
            return
          }
        }
        try {
          await ready
        } catch {
          /* fall through with whatever the in-memory fold holds */
        }
        pollHits += 1
        try {
          respond(response, 200, snapshot())
        } catch (error) {
          respond(response, 500, { ok: false, error: String((error && error.message) || error) })
        }
      },
    }),
  )

}
