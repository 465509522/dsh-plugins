# usage-today · 今日用量

输入框下方的用量条：统计**今天**的 token 消耗，并按你给的单价的估算费用。纯本地、只读，不上报任何东西。

```
今日 ¥1.80 · 输入 1.47万 · 缓存命中 339.1万 · 输出 8785 · 24 次
```

鼠标悬停显示按模型拆分的明细（费用 / 输入 / 缓存 / 输出 / 次数）。

## 它怎么工作

Host 半监听 `session/event`，只取 `assistant/message` 里的 `usage`（input / cacheRead / cacheWrite / output / reasoning）与 `message.source` 的 provider·model，按**本地日期**分桶累加；快照滚动保留 60 天，写到 `$DSH_HOME/plugin-data/usage-today.json`（先写临时文件再 rename）。日志本身只读，不改一个字节。

Client 半注册在 `conversation.composer.dock`（order 2，排在自带的 用量 行下面），每 20 秒 + 窗口聚焦时向 Host 的只读路由 `GET /local-usage-today/status` 取一次数，卸载即清定时器。样式只用 `--dsw-alias-*` 主题 token。

## 计费口径

```
费用 = (输入 × input + 缓存读 × cacheRead + 缓存写 × cacheWrite + 输出 × output) / 1M
```

单位是「货币 / 百万 tokens」。`reasoning` 已包含在 output 里，只展示、不重复计价。实测 OpenAI-compatible 报文里 `inputTokens` 是**未命中缓存**的部分（`cacheReadTokens` 单独上报），所以两者相加；若你的供应商把缓存算在 input 里，把 `inputIncludesCache` 设成 `true`。

## 配置

```yaml
- id: usage-today
  name: '@local/usage-today'
  config:
    currency: '¥'
    persist: true
    inputIncludesCache: false
    prices:                     # 元 / 1M tokens；按 模型 → provider/model → provider 逐级回退
      sn-deepseek-v4-1-flash-1017:
        input: 2
        cacheRead: 0.5
        cacheWrite: 0
        output: 8
    defaultPrice: { input: 2, cacheRead: 0.5, cacheWrite: 0, output: 8 }
```

改完在 设置 → 插件 里把本插件关再开（或重启 dsh）生效。价格只影响显示，不会去查任何账单接口 —— 想准就得自己填对单价。

## 安装

```text
plugin_manager → install_bundle → target: <这个包所在目录或包名>
```

从 GitHub 装（钉 commit 更稳）：

```text
git+https://github.com/465509522/dsh-plugins.git#<40位SHA>&path:/usage-today
```

## 限制

- 只统计本 profile 的会话；换 profile 或删 `$DSH_HOME/plugin-data/usage-today.json` 就归零。
- 只认 `assistant/message.usage`；不走 `usage` 上报的供应商（部分自建网关）显示 0。
- 费用是估算，不包含你的套餐折扣、阶梯价、图片/工具计费。
