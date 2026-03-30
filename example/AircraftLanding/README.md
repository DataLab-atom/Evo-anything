# Aircraft Landing Scheduling Example

This example packages a small aircraft landing scheduling task that can be used directly with EvoAny.

## Task Overview

The goal is to optimize the scheduler in `evo_func.py`.

For each aircraft, the solver must decide:

- a landing time within the allowed time window
- a runway assignment within the available runway count

The solution must satisfy separation constraints between aircraft. If two planes land on the same runway, their landing times must respect the required gap defined by the instance.

The optimization objective is to reduce total earliness/lateness penalty while keeping the schedule feasible. The evaluator reports normalized scores, so in practice this example is a **score maximization** task.

Primary optimization target:

- `solve(**kwargs)` in `evo_func.py`

## Files

- `evo_func.py`: optimization target
- `evaluate.py`: benchmark / evaluation entry
- `config.py`: data loading, scoring, normalization, dev split
- `data/`: benchmark cases

## How To Run Locally

From this directory:

```bash
python evaluate.py
```

The script prints:

- raw penalty for each case
- aggregate `score`
- `dev_score`
- `test_score`

Recommended optimization objective:

- `score=max`

## How To Use This Example With EvoAny

The recommended workflow is:

1. copy this example into a fresh local folder
2. initialize it as a git repository
3. push it to GitHub
4. give EvoAny the repository URL and benchmark command

### 1) Create a standalone local repo from this example

Example (bash):

```bash
mkdir -p /tmp/aircraft-landing
cp -r ./example/AircraftLanding/* /tmp/aircraft-landing/
cd /tmp/aircraft-landing
git init
git add .
git commit -m "seed: aircraft landing baseline"
```

Windows PowerShell example:

```powershell
New-Item -ItemType Directory -Force "C:\tmp\aircraft-landing" | Out-Null
Copy-Item -Recurse -Force .\example\AircraftLanding\* C:\tmp\aircraft-landing\
Set-Location C:\tmp\aircraft-landing
git init
git add .
git commit -m "seed: aircraft landing baseline"
```

Run the baseline once before pushing:

```bash
python evaluate.py
```

### 2) Push the repo to GitHub

1. Open GitHub and create a new empty repository, for example `aircraft-landing`.
2. Copy the repository clone URL from the GitHub page.
3. Replace `<your-repo-url>` in the command below with that URL.

```bash
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

Example repository URL:

- `https://github.com/<you>/aircraft-landing`

Example remote command:

```bash
git remote add origin https://github.com/<you>/aircraft-landing.git
```

### 3) Give EvoAny the repository URL

In your AI IDE / agent session, ask EvoAny to optimize the GitHub repository you just created.

```text
Optimize this repository: https://github.com/<you>/aircraft-landing
The benchmark command is: python evaluate.py
The main objective is score=max.
```
