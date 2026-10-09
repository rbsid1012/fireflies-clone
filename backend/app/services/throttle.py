"""A small in-memory failure counter for login attempts (per process; fine for one instance)."""
import time
from collections import defaultdict, deque
from collections.abc import Callable


class FailureThrottle:
    def __init__(self, max_failures: int = 5, window_seconds: int = 900, clock: Callable[[], float] = time.monotonic):
        self.max_failures = max_failures
        self.window = window_seconds
        self.clock = clock
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, key: str) -> deque[float]:
        q = self._failures[key]
        cutoff = self.clock() - self.window
        while q and q[0] < cutoff:
            q.popleft()
        return q

    def blocked(self, key: str) -> bool:
        return len(self._prune(key)) >= self.max_failures

    def record_failure(self, key: str) -> None:
        self._prune(key).append(self.clock())

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)


login_throttle = FailureThrottle()
