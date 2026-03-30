# 飞机降落调度示例

这个示例提供了一个可以直接配合 EvoAny 使用的飞机降落调度优化任务。

## 任务介绍

核心目标是优化 `evo_func.py` 中的调度器。

对于每架飞机，求解器需要决定：

- 一个合法的降落时间
- 一条合法的跑道

所有降落安排都必须满足时间窗约束和飞机之间的间隔约束。如果两架飞机被分配到同一条跑道，它们的降落时间必须满足实例中定义的 separation 要求。

最终目标是在保证可行性的前提下，尽量降低总提前/延误惩罚。评测器会把结果转成归一化分数，因此从 EvoAny 的角度看，这个任务更适合作为 **分数最大化** 问题。

主要优化目标：

- `evo_func.py` 中的 `solve(**kwargs)`

## 文件说明

- `evo_func.py`：主要优化目标
- `evaluate.py`：评测入口
- `config.py`：数据加载、打分、归一化、dev 划分
- `data/`：评测数据

## 本地运行方式

在当前目录下执行：

```bash
python evaluate.py
```

脚本会输出：

- 每个 case 的原始 penalty
- 汇总后的 `score`
- `dev_score`
- `test_score`

建议优化目标：

- `score=max`

## 如何用这个示例配合 EvoAny

推荐流程如下：

1. 把这个示例复制到一个新的本地目录
2. 把它初始化成独立 git 仓库
3. 推送到 GitHub
4. 把仓库链接和 benchmark 命令交给 EvoAny

### 1）从这个示例创建独立仓库

示例（bash）：

```bash
mkdir -p /tmp/aircraft-landing
cp -r ./example/AircraftLanding/* /tmp/aircraft-landing/
cd /tmp/aircraft-landing
git init
git add .
git commit -m "seed: aircraft landing baseline"
```

Windows PowerShell 示例：

```powershell
New-Item -ItemType Directory -Force "C:\tmp\aircraft-landing" | Out-Null
Copy-Item -Recurse -Force .\example\AircraftLanding\* C:\tmp\aircraft-landing\
Set-Location C:\tmp\aircraft-landing
git init
git add .
git commit -m "seed: aircraft landing baseline"
```

推送前先跑一次基线：

```bash
python evaluate.py
```

### 2）把仓库推到 GitHub

1. 打开 GitHub，新建一个空仓库，例如 `aircraft-landing`
2. 在 GitHub 页面里复制这个仓库的 clone 地址
3. 把下面命令里的 `<your-repo-url>` 替换成刚复制的地址

```bash
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

仓库链接示例：

- `https://github.com/<you>/aircraft-landing`

remote 命令示例：

```bash
git remote add origin https://github.com/<you>/aircraft-landing.git
```

### 3）把仓库链接交给 EvoAny

在你的 AI IDE / agent 会话里，让 EvoAny 优化你刚创建并推送的 GitHub 仓库。

```text
优化这个仓库：https://github.com/<you>/aircraft-landing
benchmark 命令是：python evaluate.py
主要目标是 score=max。
```
