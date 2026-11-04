window.__ModuleLoader__.load({
  id: 'dsh-usage-today',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /* Must match ROUTE_PATH in index.js. */
    const ENDPOINT = '/local-usage-today/status'
    const POLL_MS = 20000

    const TEXT = {
      label: '今日',
      empty: '暂无调用',
      requests: '次',
      input: '输入',
      cache: '缓存命中',
      output: '输出',
      unavailable: '用量暂不可用',
      costTip: '按 1M tokens 单价估算',
    }

    function trimZeros(text) {
      return text.indexOf('.') >= 0 ? text.replace(/\.?0+$/, '') : text
    }

    function fmtTokens(value) {
      const n = Number(value)
      if (!Number.isFinite(n) || n <= 0) return '0'
      if (n >= 1e8) return `${trimZeros((n / 1e8).toFixed(2))}亿`
      if (n >= 1e4) return `${trimZeros((n / 1e4).toFixed(2))}万`
      return String(Math.round(n))
    }

    function fmtCost(value) {
      const n = Number(value)
      if (!Number.isFinite(n) || n <= 0) return '0.00'
      if (n >= 100) return n.toFixed(1)
      if (n >= 1) return n.toFixed(2)
      if (n >= 0.01) return n.toFixed(3)
      return n.toFixed(4)
    }

    async function readUsage() {
      const response = await fetch(ENDPOINT, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`usage-today HTTP ${response.status}`)
      return response.json()
    }

    const SEGMENT = {
      display: 'inline-flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
    }
    const SEPARATOR = {
      color: 'var(--dsw-alias-label-secondary)',
      opacity: 0.45,
      margin: '0 6px',
    }

    function separator(key) {
      return h('span', { key, style: SEPARATOR }, '·')
    }

    function tooltipOf(data) {
      if (!data || !Array.isArray(data.models) || data.models.length === 0) return TEXT.costTip
      return data.models
        .map((item) => {
          const name = item.model || 'unknown'
          return `${name}: ${data.currency}${fmtCost(item.cost)} · 输入 ${fmtTokens(item.input)} · 缓存 ${fmtTokens(
            item.cacheRead,
          )} · 输出 ${fmtTokens(item.output)} · ${item.requests} 次`
        })
        .join('\n')
    }

    function UsageStrip() {
      const [snapshot, setSnapshot] = React.useState({ status: 'loading', data: null })

      React.useEffect(() => {
        let alive = true
        let timer = null

        const read = async () => {
          try {
            const data = await readUsage()
            if (alive) setSnapshot({ status: 'ok', data })
          } catch (error) {
            if (alive) setSnapshot({ status: 'error', data: null })
            console.error('[usage-today]', error)
          }
        }

        read()
        timer = setInterval(read, POLL_MS)

        const onVisible = () => {
          if (document.visibilityState === 'visible') read()
        }
        const onFocus = () => read()
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('focus', onFocus)

        return () => {
          alive = false
          if (timer) clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisible)
          window.removeEventListener('focus', onFocus)
        }
      }, [])

      if (snapshot.status === 'loading') return null

      if (snapshot.status === 'error') {
        return h(
          'div',
          {
            style: {
              ...SEGMENT,
              fontSize: 12,
              lineHeight: '18px',
              color: 'var(--dsw-alias-label-secondary)',
              opacity: 0.6,
              userSelect: 'none',
            },
          },
          `${TEXT.label} · ${TEXT.unavailable}`,
        )
      }

      const data = snapshot.data || {}
      const totals = data.totals || {}
      const currency = typeof data.currency === 'string' ? data.currency : '¥'
      const requests = Number(totals.requests) || 0
      const children = [
        h(
          'span',
          { key: 'label', style: { color: 'var(--dsw-alias-label-secondary)' } },
          TEXT.label,
        ),
        h(
          'span',
          {
            key: 'cost',
            style: {
              color: 'var(--dsw-alias-label-primary)',
              fontWeight: 500,
              marginLeft: 4,
            },
          },
          `${currency}${fmtCost(totals.cost)}`,
        ),
      ]

      if (requests === 0) {
        children.push(separator('s1'))
        children.push(
          h(
            'span',
            { key: 'empty', style: { color: 'var(--dsw-alias-label-secondary)', opacity: 0.75 } },
            TEXT.empty,
          ),
        )
      } else {
        children.push(separator('s1'))
        children.push(
          h('span', { key: 'in' }, `${TEXT.input} ${fmtTokens(totals.input)}`),
        )
        if (Number(totals.cacheRead) > 0) {
          children.push(separator('s2'))
          children.push(h('span', { key: 'cache' }, `${TEXT.cache} ${fmtTokens(totals.cacheRead)}`))
        }
        children.push(separator('s3'))
        children.push(h('span', { key: 'out' }, `${TEXT.output} ${fmtTokens(totals.output)}`))
        children.push(separator('s4'))
        children.push(h('span', { key: 'req' }, `${requests} ${TEXT.requests}`))
      }

      return h(
        'div',
        {
          title: tooltipOf(data),
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0px',
            fontSize: 12,
            lineHeight: '18px',
            color: 'var(--dsw-alias-label-secondary)',
            userSelect: 'none',
            cursor: 'default',
          },
        },
        ...children,
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.composer.dock',
              id: 'usage-today',
              order: 2,
            },
            UsageStrip,
          ),
        )
      },
    }
  },
})
