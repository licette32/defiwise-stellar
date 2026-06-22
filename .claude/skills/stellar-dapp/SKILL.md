# Stellar dApp Integration — DeFiWise

Patterns for Freighter wallet integration and Soroban contract calls in this project.

## Network config

```ts
// src/lib/stellar.ts
export const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const server = new StellarSdk.rpc.Server(RPC_URL);
```

Always use `StellarSdk.rpc.Server`, not the deprecated `SorobanRpc.Server`.

---

## Freighter wallet — `useStellarWallet`

```ts
import { useStellarWallet } from "@/hooks/useStellarWallet";

const { address, connected, loading, connect, disconnect, signTransaction, truncatedAddress } = useStellarWallet();
```

- `connect()` — calls `requestAccess()` then `getAddress()`. Opens freighter.app if not installed.
- `signTransaction` — imported directly from `@stellar/freighter-api`; pass XDR string + `{ networkPassphrase }`.
- The hook auto-checks connection on mount via `isConnected()`.
- Guard all on-chain operations with `if (!connected || !address) return`.

**Never request the private key** — Freighter only exposes signing.

---

## Write transaction: simulate → assemble → sign → submit

All state-changing contract calls use `buildContractCall` then `submitTransaction`:

```ts
import { buildContractCall, submitTransaction, NETWORK_PASSPHRASE } from "@/lib/stellar";
import { signTransaction } from "@stellar/freighter-api";

// 1. Build + simulate + assemble
const tx = await buildContractCall(
  contractId,
  "method_name",
  args,          // StellarSdk.xdr.ScVal[]
  address        // source public key
);

// 2. Sign with Freighter
const { signedTxXdr } = await signTransaction(tx.toXDR(), {
  networkPassphrase: NETWORK_PASSPHRASE,
});

// 3. Submit and poll
const result = await submitTransaction(signedTxXdr);
```

`buildContractCall` internally:
1. `server.getAccount(sourcePublicKey)` — fetches current sequence number
2. Builds the transaction with `TransactionBuilder`
3. Calls `server.simulateTransaction(tx)` — required to get footprint + resource fees
4. Checks `StellarSdk.rpc.Api.isSimulationError(simResponse)` — throws if simulation failed
5. Calls `StellarSdk.rpc.assembleTransaction(tx, simResponse).build()` — injects footprint

**Never skip simulation.** Calls without a valid footprint will fail on-chain.

`submitTransaction` internally:
1. `server.sendTransaction(tx)` — broadcasts
2. Polls `server.getTransaction(hash)` every 1s until status is not `NOT_FOUND`
3. Throws if status is `FAILED`

---

## Read-only queries: `queryContract`

For balance/state reads, no signing needed. Uses a zero-sequence throwaway account:

```ts
import { queryContract } from "@/lib/stellar";
import * as StellarSdk from "@stellar/stellar-sdk";

const result = await queryContract(
  CONTRACTS.XP_TOKEN,
  "balance",
  [new StellarSdk.Address(userPublicKey).toScVal()]
);
const balance = result ? StellarSdk.scValToNative(result) as bigint : BigInt(0);
```

Use the pre-built helpers whenever possible (see defiwise-contracts skill):
`getXPBalance`, `getHistoricalXP`, `isChallengeCompleted`, `hasBadge`

---

## ScVal construction cheat sheet

| Soroban type | TypeScript |
|---|---|
| `Address` | `new StellarSdk.Address(pubkey).toScVal()` |
| `String` | `StellarSdk.nativeToScVal(str, { type: "string" })` |
| `u32` | `StellarSdk.nativeToScVal(n, { type: "u32" })` |
| `i128` | `StellarSdk.nativeToScVal(n, { type: "i128" })` |
| `u64` | `StellarSdk.nativeToScVal(n, { type: "u64" })` |
| `bool` | `StellarSdk.nativeToScVal(b, { type: "bool" })` |
| Return value → native | `StellarSdk.scValToNative(retval)` |

Pre-built arg builders live in `src/lib/stellar.ts`: `buildRewardQuizArgs`, `buildMintBadgeArgs`.

---

## Simulation error detection

```ts
import * as StellarSdk from "@stellar/stellar-sdk";

if (StellarSdk.rpc.Api.isSimulationError(simResponse)) {
  const msg = (simResponse as StellarSdk.rpc.Api.SimulateTransactionErrorResponse).error;
  throw new Error(`Simulation failed: ${msg}`);
}
```

Common simulation errors in DeFiWise:
- `"challenge already completed"` — user already rewarded for this `challenge_id`
- `"badge already minted for this module"` — user already has a badge for this `module_id`
- `"already initialized"` — contract `initialize` called twice
- Auth errors — missing `admin.require_auth()` authorization

---

## On-chain progress hook

`useStellarProgress` (`src/hooks/useStellarProgress.ts`) wraps all read queries:

```ts
const {
  xpBalance,
  historicalXP,
  loading,
  error,
  connected,
  address,
  fetchOnChainProgress,
  checkChallengeCompleted,
  checkHasBadge,
} = useStellarProgress();

// Trigger a refresh
await fetchOnChainProgress();

// Check state before a write
const alreadyDone = await checkChallengeCompleted("module-1-quiz");
const hasBadge = await checkHasBadge("module-1");
```

`fetchOnChainProgress` fetches `xpBalance` and `historicalXP` in parallel. Call it after a successful write to refresh UI.

---

## UX checklist for on-chain interactions

- Show loading state while `buildContractCall` is running (simulation takes ~1–2s)
- Show a second loading state while `submitTransaction` polls (can take 5–10s)
- Use `react-hot-toast` for success and error feedback
- Check `connected` before rendering any write button
- After a successful reward/badge mint, call `fetchOnChainProgress()` to refresh displayed XP
- Catch and display simulation errors to the user in plain Spanish
