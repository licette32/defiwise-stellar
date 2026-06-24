# DeFiWise — Team Review

Four perspectives on the current architecture, the gaps, and what to prioritize before the PULSO submission (June 30).

---

## Tyler — System Architect

**What's solid:**
- The two-contract design (XP token + Badge NFT) is clean and the on-chain invariants are well-chosen. `historical_balance` as an append-only unlock gate is the right call — it is unforgeable and never decreases regardless of what happens to the current balance.
- The simulate → assemble → sign → submit pattern is correctly implemented in `stellar.ts`. The zero-account read pattern avoids unnecessary signing for queries.

**What concerns me:**
- The `/api/reward` route is a single point of failure in the critical path. If `reward_quiz` succeeds but `mint_badge` fails, the user gets XP but no badge — an inconsistent on-chain state with no recovery path. The route needs to handle this atomically: either treat badge mint failure as non-fatal and log for retry, or return partial success clearly so the frontend can distinguish.
- There is no indexing layer. As soon as a second integration (Etherfuse, Soroswap) is added, the app will need to aggregate state from multiple contracts. Querying each one on-demand via RPC is fine for now, but the architecture should acknowledge this ceiling.
- The `challenge_id` format is nowhere documented. If the frontend and backend ever generate it differently, the on-chain deduplication guard breaks silently.

**Priority for PULSO:**
Close the on-chain write path before anything else. SWK, Privy, and Etherfuse all sit on top of a working reward loop — if the loop is broken, no integration saves the demo.

**Integration pick:** Etherfuse for the module that already exists; Aquarius routing API for the interactive swap component. Both are low-risk on testnet.

---

## Nicole — Product Manager

**What's solid:**
- The core learning loop (lesson → quiz → reward) is a strong product concept. The XP + badge structure gives students two distinct signals: cumulative progress (XP) and milestone achievement (badge). That maps well to how people think about learning.
- The course content is already in Spanish and grounded in real Stellar examples. That's a real differentiator.

**What concerns me:**
- The false "NFT registered on Stellar" claim (issue #15) is the most urgent product risk. If even one user notices it is fake, the platform loses credibility entirely. This is not a cosmetic bug — it breaks the trust contract with the user.
- The user who reaches the end of the quiz today has no reward, no proof, and a broken promise. The loop does not close. Everything else — new routes, integrations, a second course — is a distraction until the loop closes.
- The `/dashboard/events` stub and the missing `/dashboard/progress` page are fine to leave for after the hackathon. They do not appear in the critical demo path.

**Priority for PULSO:**
Fix the broken loop (#13, #15, #16, #17 are all one problem). Then ship Privy — it directly validates the core customer discovery finding: the target user wants to learn DeFi but does not have a wallet yet. Requiring Freighter at the start is a contradiction in a DeFi education product.

**Integration pick:** Privy unlocks the target audience. Etherfuse module #9 is the highest-leverage demo moment because the content already exists — the integration adds real-world data to a lesson that is otherwise purely theoretical.

---

## Justin — Business Analyst

**What's solid:**
- DeFiWise has no direct competitor in the Stellar ecosystem. A search of the 728 projects in the LumenLoop database does not surface another platform doing structured, on-chain-rewarded DeFi education in Spanish. That is a real positioning advantage.
- The timing is right. PULSO runs in Argentina and Colombia — two countries where demand for dollar-denominated savings and inflation hedging is not academic, it is a daily reality. DeFiWise is one of the few hackathon submissions that can make that argument honestly.

**What concerns me:**
- The architecture document does not answer what happens after the first course. One course with five or six modules is a prototype, not a platform. Judges will ask: what is the retention loop? What keeps a user coming back after they finish the intro course?
- The business model is invisible. Is DeFiWise free? Funded by SCF grants? Does the XP token ever have value beyond unlocking the next module? For the pitch deck this needs a clear answer, even if it is "SCF-funded public good."

**Framing for the pitch:**
Position DeFiWise as **the onboarding layer for Stellar DeFi**. Every user who completes a course is a qualified Stellar user: they have a wallet, they understand how swaps and lending work, and they have already interacted with real protocols on testnet. That is an ecosystem argument — DeFiWise does not compete with Soroswap or Etherfuse, it produces the users those protocols need.

**After the hackathon:** This is a strong SCF Build Award candidate under the Integration Track. The integration list used for PULSO is the same list SCF evaluates against.

---

## Elliot — Senior Developer

**What's solid:**
- `buildRewardQuizArgs` and `buildMintBadgeArgs` already exist in `stellar.ts`. The backend signer is not a rebuild — it is wiring existing arg builders into an API route and adding the admin key. This is probably 100-150 lines of new code.
- The hydration utilities in `lib/hydration.ts` are clean. SSR safety is handled correctly, which is a common failure point in Next.js + wallet apps.

**What concerns me:**
- Issue #13 (last correct answer counted twice) is an off-by-one in `QuizView.tsx`. This inflates every passing score and means some users pass who should not. It should take under 30 minutes to find and fix.
- Issue #14 (Previous button navigates forward) is almost certainly an index direction bug — `currentIndex + 1` where it should be `currentIndex - 1`. Fix this before the demo; a broken navigation button in a learning app is immediately visible to judges.
- The `challenge_id` used in `buildRewardQuizArgs` must match exactly between frontend and backend. If they diverge, the contract's deduplication guard will either block a legitimate reward or fail to prevent a duplicate. Define the format explicitly and share it (e.g., `"${courseId}:${moduleId}"`).

**Realistic 6-day plan:**
- Day 1: Fix #13 and #14 (bugs, < 2 hours total). Add `/dashboard/progress` page.tsx (components already exist).
- Day 2-3: Build `/api/reward` (admin signer). Wire `QuizView.tsx` to call it. Remove the false NFT claim.
- Day 4: Integrate Stellar Wallets Kit (replaces raw Freighter API, < 1 day).
- Day 5: Add Etherfuse yield display to module #9 lesson content.
- Day 6: Buffer. Record demo video. Verify testnet deployment end-to-end.

Privy is achievable but adds risk — the embedded wallet address must flow correctly into `reward_quiz`, and that integration path has not been tested. If the core loop is not solid by day 4, drop Privy and focus on polish.
