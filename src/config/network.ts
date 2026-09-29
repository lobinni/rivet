import deployment from "../../deployments/studionet.json";

/**
 * Single source of truth for network pinning and the contract address.
 *
 * Address resolution order (no code change needed when the address moves):
 *   1. VITE_RIVET_CONTRACT in .env.local
 *   2. contract.address in deployments/studionet.json
 *   3. empty string → the app runs in pre-deployment mode
 */

export const CHAIN_ID = 61999;
export const CHAIN_HEX = "0xf22f";
export const RPC_URL = "https://studio.genlayer.com/api";
export const EXPLORER_URL = import.meta.env.VITE_GENLAYER_EXPLORER || "https://explorer-studio.genlayer.com";

const envAddress = (import.meta.env.VITE_RIVET_CONTRACT || "").trim();
const fileAddress = (deployment?.contract?.address || "").trim();

export const CONTRACT_ADDRESS = envAddress || fileAddress;
export const DEPLOYMENT_STATUS: string = deployment?.status || (CONTRACT_ADDRESS ? "live" : "pending");

export const NETWORK = {
  chainId: CHAIN_HEX,
  chainName: "GenLayer Studionet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: [EXPLORER_URL],
};

export function isConfigured(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS);
}

export function assertReleaseConfig() {
  const envChain = Number(import.meta.env.VITE_GENLAYER_CHAIN_ID || CHAIN_ID);
  const envRpc = import.meta.env.VITE_GENLAYER_RPC_URL || RPC_URL;
  if (envChain !== CHAIN_ID) throw new Error(`Rivet only supports chain ${CHAIN_ID}`);
  if (envRpc !== RPC_URL) throw new Error(`Rivet only supports ${RPC_URL}`);
}
