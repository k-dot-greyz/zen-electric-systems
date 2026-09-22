'use strict';

/**
 * Portable branch load/physics calculator.
 * Migrated from VoltWatch v2.0-agnostic recalculateLoad(). Same math,
 * but resistivity and the continuous-load derate % are now parameters
 * (from a jurisdiction pack) instead of literals baked into this file —
 * see ARCHITECTURE.md Section 2.1 / Section 5.
 *
 * Pure function: no DOM reads, no globals, no side effects.
 */

/**
 * @param {object} branch - manifest.branch shape (see schemas/manifest.schema.json)
 * @param {object} physicsConstants - jurisdiction pack's physicsConstants
 *   { resistivityOhmMm2PerM: { [material]: number }, continuousLoadDeratePct: number }
 * @returns {object} computed load/physics figures
 */
function calculateBranchLoad(branch, physicsConstants) {
  const { nominalVoltageVac: V, breakerAmps, material, crossSection, lengthMeters, appliances } = branch;
  const { resistivityOhmMm2PerM, continuousLoadDeratePct } = physicsConstants;

  if (!(material in resistivityOhmMm2PerM)) {
    throw new Error(
      `Branch material '${material}' has no entry in this jurisdiction's resistivityOhmMm2PerM map. ` +
      `Known materials: ${Object.keys(resistivityOhmMm2PerM).join(', ')}`
    );
  }

  let totalApparentVa = 0;
  let totalActiveWatts = 0;
  let peakTransientAmps = 0;
  let totalLeakageMa = 0;
  let continuousWatts = 0;

  for (const app of appliances) {
    if (!app.active) continue;
    const pf = app.pf || 1.0;
    const va = app.watts / pf;
    totalApparentVa += va;
    totalActiveWatts += app.watts;
    const rmsA = va / V;
    peakTransientAmps += rmsA * (app.inrush || 1.0);
    totalLeakageMa += app.leakage || 0.2;
    if (app.continuous) continuousWatts += app.watts;
  }

  const totalRmsAmps = totalApparentVa / V;
  const continuousLimitAmps = breakerAmps * continuousLoadDeratePct;

  // In-wall conductor loop resistance: forward (phase) + return (neutral) = length * 2
  const rho = resistivityOhmMm2PerM[material];
  const rLoopOhms = (rho * (lengthMeters * 2)) / crossSection;

  const voltageDropV = totalRmsAmps * rLoopOhms;
  const voltageDropPct = (voltageDropV / V) * 100;
  const heatLossWatts = Math.pow(totalRmsAmps, 2) * rLoopOhms;

  return {
    totalActiveWatts,
    totalApparentVa,
    totalRmsAmps,
    peakTransientAmps,
    totalLeakageMa,
    continuousWatts,
    continuousLimitAmps,
    overContinuousLimit: continuousWatts / V > continuousLimitAmps,
    rLoopOhms,
    voltageDropV,
    voltageDropPct,
    heatLossWatts,
    breakerUtilizationPct: Math.min((totalRmsAmps / breakerAmps) * 100, 100)
  };
}

module.exports = { calculateBranchLoad };
