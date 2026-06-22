# Soroban Contract Development — DeFiWise

Patterns for writing and modifying the Rust/Soroban contracts in `contracts/`.

## Project setup

```toml
# contracts/Cargo.toml (workspace)
[workspace]
members = ["xp-token", "badge-nft"]

# Per-contract Cargo.toml
[dependencies]
soroban-sdk = { version = "23.1.0", features = ["testutils"] }  # testutils only in dev
```

Compile target: `wasm32v1-none` (not `wasm32-unknown-unknown`).

```bash
cargo build --target wasm32v1-none --release
cargo test
```

---

## Contract skeleton

```rust
#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
}

#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }
}
```

---

## Storage tiers

Soroban has three storage scopes — pick the right one:

| Tier | Use for | Rent behavior |
|---|---|---|
| `instance` | Contract-global state (admin, counters, config) | Paid once per contract; evicted if contract is archived |
| `persistent` | Per-user/per-key state (balances, badges, completions) | Each entry rents independently; evict if unused |
| `temporary` | Short-lived state (nonces, cache) | Expires after TTL, no eviction, just disappears |

In DeFiWise:
- `Admin`, `TotalSupply`, `NextTokenId` → instance
- `Balance`, `HistoricalBalance`, `CompletedChallenge`, `Badge`, `UserBadges`, `ModuleBadge` → persistent

```rust
// Instance read/write
env.storage().instance().get(&DataKey::Admin).unwrap()
env.storage().instance().set(&DataKey::Admin, &value);

// Persistent read with fallback
let balance: i128 = env.storage().persistent().get(&DataKey::Balance(user.clone())).unwrap_or(0);
env.storage().persistent().set(&DataKey::Balance(user), &new_balance);
```

---

## Auth patterns

```rust
// Require the admin to have signed the transaction
let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
admin.require_auth();

// Require the user themselves (for user-initiated actions)
user.require_auth();
```

`require_auth()` panics if the signature is missing or invalid — no manual error return needed.

For admin-gated functions (`reward_quiz`, `mint_badge`): call `admin.require_auth()` before any state mutation.

---

## Events

```rust
use soroban_sdk::symbol_short;

// symbol_short! accepts up to 9 ASCII chars
env.events().publish(
    (symbol_short!("xp_mint"), user.clone()),  // (topic, subtopic)
    reward,                                     // data
);
```

`symbol_short!` is a compile-time macro. Use it for event topic names. For longer strings, use `Symbol::new(&env, "my_event_name")`.

---

## Structs in storage

```rust
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct BadgeInfo {
    pub owner: Address,
    pub module_id: String,
    pub xp_earned: i128,
    pub quiz_score: u32,
    pub timestamp: u64,
}
```

`#[contracttype]` is required for any type stored or returned from a contract. `#[derive(Clone)]` is always required. `Debug` and `PartialEq` are needed for tests.

---

## Vec in storage

```rust
use soroban_sdk::Vec;

// Read existing or init empty
let mut badges: Vec<u64> = env
    .storage()
    .persistent()
    .get(&DataKey::UserBadges(user.clone()))
    .unwrap_or(Vec::new(&env));  // Vec::new requires env reference

badges.push_back(token_id);
env.storage().persistent().set(&DataKey::UserBadges(user), &badges);
```

Note: Soroban's `Vec` is not the std `Vec`. It always needs `&env` to construct.

---

## Testing

```rust
// contracts/xp-token/src/test.rs
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_reward_quiz() {
        let env = Env::default();
        env.mock_all_auths();  // bypass auth checks in tests

        let contract_id = env.register(XpToken, ());
        let client = XpTokenClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        client.initialize(&admin);
        client.reward_quiz(&user, &String::from_str(&env, "quiz-1"), &3, &4, &100);

        assert_eq!(client.balance(&user), 75);
        assert_eq!(client.historical_balance(&user), 75);
        assert!(client.is_completed(&user, &String::from_str(&env, "quiz-1")));
    }
}
```

Key test utilities:
- `Env::default()` — fresh test environment
- `env.mock_all_auths()` — skip signature verification (use in unit tests, not integration tests)
- `Address::generate(&env)` — random address for testing
- `String::from_str(&env, "literal")` — Soroban String (not std String)
- `env.register(MyContract, ())` — deploy the contract; second arg is constructor args tuple

---

## Common pitfalls

- **`std` types don't work.** Use `soroban_sdk::{String, Vec, Map}`, not `std::string::String`.
- **`#[no_std]` at top of every file** — the runtime has no OS.
- **Panics are fine for invariant violations** — they revert the transaction. Use `panic!("message")` for guard conditions.
- **`timestamp`** — use `env.ledger().timestamp()`, not `std::time`.
- **Don't store raw private keys** in contract storage — they're not secret on-chain.
- **`clone()` everything** passed to storage calls if you need to reuse the value after.

---

## Adding a new function to an existing contract

1. Add the function to `impl MyContract` in `lib.rs`
2. If it needs a new storage key, add a variant to `DataKey` enum
3. If it returns a new struct, derive `#[contracttype]` on it
4. Write a test in `test.rs`
5. Recompile: `cargo build --target wasm32v1-none --release`
6. Add a helper in `src/lib/stellar.ts` if the frontend needs to call it
7. Update `src/lib/stellar.ts` `CONTRACTS` map if redeploying (new contract ID)
