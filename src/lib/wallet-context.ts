import { createContext, useContext } from "react";
import type { WalletState } from "./wallet";

export const WalletContext = createContext<WalletState | null>(null);

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside the wallet provider");
  return ctx;
}
