# Auth Wallet Feature

Adding NUT-21/22 authentication support (CAT + BAT) to coco-cashu.

## Background

BAT (Blind Auth Token) is a standard ecash proof with `unit:'auth', amount:1`.
Most of the existing proof infrastructure can be reused; only OIDC session management is new.
cashu-ts provides `AuthManager` which handles the full CAT/BAT lifecycle internally.

## Completed

### 1. AuthSession Model
- [x] `models/AuthSession.ts` — session data structure
- [x] `models/index.ts` export

### 2. Repository
- [x] `repositories/index.ts` — `AuthSessionRepository` interface
- [x] `RepositoriesBase` — `authSessionRepository` field
- [x] `repositories/memory/MemoryAuthSessionRepository.ts` — in-memory implementation for tests
- [x] `repositories/memory/index.ts` export
- [x] `MemoryRepositories.ts` wiring

### 3. Errors
- [x] `models/Error.ts` — `AuthSessionError`, `AuthSessionExpiredError`

### 4. Events
- [x] `events/types.ts` CoreEvents:
  - `auth-session:updated`
  - `auth-session:deleted`
  - `auth-session:expired`

### 5. Service
- [x] `services/AuthSessionService.ts` — session CRUD + expiration validation
- [x] `services/index.ts` export

### 6. Tests
- [x] `test/unit/AuthSessionService.test.ts` — unit tests

### 7. API Integration (AuthApi + Manager + MintAdapter)
- [x] `api/AuthApi.ts` — orchestrates cashu-ts AuthManager per mint
  - `startDeviceAuth(mintUrl)` — OIDC Device Code Flow
  - `login(mintUrl, tokens)` — manual login with externally obtained tokens
  - `restore(mintUrl)` — restore session on app restart
  - `logout(mintUrl)` — delete session + disconnect AuthProvider
  - `getSession(mintUrl)` / `hasSession(mintUrl)` — session queries
  - `getAuthProvider(mintUrl)` — access cashu-ts AuthProvider
- [x] `Manager.ts` — `readonly auth: AuthApi` property
- [x] `MintAdapter.ts` — `setAuthProvider`/`clearAuthProvider`
  - Passes `authProvider` to cashu-ts `Mint` constructor
- [x] `api/index.ts` export
- [x] `services/AuthSessionService.ts` — fixed Logger import (`@nestjs/common` → `@core/logging`)
- [x] `test/unit/AuthApi.test.ts` — 9 unit tests
- [x] `test/integration/auth-session.test.ts` — end-to-end via `mgr.auth.startDeviceAuth()`

## Remaining Work

### Phase 1: Storage Adapters (Persistence)

Memory adapter is test-only. Platform adapters needed for real persistence:

- [ ] `packages/sqlite3/` — Node/CLI
- [ ] `packages/indexeddb/` — Web browser
- [ ] `packages/expo-sqlite/` — React Native
- [ ] `packages/adapter-tests/` — contract tests

### Phase 2: BAT Persistence (after multi-unit support)

Persist the cashu-ts AuthManager BAT pool across app restarts:

- [ ] `AuthManager.exportPool()` → save to repository
- [ ] `AuthManager.importPool()` → restore on startup
- [ ] Parameterize WalletService unit (`unit:'auth'` keyset support)
- [ ] Wire authProvider into `WalletService.buildWallet()` Mint/Wallet instances

### Phase 3: React Wrapper (optional)

- [ ] `packages/react/` auth hooks
  - `useAuthSession()`
  - `useBatPool()`

## Architecture (Current)

```
mgr.auth.startDeviceAuth(mintUrl)
  → Creates AuthManager + OIDCAuth (cashu-ts)
  → oidc.startDeviceAuth() → user authorizes → poll()
  → AuthSessionService.saveSession() (persistence)
  → MintAdapter.setAuthProvider() (injects authProvider into Mint)
  → All subsequent Mint requests auto-include CAT/BAT headers

AuthManager (built into cashu-ts):
  - CAT storage / retrieval / auto-refresh via OIDCAuth
  - BAT auto-minting / pool management / DLEQ validation
  - Auto-detects NUT-21 (CAT) vs NUT-22 (BAT) per endpoint
```

## Reference Patterns

| New | Existing Pattern |
|-----|-----------------|
| AuthSessionRepository | MintQuoteRepository |
| AuthSessionService | MintQuoteService |

## Conventions

- **Normalize mint URLs**: always pass through `normalizeMintUrl()` before storage/comparison
- **Emit events**: emit EventBus events on every state change
- **Domain errors**: use `models/Error.ts` classes instead of plain `new Error()`
- **Include cause**: preserve original error when wrapping

## Running Tests

```sh
# All core tests
bun run --filter='coco-cashu-core' test

# AuthSessionService only
cd packages/core
bun test test/unit/AuthSessionService.test.ts

# AuthApi only
bun test test/unit/AuthApi.test.ts

# Integration test (requires running mint with NUT-21/22 + manual OIDC authorization)
MINT_URL=http://localhost:8085 bun test test/integration/auth-session.test.ts --timeout 300000
```
