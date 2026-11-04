# dsh-plugins · 两个 DSH 插件

纯 JS，**无需构建**，装上即有界面。仓库结构就是这个目录：

```
usage-today/      # 输入框下方：今日用量 + 估算费用
skill-explorer/   # 左侧栏：技能浏览器（浏览技能目录 + 读 SKILL.md）
index.json        # 插件市场索引（format 1），给别人在 Discover 里一键装
check-index.cjs   # 索引自检：node check-index.cjs .
README.md
```

安装后在 dsh 里叫 `dsh-usage-today` 和 `dsh-skill-explorer`（各自的 `cordis.patch.yml` 声明 bundle 入口，`package.json` 声明 Web 端）。

---

## 一、把仓库传上去（本机没有 Git，用网页拖拽）

1. GitHub 新建仓库：名字 **`dsh-plugins`**，Public（Private 也行，但别人装就得给凭据）。
2. 进仓库 → **Add file → Upload files**。
3. 把本目录里的这几项拖进去（拖文件夹会保留层级）：
   `usage-today/`、`skill-explorer/`、`index.json`、`check-index.cjs`、`.gitignore`、`README.md`
4. 提交信息随便写，点 **Commit changes**。
5. 拿 commit：点左边文件列表上那条提交，地址栏变成
   `https://github.com/465509522/dsh-plugins/commit/<40位SHA>` —— 记下这段 SHA（市场索引必须用它，分支名不行）。

以后改代码：同一个仓库再 Upload files 覆盖即可（会生成新 commit，再更新一次索引里的 SHA 和 `publishTimestamp`）。

## 二、别人怎么装

任一 target 交给 `plugin_manager` 的 `install_bundle`，或在 **设置 → 插件** 里粘贴：

| 想要 | target |
|---|---|
| 今日用量 | `git+https://github.com/465509522/dsh-plugins.git#<40位SHA>&path:/usage-today` |
| 技能浏览 | `git+https://github.com/465509522/dsh-plugins.git#<40位SHA>&path:/skill-explorer` |
| 想跟最新（不钉 commit） | `git+https://github.com/465509522/dsh-plugins.git#main&path:/usage-today` |
| 同机 / 内网共享盘 | 直接把目录给他：`D:\...\plugins\usage-today` |

注意两个坑：

- **不能**直接把 `https://codeload.github.com/465509522/dsh-plugins/tar.gz/refs/heads/main` 当 target —— 那会把仓库根当成一个包，而根上没有 `package.json`，pnpm 会失败。多包仓库必须用 `git+…#commit&path:/子目录`。
- 对方机器需要 Git（`install_bundle` 装 git 地址时由 pnpm 调用 git）；Windows 上 `winget install --id Git.Git -e`，或用 GitHub Desktop。

## 三、让别人在 Discover 里一键装（可选）

`index.json` 已经是可用的 format 1 索引，还差两处真值：

1. `plugins[].versions[].source.commit` → 上面第 5 步的 40 位 SHA（两处）
2. 想更新发布时间就把 `publishTimestamp` 改成**当前 Unix 秒**（不是毫秒）

改完 `node check-index.cjs .` 应该输出 `INDEX OK — no format-1 violations found`（它按 dsh 的 validator 规则核对字段、时间戳单位、commit 形状、图标是否存在，并检查 `package.json` 名字 == patch 名字 == 索引名字）。

然后把 `index.json` 挂到 https 上 —— 用本仓库自己的 raw 地址就行：

```
https://raw.githubusercontent.com/465509522/dsh-plugins/main/index.json
```

对方的步骤（**索引源只能由用户在界面里加**，`plugin_manager` / `plugin_market` 工具无权改，这是故意的权限边界）：

**设置 → 插件 → Discover → 添加索引 → 粘贴上面的 raw 地址 → 搜索 → 安装**

## 四、备选：发 npm（朋友按名字装，最省事）

GitHub 路线已经够用，这条只在你想让安装变成一行包名时考虑。

1. 删掉两个 `package.json` 里的 `"private": true`（npm 拒绝发布私有包）。
2. 想用 scope 就把 `name` 改成 `@你的scope/usage-today`，同时改 `cordis.patch.yml` 行里的 `name` 和 `index.json` 的 `plugins[].name`（三处必须一致）。
3. `cd usage-today && npm publish --access public`（需要先 `npm login`；这台机器目前没登录）。
4. 别人：`install_bundle` → `target: dsh-usage-today`（可写 `dsh-usage-today@1.0.0` 钉版本；官方源慢会自动落到 `registry.npmmirror.com`）。

## 五、改名时最容易翻车的地方

`client.js` 第一行有一个**必须等于包名**的模块 id：

```js
window.__ModuleLoader__.load({
  id: 'dsh-usage-today',   // ← 必须和 package.json 的 name 完全一致
  ...
```

改名要同时改三处：`package.json` 的 `name`、`cordis.patch.yml` 行里的 `name`、`client.js` 里的 `id`。少改第三处时 Host 半照样跑（接口 200），但界面**静默不出现**——模块注册的 id 和 ploader 等的那一行对不上，没有任何报错。这个坑我自己刚踩过，`check-index.cjs` 只校索引不校这个，改完记得肉眼确认。

改完必须把插件关一次再开（`set_plugin` 关 → 开），让页面重新加载该 bundle；只改文件不会热更 `client.js` 的 id。

## 六、兼容性声明（可选，别写错）

两个包都没写 `engines.dsh`，所以任何 dsh 版本都不拦。要加就小心 prerelease 语义：

```json
"engines": { "dsh": ">=0.2.2-0" }
```

`">=0.2.1"` **不匹配** `0.2.2-rc.1` —— semver 规定带 prerelease 的版本必须由同 `M.m.p` 的 comparator 放行。写错等于把当前这版 dsh 挡在门外（会报 `incompatible-version` 并提示 `dsh plugin allow-version`）。

## 七、验收单

对方装完应立刻看到（无需重启、无需构建）：

1. 设置 → 插件 → 已安装里出现 `dsh-usage-today` / `dsh-skill-explorer`，各一行 child；
2. 会话输入框下方出现「今日 ¥0.00 · 暂无调用」那一行；
3. 左侧栏出现书本图标「技能」，点开能看到他自己的技能（比如 `~/.dsh/skills` 里的）；
4. Host 自检：`GET http://127.0.0.1:<端口>/local-usage-today/status` 与 `/skill-explorer/list` 都返回 `{"ok":true,...}`。

## 八、安全提醒

两个插件的 Host 半跑在 dsh **进程内**，权限和 dsh 相同（`usage-today` 会写 `$DSH_HOME/plugin-data/`，`skill-explorer` 会读技能文件的 `SKILL.md`）。把源码一起给对方 —— 别人装你的插件，等于让你在他的机器上跑你的代码。
