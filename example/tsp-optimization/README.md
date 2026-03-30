# TSP Optimization Example

This example is a small Traveling Salesman Problem optimization task designed for EvoAny.

## Task Overview

The goal is to improve the solver in `tsp.py` so it runs faster while still returning a valid route.

Primary optimization target:

- `solve_tsp_brute_force(cities)` in `tsp.py`

Constraints:

- the returned route must be a valid permutation of city indices
- the distance calculation must remain correct

This makes the task a simple **runtime minimization** problem.

## Files

- `tsp.py`: optimization target
- `benchmark.py`: timing benchmark entry
- `README.md`: English usage notes
- `README_CN.md`: Chinese usage notes

## How To Run Locally

From this directory:

```bash
python benchmark.py
```

The benchmark prints a single number: elapsed time in milliseconds.

Recommended optimization objective:

- `time_ms=min`

## How To Use This Example With EvoAny

The recommended workflow is:

1. copy this example into a fresh local folder
2. initialize it as a git repository
3. push it to GitHub
4. give EvoAny the repository URL and benchmark command

### 1) Create a standalone local repo from this example

Example (bash):

```bash
mkdir -p /tmp/tsp-optimization
cp -r ./example/tsp-optimization/* /tmp/tsp-optimization/
cd /tmp/tsp-optimization
git init
git add .
git commit -m "seed: tsp baseline"
```

Windows PowerShell example:

```powershell
New-Item -ItemType Directory -Force "C:\tmp\tsp-optimization" | Out-Null
Copy-Item -Recurse -Force .\example\tsp-optimization\* C:\tmp\tsp-optimization\
Set-Location C:\tmp\tsp-optimization
git init
git add .
git commit -m "seed: tsp baseline"
```

Run the baseline once before pushing:

```bash
python benchmark.py
```

### 2) Push the repo to GitHub

1. Open GitHub and create a new empty repository, for example `tsp-optimization`.
2. Copy the repository clone URL from the GitHub page.
3. Replace `<your-repo-url>` in the command below with that URL.

```bash
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

Example repository URL:

- `https://github.com/<you>/tsp-optimization`

Example remote command:

```bash
git remote add origin https://github.com/<you>/tsp-optimization.git
```

### 3) Give EvoAny the repository URL

In your AI IDE / agent session, ask EvoAny to optimize the GitHub repository you just created.

```text
Optimize this repository: https://github.com/<you>/tsp-optimization
The benchmark command is: python benchmark.py
The main objective is time_ms=min.
```
