export interface HealthInputs {
  generation: number;
  citation: number;
  quality: number;
  distribution: number;
}

export function computeHealthScore(inputs: HealthInputs) {
  const genWeight = 0.30;
  const citWeight = 0.35;
  const qualWeight = 0.20;
  const distWeight = 0.15;

  const total = 
    inputs.generation * genWeight +
    inputs.citation * citWeight +
    inputs.quality * qualWeight +
    inputs.distribution * distWeight;

  return {
    total: Math.min(100, Math.max(0, Math.round(total))),
  };
}
