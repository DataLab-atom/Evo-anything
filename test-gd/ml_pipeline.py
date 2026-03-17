"""Mini ML training pipeline with 4 independently optimizable functions.

Trains a simple 2-layer neural network on a synthetic classification task.
Each function is an evolution target that can be independently mutated.

Targets:
  1. compute_loss    — loss function (cross-entropy variant)
  2. update_weights  — optimizer step (SGD variant)
  3. schedule_lr     — learning rate schedule
  4. init_weights    — weight initialization strategy

The 3 objectives measured on the full pipeline:
  - final_loss (min)       — training loss after all epochs
  - accuracy (max→min: we return 1-accuracy so all objectives are min)
  - total_time_steps (min) — proxy for compute cost (epochs * batch_ops)
"""

from __future__ import annotations
import math
import random

# ---------------------------------------------------------------------------
# Synthetic dataset: 2D spiral classification (3 classes, 300 points)
# ---------------------------------------------------------------------------

def make_spiral_data(n_points: int = 50, n_classes: int = 3, seed: int = 42):
    rng = random.Random(seed)
    X, Y = [], []
    for cls in range(n_classes):
        for i in range(n_points):
            r = i / n_points
            t = cls * 4.0 + r * 4.0 + rng.gauss(0, 0.2)
            X.append([r * math.cos(t), r * math.sin(t)])
            Y.append(cls)
    return X, Y

DATA_X, DATA_Y = make_spiral_data()
N_CLASSES = 3
INPUT_DIM = 2
HIDDEN_DIM = 16

# ---------------------------------------------------------------------------
# Target 1: compute_loss
# ---------------------------------------------------------------------------

def compute_loss(
    logits: list[list[float]],
    targets: list[int],
    label_smoothing: float = 0.0,
    focal_gamma: float = 0.0,
    l2_reg: float = 0.0,
    weights_flat: list[float] | None = None,
) -> float:
    """Cross-entropy loss with optional label smoothing, focal modulation, L2 reg."""
    n = len(targets)
    if n == 0:
        return 0.0
    total = 0.0
    for i in range(n):
        row = logits[i]
        max_val = max(row)
        exp_vals = [math.exp(v - max_val) for v in row]
        sum_exp = sum(exp_vals)
        log_probs = [math.log(e / sum_exp + 1e-12) for e in exp_vals]

        if label_smoothing > 0:
            n_cls = len(row)
            smooth = label_smoothing / n_cls
            target_probs = [(1.0 - label_smoothing) + smooth if c == targets[i]
                            else smooth for c in range(n_cls)]
            loss_i = -sum(p * lp for p, lp in zip(target_probs, log_probs))
        else:
            loss_i = -log_probs[targets[i]]

        if focal_gamma > 0:
            pt = math.exp(-loss_i)
            loss_i = ((1 - pt) ** focal_gamma) * loss_i

        total += loss_i

    avg = total / n

    if l2_reg > 0 and weights_flat:
        avg += l2_reg * sum(w * w for w in weights_flat)

    return avg


# ---------------------------------------------------------------------------
# Target 2: update_weights
# ---------------------------------------------------------------------------

def update_weights(
    weights: list[float],
    grads: list[float],
    velocities: list[float],
    lr: float,
    momentum: float = 0.0,
    nesterov: bool = False,
    weight_decay: float = 0.0,
    grad_clip: float = 0.0,
) -> tuple[list[float], list[float]]:
    """SGD step with optional momentum, nesterov, weight decay, grad clipping."""
    n = len(weights)

    # Gradient clipping.
    if grad_clip > 0:
        gnorm = math.sqrt(sum(g * g for g in grads))
        if gnorm > grad_clip:
            scale = grad_clip / gnorm
            grads = [g * scale for g in grads]

    new_w = list(weights)
    new_v = list(velocities)

    for i in range(n):
        g = grads[i]
        if weight_decay > 0:
            g += weight_decay * weights[i]

        if momentum > 0:
            new_v[i] = momentum * velocities[i] + g
            if nesterov:
                update = g + momentum * new_v[i]
            else:
                update = new_v[i]
        else:
            new_v[i] = g
            update = g

        new_w[i] = weights[i] - lr * update

    return new_w, new_v


# ---------------------------------------------------------------------------
# Target 3: schedule_lr
# ---------------------------------------------------------------------------

def schedule_lr(
    base_lr: float,
    step: int,
    total_steps: int,
    schedule: str = "constant",
    warmup_frac: float = 0.0,
    min_lr_frac: float = 0.0,
) -> float:
    """Learning rate scheduler.

    Schedules: 'constant', 'cosine', 'linear', 'step'.
    """
    lr = base_lr

    # Warmup.
    warmup_steps = int(total_steps * warmup_frac)
    if warmup_steps > 0 and step < warmup_steps:
        lr = base_lr * (step + 1) / warmup_steps

    # Decay phase.
    elif schedule == "cosine":
        progress = (step - warmup_steps) / max(1, total_steps - warmup_steps)
        min_lr = base_lr * min_lr_frac
        lr = min_lr + 0.5 * (base_lr - min_lr) * (1.0 + math.cos(math.pi * progress))
    elif schedule == "linear":
        progress = (step - warmup_steps) / max(1, total_steps - warmup_steps)
        min_lr = base_lr * min_lr_frac
        lr = base_lr - (base_lr - min_lr) * progress
    elif schedule == "step":
        # Halve every 25% of total.
        quarter = max(1, total_steps // 4)
        decays = (step - warmup_steps) // quarter
        lr = base_lr * (0.5 ** decays)

    return max(lr, base_lr * min_lr_frac) if min_lr_frac > 0 else max(lr, 1e-8)


# ---------------------------------------------------------------------------
# Target 4: init_weights
# ---------------------------------------------------------------------------

def init_weights(
    fan_in: int,
    fan_out: int,
    method: str = "xavier",
    gain: float = 1.0,
    seed: int = 0,
) -> list[float]:
    """Initialize a weight matrix (flattened).

    Methods: 'xavier', 'he', 'lecun', 'uniform', 'normal'.
    """
    rng = random.Random(seed)
    n = fan_in * fan_out

    if method == "xavier":
        std = gain * math.sqrt(2.0 / (fan_in + fan_out))
    elif method == "he":
        std = gain * math.sqrt(2.0 / fan_in)
    elif method == "lecun":
        std = gain * math.sqrt(1.0 / fan_in)
    elif method == "normal":
        std = gain * 0.01
    elif method == "uniform":
        limit = gain * math.sqrt(6.0 / (fan_in + fan_out))
        return [rng.uniform(-limit, limit) for _ in range(n)]
    else:
        std = gain * 0.01

    return [rng.gauss(0, std) for _ in range(n)]


# ---------------------------------------------------------------------------
# Forward pass (fixed — not an evolution target)
# ---------------------------------------------------------------------------

def forward(X: list[list[float]], w1: list[float], b1: list[float],
            w2: list[float], b2: list[float]) -> list[list[float]]:
    """2-layer network: input → ReLU hidden → logits."""
    batch_size = len(X)
    hidden = []
    for i in range(batch_size):
        h = []
        for j in range(HIDDEN_DIM):
            val = b1[j]
            for k in range(INPUT_DIM):
                val += X[i][k] * w1[j * INPUT_DIM + k]
            h.append(max(0.0, val))  # ReLU
        hidden.append(h)

    logits = []
    for i in range(batch_size):
        out = []
        for j in range(N_CLASSES):
            val = b2[j]
            for k in range(HIDDEN_DIM):
                val += hidden[i][k] * w2[j * HIDDEN_DIM + k]
            out.append(val)
        logits.append(out)

    return logits


def numerical_grad(X, Y, w1, b1, w2, b2, loss_fn, loss_kwargs, eps=1e-4):
    """Finite-difference gradient for all parameters."""
    all_params = [w1, b1, w2, b2]
    all_grads = []
    for params in all_params:
        g = []
        for idx in range(len(params)):
            old = params[idx]
            params[idx] = old + eps
            logits_p = forward(X, w1, b1, w2, b2)
            l_p = loss_fn(logits_p, Y, **loss_kwargs, weights_flat=w1 + w2)

            params[idx] = old - eps
            logits_m = forward(X, w1, b1, w2, b2)
            l_m = loss_fn(logits_m, Y, **loss_kwargs, weights_flat=w1 + w2)

            g.append((l_p - l_m) / (2 * eps))
            params[idx] = old
        all_grads.append(g)
    return all_grads


# ---------------------------------------------------------------------------
# Full training loop (combines all 4 targets)
# ---------------------------------------------------------------------------

def train(
    # Target 1: compute_loss params
    label_smoothing: float = 0.0,
    focal_gamma: float = 0.0,
    l2_reg: float = 0.0,
    # Target 2: update_weights params
    base_lr: float = 0.01,
    momentum: float = 0.0,
    nesterov: bool = False,
    weight_decay: float = 0.0,
    grad_clip: float = 0.0,
    # Target 3: schedule_lr params
    schedule: str = "constant",
    warmup_frac: float = 0.0,
    min_lr_frac: float = 0.0,
    # Target 4: init_weights params
    init_method: str = "xavier",
    init_gain: float = 1.0,
    # Training config
    epochs: int = 30,
    batch_size: int = 50,
) -> dict:
    """Train and return metrics."""
    # Initialize weights.
    w1 = init_weights(INPUT_DIM, HIDDEN_DIM, method=init_method, gain=init_gain, seed=7)
    b1 = [0.0] * HIDDEN_DIM
    w2 = init_weights(HIDDEN_DIM, N_CLASSES, method=init_method, gain=init_gain, seed=13)
    b2 = [0.0] * N_CLASSES

    n_samples = len(DATA_X)
    total_steps = epochs * ((n_samples + batch_size - 1) // batch_size)
    global_step = 0

    # Velocities for optimizer.
    v_w1 = [0.0] * len(w1)
    v_b1 = [0.0] * HIDDEN_DIM
    v_w2 = [0.0] * len(w2)
    v_b2 = [0.0] * N_CLASSES

    loss_kwargs = {"label_smoothing": label_smoothing, "focal_gamma": focal_gamma,
                   "l2_reg": l2_reg}

    final_loss = float("inf")
    total_batch_ops = 0

    for epoch in range(epochs):
        # Shuffle indices.
        rng = random.Random(epoch)
        indices = list(range(n_samples))
        rng.shuffle(indices)

        epoch_loss = 0.0
        n_batches = 0

        for start in range(0, n_samples, batch_size):
            batch_idx = indices[start:start + batch_size]
            X_batch = [DATA_X[i] for i in batch_idx]
            Y_batch = [DATA_Y[i] for i in batch_idx]

            lr = schedule_lr(base_lr, global_step, total_steps,
                             schedule=schedule, warmup_frac=warmup_frac,
                             min_lr_frac=min_lr_frac)

            # Forward + loss.
            logits = forward(X_batch, w1, b1, w2, b2)
            loss = compute_loss(logits, Y_batch, **loss_kwargs,
                                weights_flat=w1 + w2)

            # Backward (numerical gradient).
            g_w1, g_b1, g_w2, g_b2 = numerical_grad(
                X_batch, Y_batch, w1, b1, w2, b2, compute_loss, loss_kwargs)

            # Update all params.
            w1, v_w1 = update_weights(w1, g_w1, v_w1, lr, momentum, nesterov,
                                      weight_decay, grad_clip)
            b1, v_b1 = update_weights(b1, g_b1, v_b1, lr, momentum, nesterov,
                                      weight_decay, grad_clip)
            w2, v_w2 = update_weights(w2, g_w2, v_w2, lr, momentum, nesterov,
                                      weight_decay, grad_clip)
            b2, v_b2 = update_weights(b2, g_b2, v_b2, lr, momentum, nesterov,
                                      weight_decay, grad_clip)

            epoch_loss += loss
            n_batches += 1
            global_step += 1
            total_batch_ops += 1

        final_loss = epoch_loss / max(1, n_batches)

    # Compute accuracy on full dataset.
    logits = forward(DATA_X, w1, b1, w2, b2)
    correct = 0
    for i in range(n_samples):
        pred = logits[i].index(max(logits[i]))
        if pred == DATA_Y[i]:
            correct += 1
    accuracy = correct / n_samples

    return {
        "final_loss": final_loss,
        "accuracy": accuracy,
        "total_batch_ops": total_batch_ops,
    }


if __name__ == "__main__":
    r = train()
    print(f"loss={r['final_loss']:.6f}  acc={r['accuracy']:.4f}  "
          f"ops={r['total_batch_ops']}")
