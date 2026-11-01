"""Encodes the launch film: the rendered frames with the score.

    python3 tools/film/finish.py <frames-dir> <score.wav> <out.mp4>

The score is levelled to -14 LUFS, the loudness online video platforms play at,
and muxed with the frames at 30 fps.
"""

import subprocess
import sys
from pathlib import Path

FRAMES, SCORE, OUT = (Path(a) for a in sys.argv[1:4])
LENGTH = 46.0

subprocess.run(
    ["ffmpeg", "-y", "-framerate", "30", "-i", str(FRAMES / "%05d.jpg"), "-i", str(SCORE),
     "-filter_complex", f"[1]loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000,alimiter=limit=0.84:level=false,atrim=0:{LENGTH}[a]",
     "-map", "0:v", "-map", "[a]",
     "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-tune", "grain", "-pix_fmt", "yuv420p", "-profile:v", "high",
     "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", "-t", str(LENGTH), str(OUT)],
    check=True, capture_output=True,
)
print(f"wrote {OUT}")
