# DeFiWise — Stellar

DeFiWise is a Spanish-language DeFi education platform on Stellar/Soroban. Users complete structured learning paths, pass quizzes (≥75% to advance), and earn on-chain rewards: XP tokens and NFT badges recorded on Stellar Testnet.

## Commands

```bash
# Frontend
npm run dev       # dev server at localhost:3000
npm run build     # production build
npm run lint      # ESLint

# Soroban contracts (run from /contracts)
cargo build --target wasm32v1-none --release   # compile to WASM
cargo test                                      # unit tests
```

## Architecture

```
src/
  app/          Next.js 14 app router pages
  components/
    stellar/    ConnectWalletButton, OnChainStatus
  hooks/
    useStellarWallet.ts    Freighter connect/disconnect/sign
    useStellarProgress.ts  On-chain XP + badge queries
    useProgress.ts         localStorage progress (lessons, scores, XP)
  lib/
    stellar.ts  Core SDK layer: buildContractCall, submitTransaction,
                queryContract, and all helper query functions
  data/
    courses.ts  All static course/module/lesson/quiz content

contracts/
  xp-token/src/lib.rs    Fungible XP reward token (Soroban)
  badge-nft/src/lib.rs   NFT badge per completed module (Soroban)
```

The app has two progress layers that must stay in sync:
- **localStorage** (`useProgress.ts`): lesson completion, quiz scores, local XP. Fast, works without wallet.
- **On-chain** (`useStellarProgress.ts` → `stellar.ts`): authoritative XP and badge ownership. Requires Freighter connected.

## Invariants

- The admin private key never appears in frontend code. For testnet demos the user signs; in production, contract calls that need admin auth (`reward_quiz`, `mint_badge`) would go through a backend signer.
- `historical_balance` in the XP contract is append-only — it never decreases. Use it for unlock gating (`meets_requirement`), not `balance`.
- One badge per user per module (`badge already minted for this module` panic on second attempt).
- One XP reward per user per `challenge_id` (`challenge already completed` panic on second attempt).
- Quiz pass threshold is 75% — hardcoded in `useProgress.ts:completeQuiz` and matched in `QuizView.tsx`.
- All Soroban calls follow the simulate → assemble → sign → submit pattern (never skip simulate).
- Read-only queries use a zero-sequence throwaway account (`GAAA...AWHF`) — no signing needed.
- Network is always Stellar Testnet. Never add mainnet contract addresses without explicit confirmation.

## Skills

This project uses the following agent skills. Load them with `/skill <name>` when working in that area:

| Skill | When to use |
|-------|-------------|
| `stellar-dapp` | Wallet connection (Freighter), transaction building, ScVal conversions, RPC patterns |
| `defiwise-contracts` | XP token and Badge NFT contract functions, addresses, storage layout, events |
| `soroban-dev` | Writing or modifying Rust/Soroban contracts: storage, auth, testing patterns |
