"""Speaks the voiceover, one file per scene, with subtitle timings.

    python3 tools/video/voice.py <out-dir> [lines.json] [rate] [pitch]

Uses Microsoft's neural voice en-NG-AbeoNeural (Nigerian English, male) through
the edge-tts package (pip install edge-tts). The lines default to lines.json
beside this script; the launch film uses tools/film/lines.json at -8% and -2Hz.
"""

import json
import subprocess
import sys
from pathlib import Path

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
lines = json.loads(Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).parent / "lines.json").read_text())
rate = sys.argv[3] if len(sys.argv) > 3 else "-6%"
pitch = sys.argv[4] if len(sys.argv) > 4 else "+0Hz"
for scene, text in lines:
    subprocess.run(
        ["edge-tts", "--voice", "en-NG-AbeoNeural", f"--rate={rate}", f"--pitch={pitch}", "--text", text,
         "--write-media", str(out / f"{scene}.mp3"), "--write-subtitles", str(out / f"{scene}.srt")],
        check=True,
    )
    print(f"spoke {scene}")
