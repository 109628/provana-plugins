#!/usr/bin/env bash
# build_corpus.sh — Build voice evaluation audio corpus
# Usage: bash build_corpus.sh [utterances.json] [output_dir]
#
# Requires: ffmpeg, Python with azure-cognitiveservices-speech, librosa

set -euo pipefail

UTTERANCES="${1:-tests/conv_ai/fixtures/utterances.json}"
OUTPUT_DIR="${2:-tests/conv_ai/fixtures/audio}"

echo "=== Voice Corpus Builder ==="
echo "Utterances: $UTTERANCES"
echo "Output: $OUTPUT_DIR"

mkdir -p "$OUTPUT_DIR"

# Check dependencies
command -v ffmpeg >/dev/null || { echo "ERROR: ffmpeg not installed"; exit 1; }
python3 -c "import azure.cognitiveservices.speech" 2>/dev/null || \
    { echo "ERROR: azure-cognitiveservices-speech not installed"; exit 1; }

# Generate clean + telephony-degraded audio
python3 - << 'EOF'
import json, os, sys
sys.path.insert(0, ".")
from skills.voice_pipeline_eval.scripts.gen_test_audio import generate_test_audio

utterances_file = os.environ.get("UTTERANCES", "tests/conv_ai/fixtures/utterances.json")
output_dir = os.environ.get("OUTPUT_DIR", "tests/conv_ai/fixtures/audio")

with open(utterances_file) as f:
    utterances = json.load(f)

manifest = generate_test_audio(utterances, output_dir)
print(f"Generated {len(manifest)} utterances ({len(manifest)*2} audio files)")
print(f"Manifest: {output_dir}/manifest.json")
EOF

echo ""
echo "✅ Corpus built. Run: pytest tests/conv_ai/ -v"
