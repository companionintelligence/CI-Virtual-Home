#!/usr/bin/env python3
"""
Local Kokoro-82M synthesis for the family voice-over (scripts/build-voiceover.mts calls this).

One process per run, many clips: it loads the pipeline once (about 3 s) and writes one trimmed 24 kHz mono
float WAV per clip plus a result.json with per-word timings. Everything is local; nothing is downloaded.

    python synth.py --job job.json --out-dir DIR        synthesise the clips listed in the job
    python synth.py --probe                              print the engine block as JSON and exit

Run it with the CI-Common Kokoro venv (~/.cache/ci-video-kit/kokoro/venv/bin/python). If that venv is missing,
build-voiceover.mts prints CI-Common's kokoro-setup.sh instructions and stops; this script never installs.

WHY THE NETWORK IS BLOCKED. "Uncloud" film, no cloud TTS, no downloads without the owner's say-so. HF_HUB_OFFLINE=1
already stops huggingface_hub; the socket guard below stops everything else (a spaCy model download, a stray
telemetry call) and turns it into a loud error rather than a silent fetch.

WHY ONE SEED PER CLIP. Kokoro's vocoder injects noise at inference. Seeding immediately before each clip (not once
at start) makes a clip a pure function of (text, voice, speed): re-recording one clip with --stale gives the same
bytes as recording the whole family.

WHY THE THREAD COUNT IS PINNED. Float reductions split differently across a different number of threads; a pinned
count keeps the output bit-identical whatever else the machine is doing. It is recorded in the engine block.

WHY THE espeak PATCH. misaki imports espeak at import time and the wheel's baked-in data path is a CI machine of
the wheel's maker; patching the loader before the import is the only fix that lands early enough. See
CI-Common/packages/video-kit/scripts/kokoro_tts.py, which this follows.
"""

import argparse
import hashlib
import json
import os
import re
import socket
import sys

# --- no network, ever -------------------------------------------------------------------------------------------
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

_real_connect = socket.socket.connect


def _guarded_connect(self, address):
    if self.family in (socket.AF_INET, socket.AF_INET6):
        raise RuntimeError(f"synth.py: network access is blocked ({address!r}); the voice-over is generated locally")
    return _real_connect(self, address)


socket.socket.connect = _guarded_connect

SAMPLE_RATE = 24000


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def fail(msg, code=2):
    print(f"synth.py: {msg}", file=sys.stderr)
    sys.exit(code)


def patch_espeak(lib, data):
    """Point misaki's espeak backend at a real espeak-ng. Must run before anything imports misaki."""
    import espeakng_loader

    if lib:
        espeakng_loader.get_library_path = lambda: lib
    if data:
        espeakng_loader.get_data_path = lambda: data


def cached_snapshot(revision):
    """The offline Hugging Face snapshot dir for Kokoro-82M at the PINNED revision, or a precise failure."""
    from huggingface_hub import constants

    root = os.path.join(constants.HF_HUB_CACHE, "models--hexgrad--Kokoro-82M")
    ref = os.path.join(root, "refs", "main")
    snap = os.path.join(root, "snapshots", revision)
    if not os.path.isdir(snap):
        fail(f"Kokoro-82M revision {revision} is not in the local Hugging Face cache ({root}). "
             "Downloading needs the owner's approval; run CI-Common's kokoro-setup.sh.", 3)
    if os.path.exists(ref):
        main = open(ref).read().strip()
        if main != revision:
            # hf_hub_download(revision=None) resolves refs/main, so a different main would load different weights
            fail(f"refs/main is {main} but the pinned revision is {revision}; refusing to synthesise with unpinned weights", 3)
    return snap


def engine_block(revision, voices_used, snap):
    import kokoro
    import misaki
    import numpy
    import soundfile
    import torch
    from importlib import metadata

    def ver(pkg):
        try:
            return metadata.version(pkg)
        except Exception:
            return None

    weights = os.path.join(snap, "kokoro-v1_0.pth")
    block = {
        "name": "kokoro",
        "model": "hexgrad/Kokoro-82M",
        "modelRevision": revision,
        "weightsSha256": sha256_file(weights),
        "kokoro": ver("kokoro"),
        "misaki": ver("misaki"),
        "torch": torch.__version__.split("+")[0],
        "numpy": numpy.__version__,
        "soundfile": soundfile.__version__,
        "phonemizerFork": ver("phonemizer-fork"),
        "espeakngLoader": ver("espeakng-loader"),
        "python": sys.version.split()[0],
    }
    block["voiceFiles"] = {v: sha256_file(os.path.join(snap, "voices", v + ".pt"))[:16] for v in sorted(voices_used)}
    return block


def trim(audio, np, silence_db, lead_keep_ms, tail_keep_ms):
    """Leading silence to exactly lead_keep_ms (cut or padded, in whole milliseconds); trailing silence to at most tail_keep_ms.

    Returns (audio, trimmed_lead_ms). trimmed_lead_ms is how many ms were removed from the start (negative when
    silence was added), so a word time in the original audio minus trimmed_lead_ms is its time in the trimmed audio.
    """
    thr = 10 ** (silence_db / 20.0)
    loud = np.nonzero(np.abs(audio) > thr)[0]
    if loud.size == 0:
        return None, 0
    ms = SAMPLE_RATE // 1000  # 24 samples per ms
    first, last = int(loud[0]), int(loud[-1])
    cut_ms = int(round((first - lead_keep_ms * ms) / ms))
    if cut_ms >= 0:
        audio = audio[cut_ms * ms:]
        last -= cut_ms * ms
    else:
        audio = np.concatenate([np.zeros(-cut_ms * ms, dtype=audio.dtype), audio])
        last += -cut_ms * ms
    end = min(len(audio), last + 1 + tail_keep_ms * ms)
    return audio[:end].astype(np.float32), cut_ms


def median_f0(audio, np):
    """Median fundamental frequency in Hz over the voiced 40 ms frames, by autocorrelation (70 to 320 Hz), or None.

    A sanity measure, not a gate: it says whether the voice file that was loaded has the pitch the registry claims
    (bf_isabella about 190 Hz, bm_lewis about 92 Hz), which catches a wrong mapping that no loudness check would."""
    frame, hop = int(0.04 * SAMPLE_RATE), int(0.02 * SAMPLE_RATE)
    lo, hi = int(SAMPLE_RATE / 320), int(SAMPLE_RATE / 70)
    found = []
    for i in range(0, len(audio) - frame, hop):
        x = audio[i:i + frame].astype(np.float64)
        x = x - x.mean()
        e = float(np.dot(x, x))
        if e / frame < 1e-4:          # below about -40 dBFS rms
            continue
        ac = np.correlate(x, x, mode="full")[frame - 1:]
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] / ac[0] > 0.5:
            found.append(SAMPLE_RATE / k)
    return round(float(np.median(found)), 1) if len(found) >= 10 else None


def main():
    ap = argparse.ArgumentParser(description="Kokoro-82M batch synthesis for the family voice-over")
    ap.add_argument("--job")
    ap.add_argument("--out-dir")
    ap.add_argument("--probe", action="store_true")
    ap.add_argument("--espeak-lib", default="")
    ap.add_argument("--espeak-data", default="")
    ap.add_argument("--revision", default="")
    ap.add_argument("--voices", default="", help="comma-separated kokoro voice names (probe only)")
    a = ap.parse_args()

    if a.probe:
        patch_espeak(a.espeak_lib, a.espeak_data)
        snap = cached_snapshot(a.revision)
        voices = [v for v in a.voices.split(",") if v]
        print(json.dumps(engine_block(a.revision, voices, snap)))
        return 0

    if not a.job or not a.out_dir:
        fail("--job and --out-dir are required")
    job = json.load(open(a.job))
    os.makedirs(a.out_dir, exist_ok=True)

    patch_espeak(job.get("espeakLib", ""), job.get("espeakData", ""))
    snap = cached_snapshot(job["modelRevision"])

    import numpy as np
    import soundfile as sf
    import torch
    from kokoro import KPipeline

    torch.set_num_threads(int(job.get("threads", 4)))
    pipeline = KPipeline(lang_code=job.get("lang", "b"), device=job.get("device", "cpu"), repo_id="hexgrad/Kokoro-82M")

    voices_used = sorted({it["voice"] for it in job["items"]})
    engine = engine_block(job["modelRevision"], voices_used, snap)
    engine["threads"] = int(job.get("threads", 4))
    engine["device"] = job.get("device", "cpu")
    engine["seed"] = int(job.get("seed", 0))

    clips = {}
    for idx, it in enumerate(job["items"]):
        text = it["text"].strip()
        out = {"index": idx}
        if not text:
            out["error"] = "empty text"
            clips[it["id"]] = out
            continue
        # seed immediately before this clip: see the module docstring
        torch.manual_seed(int(job.get("seed", 0)))
        results = list(pipeline(text, voice=it["voice"], speed=float(it["speed"]), split_pattern=None))
        pcs, words, offset, untimed, phonemes = [], [], 0.0, 0, []
        for r in results:
            if r.audio is None:
                continue
            piece = r.audio.detach().cpu().numpy().astype(np.float32)
            phonemes.append(r.phonemes)
            for t in r.tokens or []:
                if not re.search(r"\w", t.text):
                    continue
                if t.start_ts is None or t.end_ts is None:
                    untimed += 1
                    continue
                start, end = (offset + float(t.start_ts)) * 1000.0, (offset + float(t.end_ts)) * 1000.0
                if t.text[0] in "'’" and words:
                    # "Odoo" + "'s" are two tokens in misaki; one word on the page, so one word in the timings
                    words[-1][0] += t.text
                    words[-1][2] = end
                else:
                    words.append([t.text, start, end])
            offset += len(piece) / SAMPLE_RATE
            pcs.append(piece)
        if not pcs:
            out["error"] = "no audio chunks"
            clips[it["id"]] = out
            continue
        raw = np.concatenate(pcs)
        peak = float(np.max(np.abs(raw)))
        clipped = int(np.sum(np.abs(raw) >= 0.999))
        audio, cut_ms = trim(raw, np, float(job.get("silenceDb", -48)), int(job.get("leadKeepMs", 80)), int(job.get("tailKeepMs", 150)))
        if audio is None:
            out["error"] = f"silent output (peak {peak:.2e})"
            clips[it["id"]] = out
            continue
        wav = os.path.join(a.out_dir, f"{idx:03d}.wav")
        sf.write(wav, audio, SAMPLE_RATE, subtype="FLOAT")
        out.update({
            "wav": wav, "samples": int(len(audio)), "rawSamples": int(len(raw)), "trimmedLeadMs": cut_ms,
            "peak": peak, "clippedSamples": clipped,
            "rms": float(np.sqrt(np.mean(np.square(audio)))),
            "f0Hz": median_f0(audio, np), "chunks": len(pcs), "untimed": untimed, "phonemes": " ".join(phonemes),
            # word times in the TRIMMED audio, milliseconds, one decimal
            "words": [[w, round(s - cut_ms, 1), round(e - cut_ms, 1)] for w, s, e in words],
        })
        clips[it["id"]] = out
        print(f"synth.py: {it['id']:<28} {it['voice']:<12} {len(audio) / SAMPLE_RATE:6.2f}s peak {peak:.3f}", file=sys.stderr)

    with open(os.path.join(a.out_dir, "result.json"), "w") as f:
        json.dump({"engine": engine, "clips": clips}, f)
    return 0


if __name__ == "__main__":
    sys.exit(main())
