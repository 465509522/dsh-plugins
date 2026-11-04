/**
 * Host half of @local/skill-explorer.
 *
 * Serves the live skill catalog to the left-sidebar panel over two read-only
 * Web routes. The catalog is a merged read model built from three layers the
 * harness already owns, in this order:
 *
 *   1. the global registry layer (`ctx.skills`) — host-plane skills such as
 *      the bundled Office set;
 *   2. the default agent preset's scope, which is where the filesystem
 *      provider's user and project roots register;
 *   3. one live session's catalog (`ctx.sessionSkillCatalog`), used only to
 *      fill gaps so a skill visible to a conversation is never missing.
 *
 * Nothing here writes to the registry or to disk: bodies come from the
 * allow-listed instruction file of a listed skill.
 */
import { promises as fsp } from 'node:fs'

export const name = 'skill-explorer'
export const inject = ['skills', 'webServer']

const LIST_PATH = '/skill-explorer/list'
const BODY_PATH = '/skill-explorer/body'
const MAX_BODY_BYTES = 512 * 1024
const MAX_SESSION_READS = 8

function text(value) {
  return typeof value === 'string' ? value : ''
}

function resolveCwd(ctx) {
  try {
    const workingDirectory = ctx.get('workingDirectory')
    if (workingDirectory && typeof workingDirectory.defaultDirectory === 'string') {
      if (workingDirectory.defaultDirectory) return workingDirectory.defaultDirectory
    }
  } catch {
    /* service missing or unavailable */
  }
  return process.cwd()
}

function entryOf(skill, fallbackSource) {
  const invocation = skill.invocation || {}
  return {
    name: text(skill.name),
    description: text(skill.description),
    whenToUse: text(skill.whenToUse) || null,
    source: text(skill.source) || fallbackSource,
    provider: text(skill.provider),
    path: text(skill.path) || null,
    modelInvocable: invocation.modelInvocable !== false,
    userInvocable: invocation.userInvocable !== false,
  }
}

/** Merge `next` over `previous`, keeping whichever field each layer knows. */
function merge(previous, next) {
  if (!previous) return next
  return {
    name: next.name || previous.name,
    description: next.description || previous.description,
    whenToUse: next.whenToUse || previous.whenToUse,
    source: next.source && next.source !== 'session' ? next.source : previous.source,
    provider: next.provider || previous.provider,
    path: next.path || previous.path,
    modelInvocable: next.modelInvocable,
    userInvocable: next.userInvocable || previous.userInvocable,
  }
}

export function apply(ctx, config) {
  const options = config && typeof config === 'object' ? config : {}
  let revision = 0
  /** name -> instruction-file path of the most recent listing. */
  const allowList = new Map()
  let presetScope = null
  let presetHandle = null

  ctx.effect(() => {
    try {
      return ctx.on('skills/change', () => {
        revision += 1
      })
    } catch {
      return () => {}
    }
  }, 'skill-explorer: catalog revision')

  /** The default preset's scope is where filesystem skills register. */
  const ensurePresetScope = async () => {
    if (presetScope) return presetScope
    const presets = ctx.get('agentPresets')
    if (!presets || typeof presets.acquireScope !== 'function') return null
    try {
      const handle = await presets.acquireScope()
      if (!handle || !handle.key) return null
      presetHandle = handle
      presetScope = handle.key
      return presetScope
    } catch {
      return null
    }
  }

  ctx.effect(
    () => () => {
      const handle = presetHandle
      presetHandle = null
      presetScope = null
      if (!handle) return
      try {
        const dispose = handle[Symbol.asyncDispose] || handle.dispose
        if (typeof dispose === 'function') void Promise.resolve(dispose.call(handle)).catch(() => {})
      } catch {
        /* already released */
      }
    },
    'skill-explorer: preset scope',
  )

  const collect = async (cwd) => {
    const byName = new Map()

    try {
      const snapshot = await ctx.skills.snapshot({ cwd })
      for (const skill of snapshot.skills || []) {
        if (!skill || !skill.name) continue
        byName.set(skill.name, entryOf(skill, 'other'))
      }
    } catch {
      /* another provider may still answer below */
    }

    const scope = await ensurePresetScope()
    if (scope) {
      try {
        const scoped = await ctx.skills.list({ cwd, scope })
        for (const skill of scoped || []) {
          if (!skill || !skill.name) continue
          byName.set(skill.name, merge(byName.get(skill.name), entryOf(skill, 'other')))
        }
      } catch {
        /* a scope that cannot serve keeps the global view */
      }
    }

    const sessions = []
    try {
      const agents = ctx.get('agents')
      const list = agents && typeof agents.list === 'function' ? agents.list() : []
      for (const agent of list) {
        if (sessions.length >= MAX_SESSION_READS) break
        if (agent && agent.id) sessions.push(agent.id)
      }
    } catch {
      /* no agent service: the registry layers above are enough */
    }
    const catalog = ctx.get('sessionSkillCatalog')
    if (catalog && typeof catalog.list === 'function') {
      for (const sessionId of sessions) {
        try {
          const controller = new AbortController()
          const value = await catalog.list({ sessionId }, controller.signal)
          for (const entry of (value && value.skills) || []) {
            if (!entry || !entry.name) continue
            byName.set(
              entry.name,
              merge(byName.get(entry.name), {
                name: entry.name,
                description: text(entry.description),
                whenToUse: text(entry.whenToUse) || null,
                source: 'session',
                provider: 'session',
                path: text(entry.path) || null,
                modelInvocable: entry.modelInvocable !== false,
                userInvocable: true,
              }),
            )
          }
        } catch {
          /* a cold or closed session contributes nothing */
        }
      }
    }

    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  const respond = (res, status, body) => {
    const payload = JSON.stringify(body)
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(payload),
    })
    res.end(payload)
  }

  /** Reject a foreign http(s) Origin; the Electron shell presents `app://`. */
  const admitted = (request, response) => {
    const headers = (request && request.headers) || {}
    const origin = headers.origin
    if (typeof origin !== 'string' || !origin || origin === 'null') return true
    const host = text(headers.host)
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)
    let allowed = true
    if (/^https?:/i.test(origin)) {
      try {
        allowed = new URL(origin).host === host
      } catch {
        allowed = false
      }
    } else if (/^app:/i.test(origin)) {
      allowed = local
    }
    if (allowed) return true
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('cross-origin request rejected')
    return false
  }

  const readBody = async (skill, cwd) => {
    const path = allowList.get(skill.name) || skill.path
    if (path) {
      try {
        const info = await fsp.stat(path)
        if (info.isFile() && info.size <= MAX_BODY_BYTES) {
          const content = await fsp.readFile(path, 'utf8')
          return { ok: true, name: skill.name, path, content }
        }
      } catch {
        /* fall through to the registry, which owns the same file */
      }
    }
    /* A bundled runtime skill has no file; the registry still holds its body. */
    try {
      const definition = await ctx.skills.get(skill.name, { cwd })
      if (definition) {
        return {
          ok: true,
          name: skill.name,
          path: text(definition.path) || null,
          content: text(definition.content),
        }
      }
    } catch {
      /* unknown name or a provider that cannot load it */
    }
    return { ok: false, name: skill.name }
  }

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: LIST_PATH,
        handler: async (request, response) => {
          const method = (request && request.method) || 'GET'
          if (method !== 'GET' && method !== 'HEAD') {
            response.writeHead(405, { allow: 'GET' })
            response.end()
            return
          }
          if (!admitted(request, response)) return
          let cwd = resolveCwd(ctx)
          try {
            const requested = new URL(request.url || '/', 'http://localhost').searchParams.get('cwd')
            if (requested && requested.trim()) cwd = requested.trim()
          } catch {
            /* keep the resolved default */
          }
          try {
            const skills = await collect(cwd)
            allowList.clear()
            for (const skill of skills) if (skill.path) allowList.set(skill.name, skill.path)
            respond(response, 200, { ok: true, cwd, revision, complete: true, skills })
          } catch (error) {
            respond(response, 500, { ok: false, error: String((error && error.message) || error) })
          }
        },
      }),
    'skill-explorer: list route',
  )

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: BODY_PATH,
        handler: async (request, response) => {
          const method = (request && request.method) || 'GET'
          if (method !== 'GET' && method !== 'HEAD') {
            response.writeHead(405, { allow: 'GET' })
            response.end()
            return
          }
          if (!admitted(request, response)) return
          let name = ''
          let cwd = resolveCwd(ctx)
          try {
            const params = new URL(request.url || '/', 'http://localhost').searchParams
            name = (params.get('name') || '').trim()
            const requested = (params.get('cwd') || '').trim()
            if (requested) cwd = requested
          } catch {
            /* no query */
          }
          if (!name) {
            respond(response, 400, { ok: false, error: 'missing name' })
            return
          }
          if (allowList.size === 0) {
            /* The panel always lists first; a cold body read still works but
               refreshes the allow-list so only cataloged files are readable. */
            try {
              const skills = await collect(cwd)
              for (const skill of skills) if (skill.path) allowList.set(skill.name, skill.path)
            } catch {
              /* the registry fallback below still applies */
            }
          }
          try {
            const result = await readBody({ name, path: allowList.get(name) || null }, cwd)
            if (!result.ok) {
              respond(response, 404, { ok: false, error: 'skill not found', name })
              return
            }
            respond(response, 200, result)
          } catch (error) {
            respond(response, 500, {
              ok: false,
              error: String((error && error.message) || error),
            })
          }
        },
      }),
    'skill-explorer: body route',
  )

  if (options.debug === true) ctx.logger?.info?.('skill-explorer mounted')
}
