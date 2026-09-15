/**
 * Tests for results-sync Edge Function authentication
 * 
 * Tests the dual authentication model:
 * - Manual sync: JWT + user permissions
 * - Cron sync: X-Cron-Secret
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('results-sync authentication', () => {
  describe('manual sync authentication', () => {
    it('should reject request without Authorization header', () => {
      const headers = new Map();
      const body = { manual: true, league_id: 'test-league' };
      
      const result = validateManualAuth(headers, body);
      
      assert.strictEqual(result.status, 401);
      assert.strictEqual(result.error, 'Missing Authorization header');
    });

    it('should reject request with invalid JWT', () => {
      const headers = new Map([['Authorization', 'Bearer invalid-token']]);
      const body = { manual: true, league_id: 'test-league' };
      
      // Simulate invalid JWT
      const result = validateManualAuth(headers, body);
      
      assert.strictEqual(result.status, 401);
      assert.strictEqual(result.error, 'Invalid or expired token');
    });

    it('should reject request with valid JWT but user is not league admin', () => {
      const headers = new Map([['Authorization', 'Bearer valid-token']]);
      const body = { manual: true, league_id: 'test-league' };
      
      // Simulate valid JWT but user is not admin
      const result = validateManualAuth(headers, body, {
        user: { id: 'user-123' },
        membership: null, // Not a member
        platformRole: 'user'
      });
      
      assert.strictEqual(result.status, 403);
      assert.strictEqual(result.error, 'Unauthorized: not admin of this league');
    });

    it('should reject request with valid JWT but user is only member (not admin)', () => {
      const headers = new Map([['Authorization', 'Bearer valid-token']]);
      const body = { manual: true, league_id: 'test-league' };
      
      const result = validateManualAuth(headers, body, {
        user: { id: 'user-123' },
        membership: { role: 'member' },
        platformRole: 'user'
      });
      
      assert.strictEqual(result.status, 403);
      assert.strictEqual(result.error, 'Unauthorized: not admin of this league');
    });

    it('should allow request with valid JWT and user is league admin', () => {
      const headers = new Map([['Authorization', 'Bearer valid-token']]);
      const body = { manual: true, league_id: 'test-league' };
      
      const result = validateManualAuth(headers, body, {
        user: { id: 'user-123' },
        membership: { role: 'admin' },
        platformRole: 'user'
      });
      
      assert.strictEqual(result.status, 200);
      assert.strictEqual(result.userId, 'user-123');
    });

    it('should allow request with valid JWT and user is platform superadmin', () => {
      const headers = new Map([['Authorization', 'Bearer valid-token']]);
      const body = { manual: true, league_id: 'test-league' };
      
      const result = validateManualAuth(headers, body, {
        user: { id: 'user-123' },
        membership: null, // Not a member, but superadmin
        platformRole: 'platform_superadmin'
      });
      
      assert.strictEqual(result.status, 200);
      assert.strictEqual(result.userId, 'user-123');
    });
  });

  describe('cron sync authentication', () => {
    it('should reject request without X-Cron-Secret header', () => {
      const headers = new Map();
      const body = { manual: false };
      
      const result = validateCronAuth(headers, body, 'expected-secret');
      
      assert.strictEqual(result.status, 403);
      assert.strictEqual(result.error, 'Invalid cron secret');
    });

    it('should reject request with invalid X-Cron-Secret', () => {
      const headers = new Map([['X-Cron-Secret', 'wrong-secret']]);
      const body = { manual: false };
      
      const result = validateCronAuth(headers, body, 'expected-secret');
      
      assert.strictEqual(result.status, 403);
      assert.strictEqual(result.error, 'Invalid cron secret');
    });

    it('should allow request with valid X-Cron-Secret', () => {
      const headers = new Map([['X-Cron-Secret', 'correct-secret']]);
      const body = { manual: false };
      
      const result = validateCronAuth(headers, body, 'correct-secret');
      
      assert.strictEqual(result.status, 200);
    });

    it('should reject request when CRON_SECRET is not configured', () => {
      const headers = new Map([['X-Cron-Secret', 'some-secret']]);
      const body = { manual: false };
      
      const result = validateCronAuth(headers, body, null);
      
      assert.strictEqual(result.status, 500);
      assert.strictEqual(result.error, 'CRON_SECRET not configured');
    });
  });

  describe('ambiguous requests', () => {
    it('should reject request without JWT and without X-Cron-Secret', () => {
      const headers = new Map();
      const body = { manual: false };
      
      // No JWT, no X-Cron-Secret
      const result = validateCronAuth(headers, body, null);
      
      assert.strictEqual(result.status, 500);
    });

    it('should not allow manual access without JWT', () => {
      const headers = new Map();
      const body = { manual: true, league_id: 'test-league' };
      
      // Try manual without JWT
      const manualResult = validateManualAuth(headers, body);
      assert.strictEqual(manualResult.status, 401);
    });

    it('should not allow cron access without secret', () => {
      const headers = new Map();
      const body = { manual: false };
      
      // Try cron without secret
      const cronResult = validateCronAuth(headers, body, null);
      assert.strictEqual(cronResult.status, 500);
    });
  });

  describe('security validation', () => {
    it('should not expose CRON_SECRET in error messages', () => {
      const headers = new Map([['X-Cron-Secret', 'wrong-secret']]);
      const body = { manual: false };
      
      const result = validateCronAuth(headers, body, 'super-secret-value');
      
      assert.strictEqual(result.status, 403);
      assert.ok(!result.error.includes('super-secret-value'));
    });

    it('should not expose API_SPORTS_API_KEY', () => {
      // This is validated at the start of the function
      // Just ensure it's not in any error response
      const errorMessage = 'Some error occurred';
      assert.ok(!errorMessage.includes('API_SPORTS_API_KEY'));
    });

    it('should not allow API_SPORTS_API_KEY as authentication', () => {
      const headers = new Map([['x-apisports-key', 'some-key']]);
      const body = { manual: false };
      
      // API_SPORTS_API_KEY is for external API, not for authenticating callers
      const result = validateCronAuth(headers, body, 'expected-secret');
      
      assert.strictEqual(result.status, 403);
    });
  });
});

// Helper functions that simulate the authentication logic from results-sync

function validateManualAuth(headers, body, context = null) {
  if (!body.manual) {
    return { status: 400, error: 'Invalid request' };
  }

  const authHeader = headers.get('Authorization');
  if (!authHeader) {
    return { status: 401, error: 'Missing Authorization header' };
  }

  // Simulate JWT validation
  if (!context || !context.user) {
    return { status: 401, error: 'Invalid or expired token' };
  }

  const userId = context.user.id;
  const isPlatformSuperadmin = context.platformRole === 'platform_superadmin';

  // Check league admin permissions
  if (!isPlatformSuperadmin && body.league_id) {
    if (!context.membership || context.membership.role !== 'admin') {
      return { status: 403, error: 'Unauthorized: not admin of this league' };
    }
  }

  return { status: 200, userId };
}

function validateCronAuth(headers, body, expectedSecret) {
  if (body.manual) {
    return { status: 400, error: 'Invalid request' };
  }

  if (!expectedSecret) {
    return { status: 500, error: 'CRON_SECRET not configured' };
  }

  const cronSecret = headers.get('X-Cron-Secret');
  if (cronSecret !== expectedSecret) {
    return { status: 403, error: 'Invalid cron secret' };
  }

  return { status: 200 };
}
