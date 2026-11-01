"""Mixes and encodes the launch film.

    python3 tools/film/finish.py <frames-dir> <voice-dir> <score.wav> <out.mp4>

Each line of voice (from tools/film/lines.json, spoken by edge-tts as
en-NG-AbeoNeural) is placed at its cue; the score ducks under the voice; the
mix is levelled to -16 LUFS and muxed with the frames at 30 fps.
"""

import subprocess
import sys
from pathlib import Path

FRAMES, VOICE, SCORE, OUT = (Path(a) for a in sys.argv[1:5])
# When each line starts, in seconds, matched to the picture in film.html.
CUES = {"v01": 1.9, "v02": 7.2, "v03": 13.3, "v04": 20.6, "v05": 24.0, "v06": 29.8,
        "v07": 37.4, "v08": 49.0, "v09": 55.6, "v10": 62.0, "v11": 68.0, "v12": 74.0}
LENGTH = 80.0

inputs, chains = ["-i", str(SCORE)], []
# Input 0 is the frames and input 1 the score, so the voices start at 2.
for i, (name, at) in enumerate(CUES.items(), start=2):
    inputs += ["-i", str(VOICE / f"{name}.mp3")]
    ms = int(at * 1000)
    chains.append(f"[{i}]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[v{i}]")
voices = "".join(f"[v{i}]" for i in range(2, len(CUES) + 2))
graph = ";".join(chains) + (
    f";{voices}amix=inputs={len(CUES)}:normalize=0,apad,atrim=0:{LENGTH},"
    "highpass=f=80,acompressor=threshold=-22dB:ratio=3:attack=6:release=120,volume=2.2,asplit[vo][key]"
    ";[1]aresample=48000,volume=0.9[music]"
    ";[music][key]sidechaincompress=threshold=0.025:ratio=7:attack=25:release=420:makeup=1[ducked]"
    f";[vo][ducked]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,atrim=0:{LENGTH}[a]"
)
subprocess.run(
    ["ffmpeg", "-y", "-framerate", "30", "-i", str(FRAMES / "%05d.jpg"), *inputs,
     "-filter_complex", graph, "-map", "0:v", "-map", "[a]",
     "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high",
     "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-t", str(LENGTH), str(OUT)],
    check=True, capture_output=True,
)
print(f"wrote {OUT}")
