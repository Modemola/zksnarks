"""Speaks the voiceover, one file per scene, with subtitle timings.

    python3 tools/video/voice.py <out-dir>

Uses Microsoft's neural voice en-NG-AbeoNeural (Nigerian English, male) through
the edge-tts package (pip install edge-tts). The lines are in lines.json.
"""

import json
import subprocess
import sys
from pathlib import Path

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
lines = json.loads((Path(__file__).parent / "lines.json").read_text())
for scene, text in lines:
    subprocess.run(
        ["edge-tts", "--voice", "en-NG-AbeoNeural", "--rate=-6%", "--text", text,
         "--write-media", str(out / f"{scene}.mp3"), "--write-subtitles", str(out / f"{scene}.srt")],
        check=True,
    )
    print(f"spoke {scene}")
