"""Writes the launch film's score, synthesized from scratch on the film's beat grid.

    python3 tools/film/score.py <out.wav>

124 bpm in D minor. Kick, clap, hats, a pumping bass, offbeat stabs and plucked
arpeggios; a breakdown before the crack; impacts on the stamp, the tear, the
crack, the forgery and the end, each on the same beat as the picture
(tools/film/film.html). Needs numpy and scipy.
"""

import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
LENGTH = 46.0
N = int(SR * LENGTH)
BEAT = 60 / 124
rng = np.random.default_rng(311)
mix = np.zeros((2, N))
verb = np.zeros((2, N))  # what goes to the room


def at(bar, beat=0.0):
    return (bar * 4 + beat) * BEAT


def hz(note):
    names = {"C": 0, "C#": 1, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}
    return 440.0 * 2 ** ((names[note[:-1]] + 12 * (int(note[-1]) + 1) - 69) / 12)


def filt(x, kind, cut, order=2):
    return sosfilt(butter(order, cut, kind, fs=SR, output="sos"), x)


def place(sig, t, gain=1.0, pan=0.0, send=0.25):
    i = int(t * SR)
    if sig.ndim == 1:
        sig = np.vstack([sig * np.sqrt(0.5 * (1 - pan)), sig * np.sqrt(0.5 * (1 + pan))])
    n = min(sig.shape[1], N - i)
    if n > 0 and i >= 0:
        mix[:, i:i + n] += gain * sig[:, :n]
        verb[:, i:i + n] += send * gain * sig[:, :n]


def tt(dur):
    return np.arange(int(dur * SR)) / SR


# ---------- instruments ----------
def kick(gain=1.0):
    t = tt(0.45)
    f = 52 + 160 * np.exp(-t * 30)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    knock = np.sin(2 * np.pi * 2 * np.cumsum(f) / SR) * np.exp(-t * 30) * 0.35
    click = filt(rng.standard_normal(len(t)), "high", 2500) * np.exp(-t * 150) * 0.45
    return gain * 0.55 * np.tanh(1.6 * (body + knock + click))


def clap(gain=1.0):
    t = tt(0.35)
    noise = filt(rng.standard_normal(len(t)), "band", [900, 3200])
    envs = sum(np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d) for d in (0, 0.011, 0.023)) + 0.6 * np.exp(-t * 14)
    return gain * 0.6 * noise * envs


def hat(gain=1.0, open_=False):
    t = tt(0.22 if open_ else 0.05)
    noise = filt(rng.standard_normal(len(t)), "high", 7500)
    return gain * 0.2 * noise * np.exp(-t * (18 if open_ else 90))


def bass(note, dur):
    t = tt(dur)
    f = hz(note)
    saw = 2 * ((f * t) % 1) - 1 + 0.5 * np.sin(2 * np.pi * f * t)
    env = np.exp(-t * 5) * 0.7 + 0.3
    out = filt(saw, "low", 900) * env * np.clip(t / 0.004, 0, 1) * np.clip((dur - t) / 0.02, 0, 1)
    return 0.2 * out


def stab(notes, dur=0.22, gain=1.0):
    t = tt(dur)
    s = sum(2 * ((hz(n) * (1 + d) * t) % 1) - 1 for n in notes for d in (-0.004, 0.004))
    return gain * 0.17 * filt(s, "low", 3200) * np.exp(-t * 10)


def pluck(note, gain=1.0):
    t = tt(0.4)
    f = hz(note)
    s = sum(np.sin(2 * np.pi * f * h * t) / h ** 1.5 for h in range(1, 6))
    return gain * 0.17 * s * np.exp(-t * 11)


def pad(notes, dur, gain=0.11, cut=2200):
    t = tt(dur)
    s = sum(2 * ((hz(n) * (1 + d) * t + rng.uniform()) % 1) - 1 for n in notes for d in (-0.003, 0.003))
    env = np.minimum(np.clip(t / 0.5, 0, 1), np.clip((dur - t) / 0.8, 0, 1))
    return gain * filt(s / len(notes), "low", cut, 4) * env


def impact(gain=1.0):
    t = tt(3.0)
    f = 30 + 90 * np.exp(-t * 6)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.4) * 0.7
    crack = filt(rng.standard_normal(len(t)), "band", [300, 5000]) * np.exp(-t * 10) * 1.1
    return gain * 0.7 * np.tanh(1.4 * (boom + crack))


def crash(gain=1.0):
    t = tt(2.5)
    return gain * 0.28 * filt(rng.standard_normal(len(t)), "high", 3500) * np.exp(-t * 2.2)


def riser(dur, gain=1.0):
    t = tt(dur)
    k = t / dur
    noise = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    for b in range(32):
        a, z = b * len(t) // 32, (b + 1) * len(t) // 32
        out[a:z] = filt(noise, "low", 400 + 5000 * (b / 32) ** 2)[a:z]
    tone = np.sin(2 * np.pi * np.cumsum(180 + 900 * k ** 2) / SR) * 0.3
    return gain * 0.16 * (out + tone) * k ** 2


def bell(note, gain=1.0):
    t = tt(2.5)
    f = hz(note)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in ((1, 1, 1.6), (2.01, 0.5, 2.6), (2.76, 0.3, 3.5), (5.4, 0.1, 6)))
    return gain * 0.3 * s


def tick(gain=1.0):
    t = tt(0.06)
    return gain * 0.45 * filt(rng.standard_normal(len(t)), "band", [1800, 6000]) * np.exp(-t * 70)


# ---------- harmony ----------
CHORDS = [["D3", "F3", "A3"], ["Bb2", "D3", "F3"], ["F3", "A3", "C4"], ["C3", "E3", "G3"]]
ROOTS = ["D2", "Bb1", "F2", "C2"]
ARP = [["D4", "F4", "A4", "D5"], ["Bb3", "D4", "F4", "Bb4"], ["F4", "A4", "C5", "F5"], ["C4", "E4", "G4", "C5"]]


def groove(bar, half=False, arp=False, stabs=True):
    c = bar % 4
    for b in range(4):
        if not half or b in (0, 2):
            place(kick(), at(bar, b), send=0.05)
        if (not half and b in (1, 3)) or (half and b == 2):
            place(clap(), at(bar, b), send=0.35)
    for s in range(16):
        place(hat(0.8 if s % 2 else 0.5, open_=(s % 4 == 2)), at(bar, s / 4), pan=0.3 if s % 2 else -0.2, send=0.1)
    for e in range(8):
        place(bass(ROOTS[c], BEAT / 2 - 0.01), at(bar, e / 2), send=0.02)
    if stabs:
        for b in range(4):
            place(stab(CHORDS[c]), at(bar, b + 0.5), pan=-0.25 if b % 2 else 0.25, send=0.4)
    if arp:
        for s in range(16):
            place(pluck(ARP[c][s % 4], 0.8), at(bar, s / 4), pan=0.4 if s % 2 else -0.4, send=0.35)
    place(pad(CHORDS[c], 4 * BEAT + 0.4), at(bar) - 0.1, send=0.5)


# ---------- the arrangement, bar by bar ----------
# Bar 0: the words arrive on beats 1, 2 and 3.
place(riser(at(1), 0.8), 0.0)
for b in (1, 2, 3):
    place(tick(1.0), at(0, b), send=0.4)
place(pad(["D2", "A2"], at(2) + 0.5, 0.08, 600), 0.0)
# Bar 1: the stamp.
place(impact(1.0), at(1))
place(crash(0.8), at(1))
place(bell("D5", 0.6), at(1), send=0.6)
# Bars 2 to 5: the ledger and the problem.
for bar in range(2, 6):
    groove(bar)
place(impact(0.7), at(5))
place(stab(["D3", "Ab3", "Eb4"], 0.5, 2.0), at(5), send=0.5)
# Bar 6: the breakdown; a roll climbs into the crack.
place(pad(["D3", "F3", "A3", "E4"], at(1) + 0.4, 0.09, 900), at(6))
place(riser(at(1), 1.2), at(6))
for s in range(8, 16):
    place(clap(0.25 + 0.6 * (s - 8) / 8), at(6, s / 4), send=0.3)
# Bars 7 and 8: the crack and the name, half time, in D major.
place(impact(1.1), at(7))
place(crash(1.0), at(7))
place(pad(["D3", "F#3", "A3", "E4"], at(2) + 0.6, 0.11, 2200), at(7))
for bar in (7, 8):
    groove(bar, half=True, stabs=False)
# Bars 9 to 12: the product.
for bar in range(9, 13):
    groove(bar, arp=True)
# Bar 13: the amount; bar 14: the forgery lands, and the drums stop.
groove(13)
place(riser(at(1) * 0.5, 0.7), at(13, 2))
place(impact(0.9), at(14))
place(stab(["D3", "Ab3", "Eb4", "A4"], 0.9, 2.2), at(14), send=0.6)
place(pad(["D3", "Ab3", "Eb4"], at(1), 0.08, 900), at(14))
# Bars 15 and 16: three pools, three hits.
for i, note in enumerate(("D5", "F5", "A5")):
    place(kick(1.1), at(15, i))
    place(bell(note, 0.8), at(15, i), pan=(-0.4, 0.0, 0.4)[i], send=0.5)
place(crash(0.5), at(16))
groove(16, arp=True)
# Bars 17 to 20: builders and facts.
for bar in range(17, 21):
    groove(bar, arp=bar >= 19)
for b in (0, 2):
    place(impact(0.35), at(19, b))
place(impact(0.35), at(20))
place(riser(at(1), 0.9), at(20))
# Bar 21 onward: the name, and a D major ending.
place(impact(1.1), at(21))
place(crash(1.0), at(21))
place(pad(["D3", "F#3", "A3", "D4", "E4"], LENGTH - at(21), 0.12, 2400), at(21))
place(bell("A5", 0.5), at(21), send=0.7)
place(bell("D6", 0.35), at(22), send=0.7)

# ---------- the room, then the master ----------
ir_t = tt(1.8)
ir = np.vstack([rng.standard_normal(len(ir_t)), rng.standard_normal(len(ir_t))]) * np.exp(-ir_t * 3.2)
ir = np.vstack([filt(ir[0], "low", 6000), filt(ir[1], "low", 6000)])
ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True)) * 3
out = mix + np.vstack([fftconvolve(verb[0], ir[0])[:N], fftconvolve(verb[1], ir[1])[:N]])
out = filt(out, "high", 28)
out = np.tanh(1.3 * out / np.abs(out).max() * 1.6) / np.tanh(1.3 * 1.6)  # a gentle limiter
out *= np.clip((LENGTH - np.arange(N) / SR) / 1.5, 0, 1)
out /= np.abs(out).max() / 0.89
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((out.T * 32767).astype("<i2").tobytes())
print(f"wrote {sys.argv[1]}: {LENGTH:.0f} s")
