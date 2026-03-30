# TSP 优化示例

这个示例是一个适合 EvoAny 的小型旅行商问题优化任务。

## 任务介绍

目标是改进 `tsp.py` 中的求解器，在保证返回结果合法的前提下尽量加快运行速度。

主要优化目标：

- `tsp.py` 中的 `solve_tsp_brute_force(cities)`

约束条件：

- 返回的路径必须是城市索引的合法排列
- 距离计算逻辑必须保持正确

因此这是一个比较直接的 **运行时间最小化** 任务。

## 文件说明

- `tsp.py`：主要优化目标
- `benchmark.py`：计时 benchmark 入口
- `README.md`：英文说明
- `README_CN.md`：中文说明

## 本地运行方式

在当前目录下执行：

```bash
python benchmark.py
```

benchmark 会输出一个数字，表示运行时间（毫秒）。

建议优化目标：

- `time_ms=min`

## 如何用这个示例配合 EvoAny

推荐流程如下：

1. 把这个示例复制到一个新的本地目录
2. 把它初始化成独立 git 仓库
3. 推送到 GitHub
4. 把仓库链接和 benchmark 命令交给 EvoAny

### 1）从这个示例创建独立仓库

示例（bash）：

```bash
mkdir -p /tmp/tsp-optimization
cp -r ./example/tsp-optimization/* /tmp/tsp-optimization/
cd /tmp/tsp-optimization
git init
git add .
git commit -m "seed: tsp baseline"
```

Windows PowerShell 示例：

```powershell
New-Item -ItemType Directory -Force "C:\tmp\tsp-optimization" | Out-Null
Copy-Item -Recurse -Force .\example\tsp-optimization\* C:\tmp\tsp-optimization\
Set-Location C:\tmp\tsp-optimization
git init
git add .
git commit -m "seed: tsp baseline"
```

推送前先跑一次基线：

```bash
python benchmark.py
```

### 2）把仓库推到 GitHub

1. 打开 GitHub，新建一个空仓库，例如 `tsp-optimization`
2. 在 GitHub 页面里复制这个仓库的 clone 地址
3. 把下面命令里的 `<your-repo-url>` 替换成刚复制的地址

```bash
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

仓库链接示例：

- `https://github.com/<you>/tsp-optimization`

remote 命令示例：

```bash
git remote add origin https://github.com/<you>/tsp-optimization.git
```

### 3）把仓库链接交给 EvoAny

在你的 AI IDE / agent 会话里，让 EvoAny 优化你刚创建并推送的 GitHub 仓库。

```text
优化这个仓库：https://github.com/<you>/tsp-optimization
benchmark 命令是：python benchmark.py
主要目标是 time_ms=min。
```
