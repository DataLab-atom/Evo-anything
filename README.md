# U2E Plugin — Git-Based Evolutionary Code Optimizer

U2E (Utility-to-Evolution) 是一个基于 git 的演化算法设计引擎。它通过 LLM 驱动的变异、交叉和反思，在任意 git 仓库上自动演化代码，追求更优的 benchmark 表现。

## 安装

### 前置条件

- Python >= 3.11
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Git
- GitHub CLI (`gh`) — 用于 `/hunt` 搜索仓库

### 1. 克隆插件仓库

```bash
git clone https://github.com/DataLab-atom/u2e-plugin.git
cd u2e-plugin
```

### 2. 安装 evo-engine（MCP Server）

```bash
cd plugin/evo-engine
pip install .
```

这会安装 `mcp`、`pydantic` 等依赖，并注册 `evo-engine` 命令。

### 3. 在 Claude Code 中注册插件

在你的项目根目录（或全局）的 `.claude/settings.json` 中添加 MCP server 配置：

```json
{
  "mcpServers": {
    "evo-engine": {
      "command": "evo-engine",
      "type": "stdio"
    }
  }
}
```

### 4. 注册 Skills

将 `plugin/skills/` 下的技能目录复制（或软链接）到你的 Claude Code skills 目录：

```bash
# 软链接方式（推荐，便于更新）
ln -s $(pwd)/plugin/skills/* ~/.claude/skills/
```

### 5. 验证安装

启动 Claude Code，输入 `/status`，如果看到提示 "Evolution not initialized" 说明 MCP server 已连通，插件安装成功。

### 可选配置

演化状态默认存储在 `~/.openclaw/u2e-state/`，可通过环境变量自定义：

```bash
export U2E_STATE_DIR=/path/to/your/state
```

## Quick Start

```
你在 Telegram 发：我要 CIFAR-100-LT 上 SOTA
         ↓
  /hunt 自动触发
         ↓
  搜 GitHub → 找到 3 个候选 → 问你选哪个
         ↓
  你说：用第 1 个
         ↓
  clone → pip install → 下载数据 → 跑基线确认能跑
         ↓
  自动调用 /evolve → 进化循环
         ↓
  每代给你发进度
         ↓
  结束后推最优分支 + 发报告
```

## 工作原理

U2E 将代码优化建模为演化过程，所有实验以 git 分支记录：

1. **分析** — 识别目标函数（哪些代码值得优化）
2. **规划** — 决定变异/交叉策略和每轮变体数量
3. **生成** — 通过 LLM 生成代码变体
4. **评估** — 在隔离的 git worktree 中运行 benchmark
5. **选择** — 保留最优，淘汰其余
6. **反思** — 提取经验教训，写入记忆

每一代的最优结果打 tag（`best-gen-{N}`），最终推送 `best-overall` 分支。

## Skills

| 命令 | 说明 |
|------|------|
| `/hunt <任务描述>` | 搜索 GitHub 找到合适的仓库，自动 clone、安装、跑基线，然后启动演化 |
| `/evolve <repo> <benchmark_cmd>` | 对指定仓库启动演化优化循环 |
| `/status` | 查看当前演化进度 |
| `/report` | 生成完整的演化报告 |
| `/boost <target_id>` | 提升某个优化目标的优先级 |
| `/freeze <target_id>` | 冻结某个目标，停止对它的演化 |

## 目录结构

```
u2e-plugin/
├── LICENSE
├── README.md
└── plugin/
    ├── openclaw.plugin.json   # 插件定义
    ├── AGENTS.md              # 演化协议（核心循环）
    ├── SOUL.md                # Agent 人格设定
    ├── TOOLS.md               # 工具使用约定
    ├── evo-engine/            # 演化引擎（MCP server）
    │   ├── server.py          # MCP 工具接口
    │   ├── models.py          # 数据模型
    │   └── selection.py       # 选择算法
    └── skills/                # 用户可调用的技能
        ├── hunt/              # 搜索并部署代码库
        ├── evolve/            # 启动演化循环
        ├── status/            # 查看进度
        ├── report/            # 生成报告
        ├── boost/             # 提升目标优先级
        └── freeze/            # 冻结目标
```

## 演化记忆

U2E 在目标仓库中维护结构化记忆，避免重复失败的尝试：

```
memory/
├── global/long_term.md           # 跨目标的通用经验
├── targets/{id}/
│   ├── short_term/gen_{N}.md     # 每代反思
│   ├── long_term.md              # 该目标的累积智慧
│   └── failures.md               # 失败记录（不要再试的方向）
└── synergy/records.md            # 跨函数组合实验结果
```

## 分支命名

```
gen-{N}/{target_id}/{op}-{V}          # 单目标变体
gen-{N}/synergy/{targetA}+{targetB}-{V}  # 跨目标组合
```

Tags: `seed-baseline`, `best-gen-{N}`, `best-overall`

## License

MIT
