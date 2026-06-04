#!/usr/bin/env bash
set -e

K6=./load-tests/k6/k6
BASE=http://localhost:8080/api
OUT=/tmp/cap_results

mkdir -p $OUT

echo "[RUNNER] Starting capacity tests at $(date)" | tee $OUT/runner.log

# ── 1. load_100 ────────────────────────────────────────────────────────────────
echo "[RUNNER] load_100 starting..." | tee -a $OUT/runner.log
$K6 run \
  --env BASE_URL=$BASE \
  --env SCENARIO=load_100 \
  --summary-export=$OUT/load100.json \
  --no-color \
  load-tests/k6/scenarios.js > $OUT/load100.txt 2>&1
echo "[RUNNER] load_100 done" | tee -a $OUT/runner.log

# ── 2. Spike test ──────────────────────────────────────────────────────────────
echo "[RUNNER] spike starting..." | tee -a $OUT/runner.log
$K6 run \
  --env BASE_URL=$BASE \
  --env SCENARIO=spike \
  --summary-export=$OUT/spike.json \
  --no-color \
  load-tests/k6/scenarios.js > $OUT/spike.txt 2>&1
echo "[RUNNER] spike done" | tee -a $OUT/runner.log

# ── 3. load_1000 (shortened: 2m ramp, 5m hold, 1m ramp-down) ──────────────────
echo "[RUNNER] load_1000 starting..." | tee -a $OUT/runner.log
$K6 run \
  --env BASE_URL=$BASE \
  --env SCENARIO=load_1000 \
  --summary-export=$OUT/load1000.json \
  --no-color \
  load-tests/k6/scenarios.js > $OUT/load1000.txt 2>&1
echo "[RUNNER] load_1000 done" | tee -a $OUT/runner.log

# ── 4. Soak test (200 VU / 10 min — extrapolate to 1h) ─────────────────────────
echo "[RUNNER] soak starting (10min)..." | tee -a $OUT/runner.log
$K6 run \
  --env BASE_URL=$BASE \
  --env SCENARIO=soak \
  --duration 10m \
  --summary-export=$OUT/soak.json \
  --no-color \
  load-tests/k6/scenarios.js > $OUT/soak.txt 2>&1
echo "[RUNNER] soak done" | tee -a $OUT/runner.log

echo "[RUNNER] All K6 tests done at $(date)" | tee -a $OUT/runner.log
