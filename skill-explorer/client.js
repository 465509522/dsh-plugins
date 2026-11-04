window.__ModuleLoader__.load({
  id: 'dsh-skill-explorer',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'skill-explorer'
    /* These must match the routes registered by index.js. */
    const LIST_ENDPOINT = '/skill-explorer/list'
    const BODY_ENDPOINT = '/skill-explorer/body'
    const POLL_MS = 60000

    const zh = {
      panel: '技能',
      title: '技能',
      count: '{count} 个',
      refresh: '重新读取技能目录',
      search: '筛选技能',
      searchPlaceholder: '按名称或描述筛选…',
      searchClear: '清空筛选',
      loading: '正在读取技能目录…',
      error: '技能目录读取失败',
      retry: '重试',
      empty: '这个位置还没有技能。把 SKILL.md 放进 ~/.dsh/skills 或项目的 .dsh/skills，它就会出现在这里。',
      noMatches: '没有匹配的技能',
      back: '返回列表',
      detailLoading: '正在加载 SKILL.md…',
      detailError: 'SKILL.md 读取失败',
      copyPath: '复制路径',
      copied: '已复制',
      modelOnly: '仅模型可调用',
      userOnly: '仅用户可调用',
      whenToUse: '适用时机',
      incomplete: '部分技能源读取失败，结果可能不完整',
      sourceProjectDsh: '项目 .dsh/skills',
      sourceProjectAgents: '项目 .agents/skills',
      sourceCustom: '自定义目录',
      sourceUserDsh: '用户 ~/.dsh/skills',
      sourceUserAgents: '用户 ~/.agents/skills',
      sourceBundled: '内置',
      sourceRuntime: '运行时',
      sourceSession: '会话可见',
      sourceOther: '其他来源',
    }

    const en = {
      panel: 'Skills',
      title: 'Skills',
      count: '{count}',
      refresh: 'Reload the skill catalog',
      search: 'Filter skills',
      searchPlaceholder: 'Filter by name or description…',
      searchClear: 'Clear filter',
      loading: 'Reading the skill catalog…',
      error: 'Could not read the skill catalog',
      retry: 'Retry',
      empty: 'No skills here yet. Drop a SKILL.md into ~/.dsh/skills or the project .dsh/skills and it appears here.',
      noMatches: 'No matching skills',
      back: 'Back to the list',
      detailLoading: 'Loading SKILL.md…',
      detailError: 'Could not read SKILL.md',
      copyPath: 'Copy path',
      copied: 'Copied',
      modelOnly: 'Model only',
      userOnly: 'User only',
      whenToUse: 'When to use',
      incomplete: 'Some skill sources failed to load; this list may be incomplete',
      sourceProjectDsh: 'Project .dsh/skills',
      sourceProjectAgents: 'Project .agents/skills',
      sourceCustom: 'Custom directory',
      sourceUserDsh: 'User ~/.dsh/skills',
      sourceUserAgents: 'User ~/.agents/skills',
      sourceBundled: 'Bundled',
      sourceRuntime: 'Runtime',
      sourceSession: 'Session-visible',
      sourceOther: 'Other sources',
    }

    const SOURCES = [
      { key: 'project-dsh', label: 'sourceProjectDsh' },
      { key: 'project-agents', label: 'sourceProjectAgents' },
      { key: 'custom', label: 'sourceCustom' },
      { key: 'user-dsh', label: 'sourceUserDsh' },
      { key: 'user-agents', label: 'sourceUserAgents' },
      { key: 'bundled', label: 'sourceBundled' },
      { key: 'runtime', label: 'sourceRuntime' },
      { key: 'session', label: 'sourceSession' },
    ]

    const S = {
      page: {
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        fontFamily: 'inherit',
      },
      header: {
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '18px 20px 10px',
      },
      title: { margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 600, letterSpacing: '0.01em' },
      count: {
        fontSize: 12,
        lineHeight: '20px',
        color: 'var(--dsw-alias-label-secondary)',
        padding: '0 6px',
        borderRadius: 999,
        border: '1px solid var(--dsw-alias-border-l1)',
      },
      spacer: { flex: '1 1 auto' },
      iconButton: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        padding: 0,
        border: '1px solid transparent',
        borderRadius: 8,
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        cursor: 'pointer',
        fontFamily: 'inherit',
      },
      textButton: {
        display: 'inline-flex',
        alignItems: 'center',
        height: 26,
        padding: '0 10px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 8,
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        fontFamily: 'inherit',
        cursor: 'pointer',
      },
      toolbar: { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px 12px' },
      searchWrap: { position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 auto', maxWidth: 520 },
      search: {
        width: '100%',
        height: 30,
        padding: '0 28px 0 10px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 13,
        fontFamily: 'inherit',
        outline: 'none',
      },
      searchClear: {
        position: 'absolute',
        right: 4,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        padding: 0,
        border: 'none',
        borderRadius: 6,
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        cursor: 'pointer',
        fontSize: 14,
        lineHeight: '20px',
        fontFamily: 'inherit',
      },
      scroll: { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0 20px 28px' },
      column: { maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 2 },
      groupTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        margin: '14px 0 4px',
        padding: '0 4px',
        fontSize: 11.5,
        lineHeight: '18px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--dsw-alias-label-secondary)',
      },
      row: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid transparent',
        background: 'transparent',
        color: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
      },
      rowMain: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: '1 1 auto' },
      rowName: { fontSize: 13.5, lineHeight: '20px', fontWeight: 600, wordBreak: 'break-word' },
      rowDescription: {
        fontSize: 12.5,
        lineHeight: '19px',
        color: 'var(--dsw-alias-label-secondary)',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      },
      badgeRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
      badge: {
        display: 'inline-flex',
        alignItems: 'center',
        height: 18,
        padding: '0 6px',
        borderRadius: 999,
        border: '1px solid var(--dsw-alias-border-l1)',
        fontSize: 11,
        lineHeight: '16px',
        color: 'var(--dsw-alias-label-secondary)',
        whiteSpace: 'nowrap',
      },
      note: {
        margin: '12px 0 0',
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-border-l1)',
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-state-warn-primary)',
      },
      hint: { padding: '24px 8px', fontSize: 12.5, lineHeight: '20px', color: 'var(--dsw-alias-label-secondary)' },
      detailHead: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0 4px', marginLeft: -6 },
      detailName: { margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 600, wordBreak: 'break-word' },
      metaRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        padding: '0 0 10px',
        fontSize: 12,
        color: 'var(--dsw-alias-label-secondary)',
      },
      pathButton: {
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: '100%',
        padding: '2px 6px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 6,
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11.5,
        fontFamily: 'inherit',
        cursor: 'pointer',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      whenToUse: { fontSize: 12.5, lineHeight: '19px', color: 'var(--dsw-alias-label-secondary)', padding: '0 0 10px' },
      pre: {
        margin: 0,
        padding: '14px 16px',
        borderRadius: 10,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12.5,
        lineHeight: '1.72',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        tabSize: 2,
        fontFamily: 'inherit',
      },
    }

    function readJson(url) {
      return fetch(url, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      }).then((response) =>
        response.text().then((raw) => {
          let data = null
          try {
            data = raw ? JSON.parse(raw) : null
          } catch {
            data = null
          }
          if (!response.ok || !data || data.ok === false) {
            const detail = (data && data.error) || `HTTP ${response.status}`
            throw new Error(detail)
          }
          return data
        }),
      )
    }

    function format(t, key, values) {
      let value = t(key)
      if (values) {
        for (const name of Object.keys(values)) value = value.split(`{${name}}`).join(String(values[name]))
      }
      return value
    }

    function sourceLabelKey(source) {
      for (const entry of SOURCES) if (entry.key === source) return entry.label
      return 'sourceOther'
    }

    function hoverable(style, hoverStyle) {
      return function HoverButton(props) {
        const [hover, setHover] = React.useState(false)
        return h(
          'button',
          Object.assign({ type: 'button' }, props, {
            style: Object.assign({}, style, hover ? hoverStyle : null),
            onMouseEnter: () => setHover(true),
            onMouseLeave: () => setHover(false),
          }),
        )
      }
    }

    const RowButton = hoverable(S.row, { background: 'var(--dsw-alias-bg-layer-2)' })
    const IconButton = hoverable(S.iconButton, {
      background: 'var(--dsw-alias-bg-layer-2)',
      color: 'var(--dsw-alias-label-primary)',
    })
    const TextButton = hoverable(S.textButton, {
      background: 'var(--dsw-alias-bg-layer-2)',
      color: 'var(--dsw-alias-label-primary)',
    })

    function Badge(props) {
      return h('span', { style: Object.assign({}, S.badge, props.style) }, props.children)
    }

    function BookIcon(props) {
      const size = typeof props.size === 'number' && props.size > 0 ? props.size : 18
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
          style: { display: 'block' },
        },
        h('path', { d: 'M4 6.2A2.2 2.2 0 0 1 6.2 4H19v13.4H6.6A2.6 2.6 0 0 0 4 20Z' }),
        h('path', { d: 'M4 17.4A2.6 2.6 0 0 1 6.6 15H19' }),
        h('path', { d: 'M8.6 8.1h6.2' }),
        h('path', { d: 'M8.6 11.2h4.1' }),
      )
    }

    function RefreshIcon() {
      return h(
        'svg',
        {
          width: 15,
          height: 15,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
          style: { display: 'block' },
        },
        h('path', { d: 'M20 12a8 8 0 1 1-2.6-5.9' }),
        h('path', { d: 'M20 4v4.4h-4.4' }),
      )
    }

    function ArrowIcon(props) {
      return h(
        'svg',
        {
          width: 14,
          height: 14,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
          style: Object.assign({ display: 'block' }, props.style),
        },
        props.back ? h('path', { d: 'M15 5l-7 7 7 7' }) : h('path', { d: 'M9 5l7 7-7 7' }),
      )
    }

    /** The left-rail glyph: the sidebar owns the button, this is only its artwork. */
    function SkillPanelIcon(props) {
      const active = props && props.active === true
      const size = props && typeof props.size === 'number' && props.size > 0 ? props.size : 18
      return h(
        'span',
        {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: active ? 'var(--dsw-alias-brand-primary)' : 'currentColor',
            opacity: active ? 1 : 0.88,
          },
        },
        h(BookIcon, { size }),
      )
    }

    function SkillPanel() {
      const [catalog, setCatalog] = React.useState({ status: 'loading', skills: [], cwd: '', complete: true, error: null })
      const [query, setQuery] = React.useState('')
      const [selectedName, setSelectedName] = React.useState(null)
      const [detail, setDetail] = React.useState({ status: 'idle', content: '', path: null, error: null })
      const [copied, setCopied] = React.useState(false)
      const [reloadKey, setReloadKey] = React.useState(0)

      const t = React.useCallback((key) => translate(key), [])

      const load = React.useCallback(() => {
        readJson(LIST_ENDPOINT)
          .then((data) => {
            setCatalog({
              status: 'ready',
              skills: Array.isArray(data.skills) ? data.skills : [],
              cwd: typeof data.cwd === 'string' ? data.cwd : '',
              complete: data.complete !== false,
              error: null,
            })
          })
          .catch((error) => {
            setCatalog((previous) => ({
              /* keep the last good list on screen when a refresh fails */
              status: previous.skills.length > 0 ? 'ready' : 'error',
              skills: previous.skills,
              cwd: previous.cwd,
              complete: previous.complete,
              error: String((error && error.message) || error),
            }))
          })
      }, [])

      React.useEffect(() => {
        load()
        const timer = setInterval(() => {
          if (document.visibilityState === 'visible') load()
        }, POLL_MS)
        const onVisible = () => {
          if (document.visibilityState === 'visible') load()
        }
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('focus', onVisible)
        return () => {
          clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisible)
          window.removeEventListener('focus', onVisible)
        }
      }, [load])

      React.useEffect(() => {
        if (!selectedName) {
          setDetail({ status: 'idle', content: '', path: null, error: null })
          return undefined
        }
        let alive = true
        setDetail({ status: 'loading', content: '', path: null, error: null })
        readJson(`${BODY_ENDPOINT}?name=${encodeURIComponent(selectedName)}`)
          .then((data) => {
            if (!alive) return
            setDetail({
              status: 'ready',
              content: typeof data.content === 'string' ? data.content : '',
              path: typeof data.path === 'string' ? data.path : null,
              error: null,
            })
          })
          .catch((error) => {
            if (!alive) return
            setDetail({ status: 'error', content: '', path: null, error: String((error && error.message) || error) })
          })
        return () => {
          alive = false
        }
      }, [selectedName, reloadKey])

      const selected = React.useMemo(
        () => catalog.skills.find((skill) => skill.name === selectedName) || null,
        [catalog.skills, selectedName],
      )

      const visible = React.useMemo(() => {
        const terms = query.trim().toLowerCase()
        if (!terms) return catalog.skills
        return catalog.skills.filter((skill) => {
          const haystack = `${skill.name}\n${skill.description}\n${skill.whenToUse || ''}`.toLowerCase()
          return haystack.includes(terms)
        })
      }, [catalog.skills, query])

      const groups = React.useMemo(() => {
        const buckets = new Map()
        for (const entry of SOURCES) buckets.set(entry.key, [])
        for (const skill of visible) {
          const key = buckets.has(skill.source) ? skill.source : 'other'
          if (!buckets.has(key)) buckets.set(key, [])
          buckets.get(key).push(skill)
        }
        const result = []
        for (const entry of SOURCES) {
          const items = buckets.get(entry.key) || []
          if (items.length > 0) result.push({ key: entry.key, label: entry.label, items })
        }
        const other = buckets.get('other') || []
        if (other.length > 0) result.push({ key: 'other', label: 'sourceOther', items: other })
        return result
      }, [visible])

      const copyPath = (path) => {
        try {
          Promise.resolve(navigator.clipboard.writeText(path)).then(
            () => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            },
            () => {},
          )
        } catch {
          /* clipboard unavailable inside this frame */
        }
      }

      const header = h(
        'div',
        { style: S.header },
        h('h2', { style: S.title }, t('title')),
        catalog.status === 'ready'
          ? h('span', { style: S.count }, format(t, 'count', { count: catalog.skills.length }))
          : null,
        h('span', { style: S.spacer }),
        h(IconButton, { onClick: load, title: t('refresh'), 'aria-label': t('refresh') }, h(RefreshIcon, null)),
      )

      const search = h(
        'div',
        { style: S.toolbar },
        h(
          'div',
          { style: S.searchWrap },
          h('input', {
            style: S.search,
            type: 'search',
            value: query,
            placeholder: t('searchPlaceholder'),
            'aria-label': t('search'),
            onChange: (event) => setQuery(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Escape') setQuery('')
            },
          }),
          query
            ? h(
                'button',
                {
                  type: 'button',
                  style: S.searchClear,
                  'aria-label': t('searchClear'),
                  title: t('searchClear'),
                  onClick: () => setQuery(''),
                },
                '×',
              )
            : null,
        ),
      )

      let body = null

      if (selected) {
        const shownPath = detail.path || selected.path || ''
        const chips = [
          h(Badge, { key: 'source' }, t(sourceLabelKey(selected.source))),
          selected.userInvocable ? h(Badge, { key: 'slash' }, `/${selected.name}`) : null,
          selected.modelInvocable
            ? null
            : h(Badge, { key: 'userOnly', style: { color: 'var(--dsw-alias-state-warn-primary)' } }, t('userOnly')),
          selected.userInvocable
            ? null
            : h(Badge, { key: 'modelOnly', style: { color: 'var(--dsw-alias-state-warn-primary)' } }, t('modelOnly')),
          shownPath
            ? h(
                'button',
                {
                  key: 'path',
                  type: 'button',
                  style: S.pathButton,
                  title: `${t('copyPath')}: ${shownPath}`,
                  onClick: () => copyPath(shownPath),
                },
                copied ? `${t('copied')} ✓` : shownPath,
              )
            : null,
        ]

        body = h(
          'div',
          { style: S.scroll },
          h(
            'div',
            { style: S.column },
            h(
              'div',
              { style: S.detailHead },
              h(IconButton, { onClick: () => setSelectedName(null), title: t('back'), 'aria-label': t('back') }, h(ArrowIcon, { back: true })),
              h('h3', { style: S.detailName }, selected.name),
            ),
            h('div', { style: S.metaRow }, ...chips.filter(Boolean)),
            selected.whenToUse ? h('div', { style: S.whenToUse }, `${t('whenToUse')}: ${selected.whenToUse}`) : null,
            detail.status === 'loading'
              ? h('div', { style: S.hint }, t('detailLoading'))
              : detail.status === 'error'
                ? h(
                    'div',
                    { style: S.hint },
                    `${t('detailError')} — ${detail.error}`,
                    h(
                      'div',
                      { style: { marginTop: 8 } },
                      h(TextButton, { onClick: () => setReloadKey((value) => value + 1) }, t('retry')),
                    ),
                  )
                : h('pre', { style: S.pre }, detail.content || '—'),
          ),
        )
      } else {
        const children = []
        if (catalog.status === 'loading') {
          children.push(h('div', { key: 'loading', style: S.hint }, t('loading')))
        } else if (catalog.status === 'error') {
          children.push(
            h(
              'div',
              { key: 'error', style: S.hint },
              `${t('error')} — ${catalog.error}`,
              h('div', { style: { marginTop: 8 } }, h(TextButton, { onClick: load }, t('retry'))),
            ),
          )
        } else if (catalog.skills.length === 0) {
          children.push(h('div', { key: 'empty', style: S.hint }, t('empty')))
        } else if (visible.length === 0) {
          children.push(h('div', { key: 'none', style: S.hint }, t('noMatches')))
        } else {
          for (const group of groups) {
            children.push(h('div', { key: `g:${group.key}`, style: S.groupTitle }, `${t(group.label)} · ${group.items.length}`))
            for (const skill of group.items) {
              const chips = []
              if (skill.userInvocable) chips.push(h(Badge, { key: 'slash' }, `/${skill.name}`))
              if (!skill.modelInvocable) {
                chips.push(h(Badge, { key: 'userOnly', style: { color: 'var(--dsw-alias-state-warn-primary)' } }, t('userOnly')))
              }
              children.push(
                h(
                  RowButton,
                  {
                    key: `s:${skill.source}:${skill.name}`,
                    onClick: () => {
                      setCopied(false)
                      setSelectedName(skill.name)
                    },
                  },
                  h(
                    'div',
                    { style: S.rowMain },
                    h('div', { style: S.rowName }, skill.name),
                    skill.description ? h('div', { style: S.rowDescription }, skill.description) : null,
                    chips.length > 0 ? h('div', { style: S.badgeRow }, ...chips) : null,
                  ),
                  h(ArrowIcon, { style: { color: 'var(--dsw-alias-label-secondary)', marginTop: 4, flex: '0 0 auto' } }),
                ),
              )
            }
          }
          if (catalog.complete === false) children.push(h('div', { key: 'partial', style: S.note }, t('incomplete')))
        }
        body = h('div', { style: S.scroll }, h('div', { style: S.column }, ...children))
      }

      return h('div', { style: S.page }, header, selected ? null : search, body)
    }

    /* Rebound by apply(); the fallback keeps the panel readable if locale is absent. */
    let translate = (key) => zh[key] || key

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          let dispose = null
          try {
            dispose = ctx.locale.register(NS, { zh, en })
          } catch (error) {
            console.error('[skill-explorer] locale registration failed', error)
          }
          let bound = null
          try {
            bound = ctx.locale.bind(NS)
          } catch {
            bound = null
          }
          translate = (key) => {
            if (bound) {
              const value = bound(key)
              if (typeof value === 'string' && value && value !== key) return value
            }
            return zh[key] || key
          }
          return () => {
            if (typeof dispose === 'function') dispose()
            translate = (key) => zh[key] || key
          }
        }, 'skill-explorer: dictionaries')

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: 'skills',
              order: 20,
              locale: NS,
              label: () => translate('panel'),
            },
            SkillPanelIcon,
          ),
        )

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: 'skills',
              locale: NS,
            },
            SkillPanel,
          ),
        )
      },
    }
  },
})
