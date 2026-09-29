// Finalized-receipt assertion shared by the web client and the deploy script.
// A GenLayer receipt can finalize with a failed execution; this converts that
// case into a thrown error with the consensus message attached.

const FAILURE_WORDS = ["FAIL", "ERROR", "REVERT", "UNDETERMINISTIC"];

export function assertFinalizedSuccess(receipt) {
  if (!receipt || typeof receipt !== "object") {
    throw new Error("Transaction did not produce a finalized receipt");
  }
  const candidates = [
    receipt.execution_result,
    receipt.executionResult,
    receipt.result,
    receipt.result_name,
    receipt.resultName,
    receipt?.data?.result,
    receipt?.data?.execution_result,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const upper = candidate.toUpperCase();
    if (FAILURE_WORDS.some((word) => upper.includes(word))) {
      const reason =
        receipt?.message || receipt?.data?.message || receipt?.data?.exception_message || receipt?.data?.exceptionMessage || "consensus execution failed";
      throw new Error(`Transaction finalized with ${candidate}: ${reason}`);
    }
  }
  return receipt;
}
