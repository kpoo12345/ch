#!/usr/bin/env python3
"""미리 녹음: python3 scripts/voice/synth.py <lines.json> <캐시 폴더>
 환경 변수 SUPERTONIC_DIR = sherpa-onnx-supertonic-3 모델 폴더 (pip install sherpa-onnx soundfile)
 이미 만든 줄은 건너뛴다 (캐시 이름 = 대사 열쇠 + 목소리 설정)."""
import hashlib, json, os, subprocess, sys, tempfile
import sherpa_onnx, soundfile as sf

VOICES = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'voices.json')))
STEPS = VOICES['steps']

M = os.environ.get('SUPERTONIC_DIR', './sherpa-onnx-supertonic-3-tts-int8-2026-05-11').rstrip('/') + '/'

def tag(who):
    return f"s{VOICES[who]['sid']}-v{VOICES[who]['speed']}-n{STEPS}"

def main():
    lines = json.load(open(sys.argv[1], encoding='utf-8'))
    cache = sys.argv[2]
    os.makedirs(cache, exist_ok=True)
    todo = [x for x in lines if not os.path.exists(os.path.join(cache, f"{x['key']}-{tag(x['who'])}-b{x.get('br', 18)}-{hashlib.md5(x['tts'].encode()).hexdigest()[:6]}.webm"))]
    print(f"{len(lines)} lines, {len(todo)} to synthesize")
    if not todo:
        return
    cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
        supertonic=sherpa_onnx.OfflineTtsSupertonicModelConfig(
            duration_predictor=M + 'duration_predictor.int8.onnx', text_encoder=M + 'text_encoder.int8.onnx',
            vector_estimator=M + 'vector_estimator.int8.onnx', vocoder=M + 'vocoder.int8.onnx', tts_json=M + 'tts.json',
            unicode_indexer=M + 'unicode_indexer.bin', voice_style=M + 'voice.bin'), num_threads=4, provider='cpu'))
    tts = sherpa_onnx.OfflineTts(cfg)
    for n, x in enumerate(todo):
        g = sherpa_onnx.GenerationConfig()
        g.sid = VOICES[x['who']]['sid']; g.num_steps = STEPS; g.speed = VOICES[x['who']]['speed']; g.extra['lang'] = 'ko'
        a = tts.generate(x['tts'], g)
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
            wav = f.name
        sf.write(wav, a.samples, samplerate=a.sample_rate)
        out = os.path.join(cache, f"{x['key']}-{tag(x['who'])}-b{x.get('br', 18)}-{hashlib.md5(x['tts'].encode()).hexdigest()[:6]}.webm")
        # 앞뒤 무음 자르기(조금 남김) → 24kHz 모노 Opus 20kbps
        af = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af', af, '-ac', '1', '-ar', '24000', '-c:a', 'libopus', '-b:a', f"{x.get('br', 18)}k",
                        '-application', 'voip', '-frame_duration', '40', out], check=True)
        os.unlink(wav)
        if n % 20 == 0:
            print(f"  {n + 1}/{len(todo)} {x['text'][:30]}")

if __name__ == '__main__':
    main()
