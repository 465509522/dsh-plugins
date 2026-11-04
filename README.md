# dsh-plugins · 大肥鱼的两个 DSH 插件

不用构建、不用打包，纯 JS 装上就有界面。

| 包 | 在哪 | 干什么 |
|---|---|---|
| `dsh-usage-today` | 输入框下方 | 今日 token 用量 + 按单价估算的费用，悬停看分模型明细 |
| `dsh-skill-explorer` | 左侧栏「技能」 | 浏览当前生效的技能目录，读每个 `SKILL.md` 全文 |

```
usage-today/        # bundle: 一条 cordis.patch.yml + Host 路由 + Client 用量条
skill-explorer/     # bundle: 左侧栏面板 + Host 路由
index.json          # 插件市场索引（format 1），可在 Discover 里一键装
check-index.cjs     # 索引自检，改完索引跑一下
```

## 安装

需要一个能跑 `git` 的机器（`install_bundle` 装 git 地址时由 pnpm 调用 git；Windows 上 `winget install --id Git.Git -e`）。

钉 commit（推荐，可复现）：

```text
plugin_manager → install_bundle
target: git+https://github.com/465509522/dsh-plugins.git#8f9f4f64e7f258800bef7d6bd227dbf8c56fdd4d&path:/usage-today

plugin_manager → install_bundle
target: git+https://github.com/465509522/dsh-plugins.git#8f9f4f64e7f258800bef7d6bd227dbf8c56fdd4d&path:/skill-explorer
```

跟最新（省事，但内容会变）：

```text
target: git+https://github.com/465509522/dsh-plugins.git#main&path:/skill-explorer
```

**不要在插件市场里直接填 codeload tarball**：本仓库是多包结构，根上没有 `package.json`，pnpm 会把整个仓库当成一个包然后失败。多包仓库必须用 `git+…#commit&path:/子目录`。

### 在 Discover 里一键装

设置 → 插件 → **Discover** → 添加索引，粘贴：

```
https://raw.githubusercontent.com/465509522/dsh-plugins/main/index.json
```

索引源只能由用户自己添加（`plugin_manager` / `plugin_market` 工具无权改，这是故意的权限边界）。

## 配置

`usage-today` 的价格表写在它自己的 `cordis.patch.yml` 里（单位：货币 / 百万 tokens）。想长期覆盖，在 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 里按 row id 覆盖：

```yaml
- id: usage-today
  name: "dsh-usage-today"
  config:
    currency: '¥'
    inputIncludesCache: false   # 供应商把缓存算进 inputTokens 时设为 true
    prices:
      sn-deepseek-v4-1-flash-1017: { input: 2, cacheRead: 0.5, cacheWrite: 0, output: 8 }
```

`skill-explorer` 没有配置项：它只读 `ctx.skills` / `agentPresets` / `sessionSkillCatalog` 三层视图。

## 维护（改了代码之后）

1. 改动对应目录里的文件，网页上传覆盖（会生成新 commit）。
2. 把新 commit SHA 和当前 Unix 秒填进 `index.json` 的两处 `versions[].source.commit` / `publishTimestamp`。
3. `node check-index.cjs .` 必须是 `INDEX OK — no format-1 violations found`。
4. 上传新的 `index.json`。

注意时序：** `index.json` 里钉的 commit 必须是"已经包含插件代码"的那次提交**，不能是同一次提交（自指的 hash 不存在）。所以顺序永远是「先传代码 → 拿 SHA → 再传索引」。

## 改名时最容易翻车的地方

`client.js` 第一行有一个**必须等于包名**的模块 id：

```js
window.__ModuleLoader__.load({
  id: 'dsh-usage-today',   // ← 必须和 package.json 的 name 完全一致
  ...
```

改名要同时改三处：`package.json` 的 `name`、`cordis.patch.yml` 行里的 `name`、`client.js` 里的 `id`。少改第三处时 Host 半照样跑（接口 200），但界面**静默不出现** —— 注册的 id 和 loader 等的那一行对不上，没有任何报错。改完必须把插件关一次再开，让页面重新加载 bundle。

## 兼容性声明（可选，别写错）

两个包都没写 `engines.dsh`，所以任何 dsh 版本都不拦。要加就小心 prerelease：

```json
"engines": { "dsh": ">=0.2.2-0" }
```

`">=0.2.1"` **不匹配** `0.2.2-rc.1` —— semver 规定带 prerelease 的版本必须由同 `M.m.p` 的 comparator 放行。写错等于把当前这版 dsh 挡在门外。

## 验收

装完无需重启、无需构建，应该立刻看到：

1. 设置 → 插件 → 已安装里出现 `dsh-usage-today` / `dsh-skill-explorer`，各一行 child；
2. 会话输入框下方出现「今日 ¥0.00 · 暂无调用」；
3. 左侧栏出现书本图标「技能」，点开是自己的技能（`~/.dsh/skills` 等）；
4. Host 自检：`GET http://127.0.0.1:<端口>/local-usage-today/status`、`/skill-explorer/list` 返回 `{"ok":true,...}`。

## 安全

两个插件的 Host 半都跑在 dsh **进程内**，权限与 dsh 相同（`usage-today` 写 `$DSH_HOME/plugin-data/`，`skill-explorer` 读技能文件的 `SKILL.md`，两条 HTTP 路由只接受 GET 且做同源校验）。装别人的插件等于让别人的代码在你的机器上跑 —— 装之前读源码。
