export const GUARDRAILS = {
  /** Máximo de iteraciones del agent loop */
  maxIterations: 5,
  /** Timeout en ms (Edge Fn limit ~60s) */
  maxExecutionMs: 55000,
  /** Máximo de tools ejecutados en paralelo por iteración */
  maxParallelTools: 3,
  /** Tools que requieren confirmación humana antes de ejecutar */
  requireHumanConfirmation: [
    'create_booking',
    'process_payment',
  ],
  /** Patrones bloqueados — nunca ejecutar */
  blockedPatterns: {
    minorsOnlyFlight: true,
  },
};
