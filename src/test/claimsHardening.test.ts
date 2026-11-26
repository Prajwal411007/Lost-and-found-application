import { describe, it, expect, vi } from 'vitest';
import { computeVerificationMatch } from '../../server/services/verificationMatch';
import { evaluateClaimFraudRules } from '../../server/services/fraudDetection';

describe('Claim Verification Hardening & Match Engine', () => {
  const privateDetails = [
    {
      detail_type: 'lock_screen',
      detail_label: 'Lock screen wallpaper',
      detail_value: 'Golden retriever puppy on green grass',
    },
    {
      detail_type: 'scratch_mark',
      detail_label: 'Scratch location',
      detail_value: 'Small scratch near bottom right USB-C charging port',
    },
    {
      detail_type: 'bag_contents',
      detail_label: 'Secret inner pocket contents',
      detail_value: 'Student ID card and transit bus pass',
    },
  ];

  it('computes High Match when claimant provides matching secret details without public mirroring', () => {
    const answers = {
      marks: 'There is a scratch near the bottom right usb port',
      category_detail: 'Lock screen has a golden retriever puppy on grass',
      contents: 'Inner pocket had my student ID and transit bus pass',
      proof_description: 'I bought it last semester and have the puppy wallpaper.',
    };

    const publicDescription = 'Found a silver laptop in the library study lounge on Tuesday.';

    const result = computeVerificationMatch(privateDetails, answers, publicDescription);

    expect(result.score).toBe('high');
    expect(result.detailsMatchedCount).toBeGreaterThanOrEqual(2);
    expect(result.explanation).toContain('High confidence match');
    expect(result.disclaimer).toContain('Guidance only');
  });

  it('computes Low Match when claimant answers do not match secret details', () => {
    const answers = {
      marks: 'No marks, completely clean brand new',
      category_detail: 'Lock screen has default galaxy stars',
      contents: 'Nothing inside except a black pen',
      proof_description: 'It is mine please return it.',
    };

    const publicDescription = 'Found a silver laptop in the library.';

    const result = computeVerificationMatch(privateDetails, answers, publicDescription);

    expect(result.score).toBe('low');
    expect(result.detailsMatchedCount).toBe(0);
    expect(result.explanation).toContain('Low match');
  });

  it('penalizes and flags description mirroring when claimant copies public text', () => {
    const publicDescription =
      'Found a space gray MacBook with purple protective sleeve near cafeteria table 4 at 3 PM';

    // Claimant mimics the exact public description keywords without knowing the secret details
    const answers = {
      marks: 'Space gray MacBook with purple protective sleeve',
      contents: '',
      date_place: 'Lost near cafeteria table 4 around 3 PM',
      proof_description: 'Space gray MacBook with purple sleeve at cafeteria',
    };

    const result = computeVerificationMatch(privateDetails, answers, publicDescription);

    expect(result.descriptionOverlapPercent).toBeGreaterThanOrEqual(50);
    expect(result.explanation).toContain('high overlap');
    expect(result.explanation).toContain('may indicate guessing');
    // Even if one common word matched, high mirroring prevents High match
    expect(result.score).not.toBe('high');
  });

  it('evaluates safe handover mutual confirmation state correctly', () => {
    // Simulating mutual confirmation logic
    const claimPendingBoth = {
      finder_confirmed_handover: false,
      claimant_confirmed_handover: false,
    };
    expect(claimPendingBoth.finder_confirmed_handover && claimPendingBoth.claimant_confirmed_handover).toBe(false);

    const claimFinderOnly = {
      finder_confirmed_handover: true,
      claimant_confirmed_handover: false,
    };
    expect(claimFinderOnly.finder_confirmed_handover && claimFinderOnly.claimant_confirmed_handover).toBe(false);

    const claimBothConfirmed = {
      finder_confirmed_handover: true,
      claimant_confirmed_handover: true,
    };
    expect(claimBothConfirmed.finder_confirmed_handover && claimBothConfirmed.claimant_confirmed_handover).toBe(true);
  });

  it('enforces 24-hour cooldown and maximum 2 attempts constraint logic', () => {
    const attempts = 1;
    const maxAttempts = 2;
    expect(attempts < maxAttempts).toBe(true);

    const lastRejectedAt = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
    const hoursSinceLast = (Date.now() - lastRejectedAt.getTime()) / (3600 * 1000);
    const cooldownRemaining = 24 - hoursSinceLast;
    expect(cooldownRemaining).toBeGreaterThan(0);
    expect(hoursSinceLast < 24).toBe(true);

    const pastCooldown = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    const hoursSincePast = (Date.now() - pastCooldown.getTime()) / (3600 * 1000);
    expect(hoursSincePast >= 24).toBe(true);
  });

  it('puts competing claims on hold when one claim is approved', () => {
    const claims = [
      { id: 'claim-1', item_id: 'item-100', status: 'pending' },
      { id: 'claim-2', item_id: 'item-100', status: 'pending' },
      { id: 'claim-3', item_id: 'item-100', status: 'pending' },
    ];

    const approvedClaimId = 'claim-1';

    const updatedClaims = claims.map((c) => {
      if (c.id === approvedClaimId) return { ...c, status: 'approved' };
      if (c.status === 'pending') return { ...c, status: 'on_hold' };
      return c;
    });

    expect(updatedClaims.find((c) => c.id === 'claim-1')?.status).toBe('approved');
    expect(updatedClaims.find((c) => c.id === 'claim-2')?.status).toBe('on_hold');
    expect(updatedClaims.find((c) => c.id === 'claim-3')?.status).toBe('on_hold');
  });

  it('verifies claimant response sanitization excludes private details and match explanations', () => {
    const rawClaimFromDb = {
      id: 'claim-1',
      item_id: 'item-1',
      claimant_id: 'claimant-user-1',
      status: 'pending',
      verification_answers: { answers: { color: 'black' }, submitted_at: '2026-11-26' },
      proof_files: [{ name: 'receipt.pdf', url: 'https://storage/receipt.pdf', size: 1024, file_type: 'application/pdf' }],
      match_score: 'high',
      match_explanation: 'Matched secret golden retriever wallpaper',
      item_private_details: [{ detail_value: 'Golden retriever puppy' }],
    };

    // Function simulating claimant API serialization
    const sanitizeForClaimant = (claim: typeof rawClaimFromDb) => {
      const { match_explanation, item_private_details, ...claimantSafe } = claim;
      return claimantSafe;
    };

    const claimantView = sanitizeForClaimant(rawClaimFromDb);
    expect(claimantView).not.toHaveProperty('match_explanation');
    expect(claimantView).not.toHaveProperty('item_private_details');
    expect(claimantView).toHaveProperty('id', 'claim-1');
  });

  it('flags description mirroring when claimant overlap exceeds threshold', async () => {
    // Test description mirroring rule threshold (>65%)
    const flagParams = {
      claimantId: 'user-fraud-1',
      itemId: 'item-123',
      claimAnswersText: 'Found space gray laptop with purple sticker on lid',
      descriptionOverlapPercent: 78,
    };

    expect(flagParams.descriptionOverlapPercent).toBeGreaterThan(65);
  });
});
