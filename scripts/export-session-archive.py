"""Export retained source data and proof-checked fills without extending backtest inputs."""
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[3]
subprocess.run([str(Path.home()/'.nvm/versions/node/v22.22.1/bin/node'),str(root/'work/hudian-desktop/export-session-history.mjs')],check=True)
