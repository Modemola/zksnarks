"""Cuts the demo video from the recorded scenes, the voiceover and the end card.

    python3 tools/video/edit.py <recordings> <voice> <endcard.png> <fonts-dir> <out.mp4>

<recordings> is what tools/video/record.mjs wrote: a folder per scene, each with
JPEG frames and frames.json. <voice> holds one <scene>.mp3 and <scene>.srt per
scene from tools/video/voice.py. Each scene lasts as long as its line of voice
(or its recording, if that is longer), captions are burned in from the voice's
own timings, and the last scene dissolves into the end card.
"""

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageStat

REC, VOICE, CARD, FONTS, OUT = (Path(a) for a in sys.argv[1:6])
FPS = 30
LEAD = 0.35  # seconds of picture before each line of voice
TAIL = 0.6  # seconds of picture after each line of voice
END_HOLD = 2.4  # seconds the end card stays after the last word
SPEED = {"08-terminal": 1.25}  # the typing runs a little faster than real time
SCENES = sorted(p.name for p in REC.iterdir() if (p / "frames.json").exists())
work = Path(tempfile.mkdtemp(prefix="unseal-edit-"))


def run(*args):
    subprocess.run(args, check=True, capture_output=True)


def duration(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
    return float(out)


def blank(path):
    """A frame drawn before the page painted: almost one flat colour."""
    im = Image.open(path).convert("L").resize((96, 54))
    return ImageStat.Stat(im).stddev[0] < 6


def scene_clip(name):
    """Rebuilds a scene at a constant 30 fps from its timestamped frames."""
    meta = json.loads((REC / name / "frames.json").read_text())
    frames = meta["frames"]
    while len(frames) > 1 and blank(REC / name / frames[0]["file"]):
        frames = frames[1:]
    # One picture per output frame: whichever frame was on screen at that moment.
    speed = SPEED.get(name, 1)
    seq = work / name
    seq.mkdir()
    t0, length = frames[0]["t"], (meta["end"] - frames[0]["t"]) / speed
    j = 0
    for k in range(int(length * FPS)):
        at = t0 + k / FPS * speed
        while j + 1 < len(frames) and frames[j + 1]["t"] <= at:
            j += 1
        (seq / f"{k:05d}.jpg").symlink_to(REC / name / frames[j]["file"])
    clip = work / f"{name}.mp4"
    run("ffmpeg", "-y", "-framerate", str(FPS), "-i", str(seq / "%05d.jpg"),
        "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p",
        "-c:v", "libx264", "-preset", "slow", "-crf", "16", str(clip))
    return clip


def fit(clip, length, name):
    """Holds the last frame, or trims, so the clip lasts exactly `length` seconds."""
    out = work / f"{name}-fit.mp4"
    extra = max(0.0, length - duration(clip))
    run("ffmpeg", "-y", "-i", str(clip), "-vf", f"tpad=stop_mode=clone:stop_duration={extra:.3f}",
        "-t", f"{length:.3f}", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", str(out))
    return out


def srt(path):
    """Cues from an SRT file as (start, end, text) in seconds."""
    stamp = lambda s: sum(float(x) * m for x, m in zip(re.split("[:,]", s), (3600, 60, 1, 0.001)))
    cues = []
    for block in path.read_text().strip().split("\n\n"):
        rows = block.strip().split("\n")
        a, b = rows[1].split(" --> ")
        cues.append((stamp(a), stamp(b), " ".join(rows[2:])))
    return cues


def chunks(text, limit=84):
    """Splits a sentence into caption-sized pieces at natural breaks."""
    words, parts, cur = text.split(), [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > limit:
            parts.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
        if cur.endswith((",", ":", ";")) and len(cur) > limit * 0.55:
            parts.append(cur)
            cur = ""
    if cur:
        parts.append(cur)
    return parts


def wrap(text, width=44):
    """Two balanced lines for anything longer than one."""
    if len(text) <= width:
        return text
    words, best = text.split(), None
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        score = max(len(a), len(b))
        if best is None or score < best[0]:
            best = (score, a + "\\N" + b)
    return best[1]


# Captions show what is meant, not how the voice was told to say it.
SHOWN = [("I.D. ", "ID "), ("I.D.", "ID."), ("Zero point zero zero one Zcash", "0.001 ZEC"),
         ("to one Zcash", "to 1 ZEC"), ("zip three eleven", "ZIP 311")]


def shown(text):
    for said, meant in SHOWN:
        text = text.replace(said, meant)
    return text


def ass_time(t):
    h, rem = divmod(max(t, 0), 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


# 1. Each scene's length: its line of voice with a little room, or its recording if longer.
clips, slots, voice_at = {}, {}, {}
for name in SCENES:
    clips[name] = scene_clip(name)
    spoken = duration(VOICE / f"{name}.mp3")
    last = name == SCENES[-1]
    slots[name] = LEAD + spoken + (END_HOLD if last else max(TAIL, duration(clips[name]) - LEAD - spoken))

# 2. The picture: scenes back to back; the last dissolves into the end card as its final sentence starts.
t, parts = 0.0, []
for name in SCENES:
    voice_at[name] = t + LEAD
    if name == SCENES[-1]:
        final_cue = next(c[0] for c in srt(VOICE / f"{name}.srt") if c[2].startswith("Unseal"))
        before = LEAD + final_cue - 0.4
        head = fit(clips[name], before + 0.8, name)
        card = work / "card.mp4"
        run("ffmpeg", "-y", "-loop", "1", "-i", str(CARD), "-t", f"{slots[name] - before + 0.8:.3f}", "-r", str(FPS),
            "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "16", str(card))
        last = work / "last.mp4"
        run("ffmpeg", "-y", "-i", str(head), "-i", str(card), "-filter_complex",
            f"[0][1]xfade=transition=fade:duration=0.8:offset={before:.3f},format=yuv420p",
            "-c:v", "libx264", "-preset", "slow", "-crf", "16", str(last))
        parts.append(last)
    else:
        parts.append(fit(clips[name], slots[name], name))
    t += slots[name]
total = t

listing = work / "parts.txt"
listing.write_text("".join(f"file '{p}'\n" for p in parts))
picture = work / "picture.mp4"
run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(picture))

# 3. Captions from the voice's own timings, a sentence at a time, split to fit two lines.
events = []
for name in SCENES:
    for start, end, text in srt(VOICE / f"{name}.srt"):
        pieces = chunks(shown(text))
        span, weight = end - start, sum(len(p) for p in pieces)
        at = start
        for p in pieces:
            dur = span * len(p) / weight
            events.append((voice_at[name] + at, voice_at[name] + at + dur, wrap(p)))
            at += dur
# Cues can overlap by a few milliseconds; each ends where the next begins.
events.sort()
events = [(a, min(b, events[i + 1][0] - 0.02) if i + 1 < len(events) else b, x) for i, (a, b, x) in enumerate(events)]
ass = work / "captions.ass"
ass.write_text(
    "[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 2\n\n"
    "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
    "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
    "Style: Caption,IBM Plex Sans Medium,46,&H00FFFFFF,&H00FFFFFF,&H3A1C1715,&H3A1C1715,0,0,0,0,100,100,0,0,3,16,0,2,160,160,64,1\n\n"
    "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    + "".join(f"Dialogue: 0,{ass_time(a)},{ass_time(min(b, total - 0.2))},Caption,,0,0,0,,{text}\n" for a, b, text in events)
)

# 4. The voice: every line at its place, levelled for speech.
inputs, filters = [], []
for i, name in enumerate(SCENES):
    inputs += ["-i", str(VOICE / f"{name}.mp3")]
    ms = int(voice_at[name] * 1000)
    filters.append(f"[{i}]aresample=48000,adelay={ms}|{ms}[v{i}]")
mix = "".join(f"[v{i}]" for i in range(len(SCENES)))
voice = work / "voice.m4a"
run("ffmpeg", "-y", *inputs, "-filter_complex",
    ";".join(filters) + f";{mix}amix=inputs={len(SCENES)}:normalize=0,apad,atrim=0:{total:.3f},"
    "highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000,"
    f"afade=t=out:st={total - 0.8:.3f}:d=0.8",
    "-ac", "2", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", str(voice))

# 5. Everything together, with a short fade from and to black.
run("ffmpeg", "-y", "-i", str(picture), "-i", str(voice), "-filter_complex",
    f"[0]ass={ass}:fontsdir={FONTS},fade=t=in:st=0:d=0.5,fade=t=out:st={total - 0.6:.3f}:d=0.6,format=yuv420p[v]",
    "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high",
    "-c:a", "copy", "-movflags", "+faststart", "-t", f"{total:.3f}", str(OUT))
print(f"wrote {OUT}: {total:.1f} s, {len(events)} captions")
