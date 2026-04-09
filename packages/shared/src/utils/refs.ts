/**
 * Generate human-readable platform references.
 * e.g. ZT-C-0001, ZT-S-0042, ZT-D-0007
 */
export function generateContractRef(sequence: number): string {
  return `ZT-C-${String(sequence).padStart(4, '0')}`;
}

export function generateSessionRef(sequence: number): string {
  return `ZT-S-${String(sequence).padStart(4, '0')}`;
}

export function generateDisputeRef(sequence: number): string {
  return `ZT-D-${String(sequence).padStart(4, '0')}`;
}

export function generateSettlementRef(sequence: number): string {
  return `ZT-P-${String(sequence).padStart(4, '0')}`;
}
