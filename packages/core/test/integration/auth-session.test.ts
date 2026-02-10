import { describe, it, expect } from 'bun:test';
import { initializeCoco } from '../../Manager';
import { MemoryRepositories } from '../../repositories/memory';

const mintUrl = process.env.MINT_URL;

if (!mintUrl) {
  throw new Error('MINT_URL is not set');
}

describe('Auth Session (Device Code Flow)', () => {
  it('should authenticate via OIDC device code and wire AuthProvider', async () => {
    const repositories = new MemoryRepositories();
    await repositories.init();

    const mgr = await initializeCoco({
      repo: repositories,
      seedGetter: async () => new Uint8Array(32),
      watchers: {
        mintQuoteWatcher: { disabled: true },
        proofStateWatcher: { disabled: true },
      },
      processors: {
        mintQuoteProcessor: { disabled: true },
      },
    });

    // Start Device Code Flow via mgr.auth
    const device = await mgr.auth.startDeviceAuth(mintUrl);

    // Display authorization instructions
    console.log('\n========================================');
    console.log('  OIDC Device Code Authorization');
    console.log('========================================');
    console.log(`  Visit: ${device.verification_uri_complete || device.verification_uri}`);
    console.log(`  Code:  ${device.user_code}`);
    console.log('  Waiting for authorization...');
    console.log('========================================\n');

    // Wait for user to authorize in browser
    const tokens = await device.poll();

    expect(tokens.access_token).toBeDefined();
    console.log('Authorization successful - access_token received');

    // Verify session was persisted
    const session = await mgr.auth.getSession(mintUrl);
    expect(session.accessToken).toBe(tokens.access_token!);
    expect(session.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

    // Verify AuthProvider is wired
    const provider = mgr.auth.getAuthProvider(mintUrl);
    expect(provider).toBeDefined();
    expect(provider!.getCAT()).toBe(tokens.access_token!);

    // Verify hasSession
    expect(await mgr.auth.hasSession(mintUrl)).toBe(true);

    // Verify refresh_token if present
    if (tokens.refresh_token) {
      expect(session.refreshToken).toBe(tokens.refresh_token);
    }

    console.log('Auth session established and AuthProvider wired');

    // Logout
    await mgr.auth.logout(mintUrl);
    expect(await mgr.auth.hasSession(mintUrl)).toBe(false);
    expect(mgr.auth.getAuthProvider(mintUrl)).toBeUndefined();
    console.log('Logout verified');
  }, 300000); // 5 min timeout for manual authorization
});
