"""Writes the launch film's score, synthesized from scratch and timed to the cut.

    python3 tools/film/score.py <out.wav>

D minor. A sub drone and a slow pad carry the story; a soft plucked pulse enters
with the product; bells mark the three pools; three impacts land on the stamp,
the crack and the forgery; the end resolves to D major. Needs numpy and scipy.
"""

import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
LENGTH = 80.0
N = int(SR * LENGTH)
rng = np.random.default_rng(311)
mix = np.zeros((2, N))


def hz(note):
    """Note name such as 'D3' or 'Bb4' to frequency."""
    names = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    name, octave = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((names[name] + 12 * (octave + 1) - 69) / 12)


def place(sig, at, gain=1.0, pan=0.0):
    """Adds a mono or stereo signal at `at` seconds."""
    i = int(at * SR)
    if sig.ndim == 1:
        sig = np.vstack([sig * np.sqrt(0.5 * (1 - pan)), sig * np.sqrt(0.5 * (1 + pan))])
    n = min(sig.shape[1], N - i)
    if n > 0:
        mix[:, i:i + n] += gain * sig[:, :n]


def env(n, attack, release, hold=None):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    r = np.clip((n / SR - t) / max(release, 1e-4), 0, 1)
    return np.minimum(a, r) ** 1.5


def lowpass(x, cutoff, order=2):
    return sosfilt(butter(order, cutoff, "low", fs=SR, output="sos"), x)


def pad(notes, dur, gain=0.11, cutoff=1400):
    """Detuned saws, softened: a slow, warm chord."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for k, note in enumerate(notes):
        f = hz(note)
        for side, det in ((0, -0.08), (1, 0.08)):
            for d in (det, -det * 0.5):
                ph = rng.uniform(0, 1)
                saw = 2 * ((f * (1 + d / 100) * t + ph) % 1) - 1
                out[side] += saw / len(notes)
    out = np.vstack([lowpass(out[0], cutoff, 4), lowpass(out[1], cutoff, 4)])
    return gain * out * env(n, dur * 0.35, dur * 0.4)


def drone(note, dur, gain=0.18):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(note)
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) + 0.08 * np.sin(2 * np.pi * 3 * f * t)
    return gain * s * env(n, 1.5, 2.0)


def pluck(note, dur=0.9, gain=0.09):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(note)
    s = sum(np.sin(2 * np.pi * f * h * t) / h ** 1.6 for h in range(1, 6))
    return gain * lowpass(s * np.exp(-t * 6.0), 3500)


def bell(note, dur=4.0, gain=0.16):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(note)
    parts = [(1.0, 1.0, 1.2), (2.01, 0.5, 2.0), (2.76, 0.32, 2.8), (5.4, 0.12, 4.5), (8.93, 0.05, 6.0)]
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in parts)
    return gain * s * np.clip(t / 0.004, 0, 1)


def impact(gain=0.55, low=True):
    dur = 3.5
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 32 + 70 * np.exp(-t * 7)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    noise = lowpass(rng.standard_normal(n), 900) * np.exp(-t * 9) * 0.6
    s = (boom if low else 0) + noise
    return gain * s * np.clip(t / 0.003, 0, 1)


def riser(dur, gain=0.12):
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = t / dur
    noise = rng.standard_normal(n)
    # A swept band of noise: the cutoff climbs across the riser.
    out = np.zeros(n)
    blocks = 40
    for b in range(blocks):
        a, z = b * n // blocks, (b + 1) * n // blocks
        cut = 300 + 7000 * (b / blocks) ** 2
        out[a:z] = lowpass(noise, cut)[a:z]
    tone = np.sin(2 * np.pi * np.cumsum(220 + 660 * k ** 2) / SR) * 0.25
    return gain * (out + tone) * k ** 2.2


def shimmer(notes, dur=6.0, gain=0.06):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * hz(x) * t) * (1 + 0.3 * np.sin(2 * np.pi * (3 + i) * t)) for i, x in enumerate(notes))
    return gain * s / len(notes) * env(n, 0.05, dur * 0.8)


# 0 to 6 s: a drone, and the stamp.
place(drone("D2", 7.0, 0.16), 0.0)
place(impact(0.5), 1.72)
place(bell("D5", 5.0, 0.07), 1.75, pan=0.1)

# 6 to 13 s: the ledger, a chord settling in.
place(pad(["D3", "A3", "E4", "F4"], 8.0, 0.10, 1100), 5.6)
place(drone("D2", 8.0, 0.12), 6.0)

# 13 to 20 s: the problem, darker and rising; the key turns at 15.9.
place(pad(["Bb2", "F3", "D4", "Eb4"], 7.4, 0.11, 1500), 12.8)
place(drone("Bb1", 7.2, 0.14), 13.0)
place(impact(0.28, low=False), 15.95)
place(riser(3.2, 0.10), 16.9)

# 20 to 29 s: a breath of silence, then the crack, and the name in D major.
place(drone("D2", 3.4, 0.10), 20.2)
place(riser(2.1, 0.12), 21.05)
place(impact(0.6), 23.12)
place(shimmer(["D5", "F#5", "A5", "E6"], 6.0, 0.07), 23.15)
place(pad(["D3", "A3", "F#4", "E4"], 6.4, 0.10, 1800), 23.1)

# 29 to 48 s: the product. A plucked pulse over D minor, B flat, F, C.
beat = 60 / 100
prog = [["D4", "A4", "F4", "A4"], ["Bb3", "F4", "D4", "F4"], ["F4", "C5", "A4", "C5"], ["C4", "G4", "E4", "G4"]]
roots = ["D2", "Bb1", "F2", "C2"]
chords = [["D3", "A3", "F4"], ["Bb2", "F3", "D4"], ["F3", "C4", "A4"], ["C3", "G3", "E4"]]
t = 29.4
bar = 0
while t < 47.6:
    for i in range(8):
        note = prog[bar % 4][i % 4]
        place(pluck(note, 0.8, 0.07 if i % 2 == 0 else 0.05), t + i * beat / 2, pan=(-0.35 if i % 2 else 0.35))
    place(pad(chords[bar % 4], 4 * beat + 0.6, 0.07, 1300), t - 0.3)
    place(drone(roots[bar % 4], 4 * beat + 0.4, 0.10), t)
    t += 4 * beat
    bar += 1

# 48 to 55 s: the forgery, one dissonant hit.
place(drone("D2", 7.0, 0.10), 48.2)
place(impact(0.45), 50.62)
place(pad(["D3", "Ab3", "Eb4"], 4.0, 0.08, 900), 50.6)

# 55 to 61.5 s: three pools, three bells.
place(pad(["D3", "A3", "D4"], 6.6, 0.07, 1200), 55.0)
for at, note, pan in ((56.0, "D5", -0.4), (57.4, "F5", 0.0), (58.8, "A5", 0.4)):
    place(bell(note, 4.0, 0.12), at, pan=pan)

# 61.5 to 73 s: builders and facts, the pulse again, lighter.
t, bar = 61.6, 0
while t < 72.6:
    for i in range(8):
        place(pluck(prog[bar % 4][i % 4], 0.7, 0.05), t + i * beat / 2, pan=(-0.3 if i % 2 else 0.3))
    place(pad(chords[bar % 4], 4 * beat + 0.6, 0.06, 1200), t - 0.3)
    t += 4 * beat
    bar += 1

# 73 to 80 s: resolve to D major.
place(pad(["D3", "A3", "F#4", "E5"], 7.0, 0.12, 2000), 72.9)
place(drone("D2", 7.0, 0.14), 73.0)
place(bell("A5", 6.0, 0.09), 73.8, pan=0.2)
place(shimmer(["D6", "F#6", "A6"], 6.0, 0.04), 74.2)

# A room: a short stereo tail from decaying noise.
ir_len = int(2.6 * SR)
tt = np.arange(ir_len) / SR
ir = np.vstack([rng.standard_normal(ir_len), rng.standard_normal(ir_len)]) * np.exp(-tt * 2.4)
ir = np.vstack([lowpass(ir[0], 5000), lowpass(ir[1], 5000)])
ir /= np.abs(ir).sum(axis=1, keepdims=True) ** 0.5 * 30
wet = np.vstack([fftconvolve(mix[0], ir[0])[:N], fftconvolve(mix[1], ir[1])[:N]])
out = 0.78 * mix + 0.5 * wet
fade = np.clip((LENGTH - np.arange(N) / SR) / 1.2, 0, 1)
out *= fade
out /= np.abs(out).max() / 0.89

pcm = (out.T * 32767).astype("<i2")
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"wrote {sys.argv[1]}: {LENGTH:.0f} s")
