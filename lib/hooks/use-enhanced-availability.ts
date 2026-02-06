import * as React from "react";

export type EnhancedAvailabilityReason =
  | "ok"
  | "not_connected"
  | "unactivated"
  | "expired"
  | "locked";

export type EnhancedAvailabilityInput = {
  connected: boolean;
  licenseStatus: string | null | undefined;
};

function resolveEnhancedAvailability(input: EnhancedAvailabilityInput) {
  if (!input.connected) return { available: false as const, reason: "not_connected" as const };
  if (input.licenseStatus === "expired") return { available: false as const, reason: "expired" as const };
  if (input.licenseStatus === "locked") return { available: false as const, reason: "locked" as const };
  if (input.licenseStatus === "unactivated") return { available: false as const, reason: "unactivated" as const };
  return { available: true as const, reason: "ok" as const };
}

function useEnhancedAvailability(input: EnhancedAvailabilityInput) {
  const { connected, licenseStatus } = input;
  return React.useMemo(() => resolveEnhancedAvailability({ connected, licenseStatus }), [connected, licenseStatus]);
}

export { useEnhancedAvailability };
