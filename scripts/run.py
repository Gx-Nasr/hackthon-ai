"""One-command install, verification, and launch: python3 scripts/run.py [--test]."""
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
PYTHON = ROOT / ".venv/bin/python"


def run(*command):
    subprocess.run(command, check=True)


if not PYTHON.exists():
    run(sys.executable, "-m", "venv", ".venv")
run(str(PYTHON), "-m", "pip", "install", "-r", "requirements.txt")
if not (ROOT / ".env").exists():
    (ROOT / ".env").write_text((ROOT / ".env.example").read_text())
# Defaults complement an existing .env without modifying its keys.
os.environ.setdefault("DATABASE_URL", "file:./uniradar.db")
os.environ.setdefault("VITE_USE_MOCKS", "false")
os.environ.setdefault("COOKIE_MODE", "local")
run("npm", "ci")
run("npx", "prisma", "generate")
run("npx", "prisma", "migrate", "deploy")
run("npm", "run", "typecheck")
run("npm", "run", "build")
if "--test" in sys.argv:
    run(str(PYTHON), "-m", "pytest", "tests/", "-v")
    run(str(PYTHON), "scripts/demo_backend.py", "--offline")
    sys.exit(0)

processes = []


def shutdown(*_):
    for process in reversed(processes):
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
    for process in processes:
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)


signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
try:
    processes.append(subprocess.Popen([str(PYTHON), "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"], start_new_session=True))
    for _ in range(120):
        if processes[0].poll() is not None:
            raise RuntimeError("Python backend failed to start")
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=1):
                break
        except OSError:
            time.sleep(1)
    else:
        raise RuntimeError("Python backend startup timed out")
    env = {**os.environ, "NODE_ENV": "production"}
    processes.append(subprocess.Popen(["npm", "start"], env=env, start_new_session=True))
    print("UniRadar: http://localhost:3000 — create an account and complete your profile.", flush=True)
    while all(process.poll() is None for process in processes):
        time.sleep(1)
    raise RuntimeError("A UniRadar service exited unexpectedly")
except KeyboardInterrupt:
    pass
finally:
    shutdown()
