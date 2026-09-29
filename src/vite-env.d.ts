/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RIVET_CONTRACT?: string;
  readonly VITE_GENLAYER_CHAIN_ID?: string;
  readonly VITE_GENLAYER_RPC_URL?: string;
  readonly VITE_GENLAYER_EXPLORER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
