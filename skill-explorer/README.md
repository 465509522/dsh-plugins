# skill-explorer · 技能浏览

给左侧栏加一个「技能」入口：点开是当前**真实生效**的技能目录，能筛选、能读每个技能的 `SKILL.md` 全文。

dsh 本身没有列技能的地方（只有 `/` 斜杠补全和模型侧的隐藏目录），这个插件补的正是这块。

## 界面

- 左侧栏图标（`sidebar.panellist`，id `skills`，order 20，排在「插件」「自动化任务」之后）；选中时用品牌色高亮。
- 中央页（`main` 键 `skills`）：标题 + 数量 + 刷新按钮，筛选框（名称 / 描述 / 适用时机，Esc 清空），按来源分组的列表，每行是名字 + 两行描述 + `/name` 与「仅用户可调用」标记。
- 点一行进详情：返回、来源徽章、可点复制的 `SKILL.md` 路径、适用时机，正文按 `pre-wrap` 原样保留（像 grilling 那种带缩进的问答排版不会塌）。

## 数据从哪来

Host 半把三层只读视图合并，去重后按名字排序：

1. 全局注册层 `ctx.skills.snapshot({ cwd })` —— 宿主平面技能（内置 office 等）；
2. 默认 agent preset 的 scope（`agentPresets.acquireScope()` → `skills.list({ scope, cwd })`）—— `~/.dsh/skills`、项目 `.dsh/skills` 这些文件系统根注册在这一层，来源标签才准；
3. 当前会话的技能目录（`sessionSkillCatalog.list`）兜底，把前两层没覆盖到的补齐。

正文走 `GET /skill-explorer/body?name=`：优先读**本次列表允许清单**里的文件路径（不做任意路径读取），没有文件的运行时技能回退到 `ctx.skills.get()`；未知名字 404。两条路由都做同源校验（同 host 或 `app://` 放行，跨站 403）且只接受 GET。

## 刷新

60 秒轮询 + 窗口重新可见/聚焦时刷新 + 右上角手动刷新。所以往 `~/.dsh/skills` 丢一个新技能目录，不需要重启 dsh，列表里就会出现。

## 安装

```text
plugin_manager → install_bundle → target: <这个包所在目录或包名>
```

从 GitHub 装（钉 commit 更稳）：

```text
git+https://github.com/465509522/dsh-plugins.git#<40位SHA>&path:/skill-explorer
```

装上即有 UI，无需构建（Host 与 Client 都是纯 JS）。

## 限制

- 只读：不能在面板里开关技能、改 `SKILL.md`、或从市场装技能。
- 作用域按「默认 preset + 当前活着的会话」取；只存在于某个非常用 preset、且当前没有任何会话使用它的技能，可能在列表里表现为「会话可见」来源或暂时不出现。
- 技能的显示元数据（title/description）只来自 `SKILL.md` 的 frontmatter，dsh 不提供第二个来源。
