// src/utils/scanGuard.ts
// ═══════════════════════════════════════════════════════════════════════════
// FIXES BUG #3: duplicate scan execution
//
// Cause in original code:
//   - Background interval (every 15s) fires scanFnRef.current()
//   - Manual FORCE SCAN button fires the same function
//   - React StrictMode double-mounts effects in dev
//   - No mutex → both invocations ran to completion
//
// Result: every scan block appeared TWICE in the log.
//
// Fix: single-flight lock + generation counter + supersede logic.
// ═══════════════════════════════════════════════════════════════════════════

let _running = false;
let _generation = 0;
let _lastStartMs = 0;

const MIN_GAP_MS = 5_000;

export interface ScanGuardResult {
  proceed: boolean;
  reason?: 'already-running' | 'too-soon';
  generation?: number;
}

export function acquireScanLock(trigger: string): ScanGuardResult {
  const now = Date.now();

  if (_running) {
    console.log(`[SCAN-GUARD] ❌ ${trigger}: rejected — scan already running (gen=${_generation})`);
    return { proceed: false, reason: 'already-running' };
  }

  if (now - _lastStartMs < MIN_GAP_MS && _lastStartMs > 0) {
    const waited = now - _lastStartMs;
    console.log(`[SCAN-GUARD] ❌ ${trigger}: rejected — only ${waited}ms since last start (min ${MIN_GAP_MS}ms)`);
    return { proceed: false, reason: 'too-soon' };
  }

  _running = true;
  _lastStartMs = now;
  _generation += 1;
  console.log(`[SCAN-GUARD] ✅ ${trigger}: acquired (gen=${_generation})`);
  return { proceed: true, generation: _generation };
}

export function releaseScanLock(): void {
  _running = false;
}

export function currentScanGeneration(): number {
  return _generation;
}

export function isStaleGeneration(gen: number): boolean {
  return _generation !== gen;
}