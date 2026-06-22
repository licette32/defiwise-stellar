# DeFiWise Smart Contracts

Reference for the two Soroban contracts deployed on Stellar Testnet.

## Deployed addresses (Testnet)

```ts
// src/lib/stellar.ts
export const CONTRACTS = {
  XP_TOKEN: "CATAE4HXRWEIVGI2ZW5NGRXIQDNFWZ4YLAKXUU3Q3FKBDT2MPGJECTL4",
  BADGE_NFT: "CDWJE7AM3DFWC6FD2RKBASWP7EITQ2ULJH4FX5JFQRVHXQSXDPJAB3KI",
};

export const ADMIN_PUBLIC_KEY = "GASHSELFFKPP5BTMD73FBODXO65MLGP4JCRIXQNEM3RYCWMRKSGOUVHC";
```

---

## XP Token (`contracts/xp-token/src/lib.rs`)

A fungible reward token. Users accumulate XP by passing quizzes.

### Functions

| Function | Auth | Description |
|---|---|---|
| `initialize(admin)` | none | One-time setup. Panics if called again. |
| `reward_quiz(user, challenge_id, correct, total, max_xp)` | admin | Mint proportional XP. Panics if `challenge_id` already completed. |
| `balance(user)` | none | Current XP balance (read-only) |
| `historical_balance(user)` | none | Cumulative XP, never decreases (read-only) |
| `is_completed(user, challenge_id)` | none | Whether a quiz has been rewarded (read-only) |
| `meets_requirement(user, min_xp)` | none | Checks `historical_balance >= min_xp` (read-only) |
| `total_supply()` | none | Total XP minted across all users (read-only) |
| `admin()` | none | Returns admin address (read-only) |

### XP formula

```rust
// reward = (max_xp * correct) / total
// e.g. 3/4 correct with max_xp=100 → 75 XP
```

`max_xp` is `i128`. Values of 0 from a zero score are recorded (challenge marked completed) but no tokens are minted.

### Storage layout

| Key | Type | Storage tier |
|---|---|---|
| `Admin` | `Address` | instance |
| `TotalSupply` | `i128` | instance |
| `Balance(Address)` | `i128` | persistent |
| `HistoricalBalance(Address)` | `i128` | persistent |
| `CompletedChallenge(Address, String)` | `bool` | persistent |

### Events

```rust
env.events().publish((symbol_short!("xp_mint"), user), reward);
```

### Frontend helpers (src/lib/stellar.ts)

```ts
// Read
getXPBalance(userPublicKey): Promise<bigint>
getHistoricalXP(userPublicKey): Promise<bigint>
isChallengeCompleted(userPublicKey, challengeId): Promise<boolean>

// Build args for reward_quiz write call
buildRewardQuizArgs(userPublicKey, challengeId, correct, total, maxXp): ScVal[]
```

### Calling reward_quiz from frontend

```ts
import { buildContractCall, submitTransaction, buildRewardQuizArgs, CONTRACTS } from "@/lib/stellar";
import { signTransaction } from "@stellar/freighter-api";

const args = buildRewardQuizArgs(
  address,        // user wallet address
  "module-1-quiz",
  3,              // correct answers
  4,              // total questions
  100             // max XP for this quiz
);

const tx = await buildContractCall(CONTRACTS.XP_TOKEN, "reward_quiz", args, address);
const { signedTxXdr } = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
const result = await submitTransaction(signedTxXdr);
```

> Note: `reward_quiz` requires admin auth. In this testnet demo the admin key is injected externally. For production, route this through a backend signer.

---

## Badge NFT (`contracts/badge-nft/src/lib.rs`)

Non-fungible badges: one per user per completed module.

### Functions

| Function | Auth | Description |
|---|---|---|
| `initialize(admin)` | none | One-time setup. Starts token ID counter at 1. |
| `mint_badge(user, module_id, module_title, xp_earned, quiz_score)` | admin | Mints NFT. Returns `u64` token ID. Panics if badge already exists for this module. |
| `get_badge(token_id)` | none | Returns `BadgeInfo` struct (read-only) |
| `user_badges(user)` | none | Returns `Vec<u64>` of token IDs owned (read-only) |
| `has_badge(user, module_id)` | none | Whether user has a badge for this module (read-only) |
| `total_badges()` | none | Count of all badges minted (read-only) |
| `admin()` | none | Returns admin address (read-only) |

### BadgeInfo struct

```rust
pub struct BadgeInfo {
    pub owner: Address,
    pub module_id: String,
    pub module_title: String,
    pub xp_earned: i128,
    pub quiz_score: u32,   // percentage 0–100
    pub timestamp: u64,    // ledger timestamp at mint
}
```

### Storage layout

| Key | Type | Storage tier |
|---|---|---|
| `Admin` | `Address` | instance |
| `NextTokenId` | `u64` | instance |
| `Badge(u64)` | `BadgeInfo` | persistent |
| `UserBadges(Address)` | `Vec<u64>` | persistent |
| `ModuleBadge(Address, String)` | `u64` | persistent |

### Events

```rust
env.events().publish((symbol_short!("badge"), user), token_id);
```

### Frontend helpers (src/lib/stellar.ts)

```ts
// Read
hasBadge(userPublicKey, moduleId): Promise<boolean>

// Build args for mint_badge write call
buildMintBadgeArgs(userPublicKey, moduleId, moduleTitle, xpEarned, quizScore): ScVal[]
```

### Calling mint_badge from frontend

```ts
import { buildContractCall, submitTransaction, buildMintBadgeArgs, CONTRACTS } from "@/lib/stellar";

const args = buildMintBadgeArgs(
  address,
  "module-1",
  "¿Qué es DeFi?",
  75,    // xp earned (i128)
  3      // quiz score out of 4 (u32)
);

const tx = await buildContractCall(CONTRACTS.BADGE_NFT, "mint_badge", args, address);
const { signedTxXdr } = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
const result = await submitTransaction(signedTxXdr);
```

---

## Invariants to enforce in frontend

- Always call `isChallengeCompleted(address, challengeId)` before `reward_quiz` — avoid a failed on-chain tx.
- Always call `hasBadge(address, moduleId)` before `mint_badge` — same reason.
- Sequence rewards: award XP first, then mint the badge (so badge can reflect correct `xp_earned`).
- Use `historicalXP` (not `xpBalance`) for module unlock gating and progress display. Current balance can theoretically be spent; historical never decreases.
- `module_id` strings must be stable — they are storage keys. Changing them breaks existing badge lookups.

---

## Building and testing contracts

```bash
cd contracts

# Build WASM
cargo build --target wasm32v1-none --release

# Run unit tests (no network needed)
cargo test

# Tests live at:
# contracts/xp-token/src/test.rs
# contracts/badge-nft/src/test.rs
```

Workspace Cargo.toml is at `contracts/Cargo.toml` with `soroban-sdk = "23.1.0"`.
