"""Large-scale optimizer — evolution target.

Minimizes a 20-dimensional Rosenbrock function using gradient descent.
Three objectives:
  1. steps_to_converge (min) — fewer iterations = faster
  2. final_loss (min)        — lower residual = more accurate
  3. total_gradient_norm (min) — cumulative gradient magnitude = stability proxy
"""

import math
import random as _rng

DIM = 20
MAX_STEPS = 10000
TOL = 1e-6

# Fixed starting point (reproducible).
_rng.seed(42)
X0 = [_rng.uniform(-2.0, 2.0) for _ in range(DIM)]


def rosenbrock(x: list[float]) -> float:
    """N-dimensional Rosenbrock: sum_i [100*(x_{i+1}-x_i^2)^2 + (1-x_i)^2]."""
    return sum(
        100.0 * (x[i + 1] - x[i] ** 2) ** 2 + (1.0 - x[i]) ** 2
        for i in range(len(x) - 1)
    )


def rosenbrock_grad(x: list[float]) -> list[float]:
    """Gradient of the N-dimensional Rosenbrock."""
    n = len(x)
    g = [0.0] * n
    for i in range(n - 1):
        g[i] += -400.0 * x[i] * (x[i + 1] - x[i] ** 2) - 2.0 * (1.0 - x[i])
        g[i + 1] += 200.0 * (x[i + 1] - x[i] ** 2)
    return g


def gradient_descent(
    lr: float = 0.0001,
    momentum: float = 0.0,
    nesterov: bool = False,
    adaptive: bool = False,
    warmup_steps: int = 0,
    grad_clip: float = 5.0,
    lr_decay: float = 0.0,
    beta2: float = 0.0,
    epsilon: float = 1e-8,
) -> dict:
    """Optimize 20-D Rosenbrock.

    Returns dict with 'steps', 'final_loss', 'total_grad_norm'.
    """
    x = list(X0)
    n = len(x)
    v = [0.0] * n           # momentum velocity
    sq_avg = [0.0] * n      # second moment (RMSProp / Adam-like)
    total_grad_norm = 0.0

    for step in range(1, MAX_STEPS + 1):
        loss = rosenbrock(x)
        if loss < TOL:
            return {"steps": step, "final_loss": loss,
                    "total_grad_norm": total_grad_norm}

        # Learning rate schedule.
        current_lr = lr
        if warmup_steps > 0 and step <= warmup_steps:
            current_lr = lr * (step / warmup_steps)
        if lr_decay > 0:
            current_lr = current_lr / (1.0 + lr_decay * step)

        # Compute gradient (optionally at lookahead point).
        if nesterov and momentum > 0:
            x_look = [x[i] - momentum * v[i] for i in range(n)]
            g = rosenbrock_grad(x_look)
        else:
            g = rosenbrock_grad(x)

        # Gradient norm + clipping.
        gnorm = math.sqrt(sum(gi ** 2 for gi in g))
        total_grad_norm += gnorm
        if grad_clip > 0 and gnorm > grad_clip:
            scale = grad_clip / gnorm
            g = [gi * scale for gi in g]

        # Adaptive second moment (RMSProp-like).
        if beta2 > 0:
            for i in range(n):
                sq_avg[i] = beta2 * sq_avg[i] + (1.0 - beta2) * g[i] ** 2
                g[i] = g[i] / (math.sqrt(sq_avg[i]) + epsilon)

        # Momentum update.
        for i in range(n):
            v[i] = momentum * v[i] + current_lr * g[i]
            x[i] -= v[i]

    final_loss = rosenbrock(x)
    return {"steps": MAX_STEPS, "final_loss": final_loss,
            "total_grad_norm": total_grad_norm}


if __name__ == "__main__":
    r = gradient_descent()
    print(f"steps={r['steps']}  loss={r['final_loss']:.6e}  "
          f"grad_norm={r['total_grad_norm']:.2f}")
