#!/usr/bin/env python3
"""녹음 검사: 음성 인식으로 다시 받아 적어 대사와 비교 (글자 오류율 CER)
 python3 scripts/voice/check.py <lines.json> <캐시 폴더> [기준=0.15]
 환경 변수 ASR_DIR = sherpa-onnx-zipformer-korean-2024-06-24 폴더"""
import hashlib, json, os, subprocess, sys
import numpy as np, sherpa_onnx

VOICES = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'voices.json')))
STEPS = VOICES['steps']
A = os.environ.get('ASR_DIR', './sherpa-onnx-zipformer-korean-2024-06-24').rstrip('/') + '/'
tag = lambda who: f"s{VOICES[who]['sid']}-v{VOICES[who]['speed']}-n{STEPS}"
rec = sherpa_onnx.OfflineRecognizer.from_transducer(encoder=A + 'encoder-epoch-99-avg-1.int8.onnx', decoder=A + 'decoder-epoch-99-avg-1.onnx',
                                                    joiner=A + 'joiner-epoch-99-avg-1.int8.onnx', tokens=A + 'tokens.txt', num_threads=4, decoding_method='greedy_search')
def lev(a, b):
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (ca != cb))
    return d[len(b)]
# 받아쓰기는 숫자를 한글로 쓰기도 하고 반대이기도 해서 비교 전에 숫자·띄어쓰기·문장부호를 뺀다
norm = lambda s: ''.join(ch for ch in s.replace('에요', '예요') if ch.isalpha())

lines = json.load(open(sys.argv[1], encoding='utf-8'))
cache = sys.argv[2]; limit = float(sys.argv[3]) if len(sys.argv) > 3 else 0.15
bad = []
for x in lines:
    f = os.path.join(cache, f"{x['key']}-{tag(x['who'])}-b{x.get('br', 18)}-{hashlib.md5(x['tts'].encode()).hexdigest()[:6]}.webm")
    if not os.path.exists(f):
        continue
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], capture_output=True, check=True).stdout
    s = rec.create_stream(); s.accept_waveform(16000, np.frombuffer(pcm, dtype=np.float32)); rec.decode_stream(s)
    ref, hyp = norm(x['tts']), norm(s.result.text)
    cer = lev(ref, hyp) / max(1, len(ref))
    if cer > limit:
        bad.append((cer, x['key'], x['tts'], s.result.text))
bad.sort(reverse=True)
print(f"checked {len(lines)}; over {limit}: {len(bad)}")
for cer, key, ref, hyp in bad:
    print(f"{cer:.2f} {key}\n  대사: {ref}\n  인식: {hyp}")
