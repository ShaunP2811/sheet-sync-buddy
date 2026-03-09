import { describe, it, expect } from 'vitest';
import {
  runComparison,
  normalizeEmail,
  normalizePhone,
  isBlank,
} from './comparisonEngine';
import type { ColumnMapping, SheetRow } from '@/types/sync';

// ─── Normalization Tests ─────────────────────────────────────

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  John@Example.COM  ')).toBe('john@example.com');
  });
  it('returns empty for null/undefined', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
  });
});

describe('normalizePhone', () => {
  it('strips spaces and dashes', () => {
    expect(normalizePhone(' +1-234-567 8901 ')).toBe('12345678901');
  });
  it('strips parentheses', () => {
    expect(normalizePhone('(123) 456-7890')).toBe('1234567890');
  });
  it('strips + prefix', () => {
    expect(normalizePhone('+60123456789')).toBe('60123456789');
  });
  it('strips p+ prefix', () => {
    expect(normalizePhone('p+60123456789')).toBe('60123456789');
  });
  it('strips p+ prefix with formatting', () => {
    expect(normalizePhone('p+1-234-567')).toBe('1234567');
  });
  it('returns empty for null/undefined', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });
});

describe('isBlank', () => {
  it('is true for empty/whitespace', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank('   ')).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
  });
  it('is false for values', () => {
    expect(isBlank('hello')).toBe(false);
  });
});

// ─── Comparison Engine Tests ─────────────────────────────────

const MAPPINGS: ColumnMapping[] = [
  { sourceColumn: 'email', targetColumn: 'Email' },
  { sourceColumn: 'phone', targetColumn: 'Phoneno' },
  { sourceColumn: 'name', targetColumn: 'FullName' },
  { sourceColumn: 'city', targetColumn: 'Location' },
];

describe('runComparison', () => {
  it('identifies new leads (no match in primary)', () => {
    const primary: SheetRow[] = [
      { Email: 'existing@test.com', Phoneno: '111', FullName: 'Existing', Location: 'NYC' },
    ];
    const source: SheetRow[] = [
      { email: 'new@test.com', phone: '222', name: 'New Person', city: 'LA' },
    ];

    const result = runComparison(primary, source, MAPPINGS);

    expect(result.summary.newLeadCount).toBe(1);
    expect(result.summary.updateCount).toBe(0);
    expect(result.summary.skippedCount).toBe(0);
    expect(result.newLeads[0].mappedRow['Email']).toBe('new@test.com');
    expect(result.newLeads[0].mappedRow['FullName']).toBe('New Person');
  });

  it('fills blank fields on matched rows', () => {
    const primary: SheetRow[] = [
      { Email: 'user@test.com', Phoneno: '111', FullName: 'User', Location: '' },
    ];
    const source: SheetRow[] = [
      { email: 'user@test.com', phone: '111', name: 'User', city: 'Boston' },
    ];

    const result = runComparison(primary, source, MAPPINGS);

    expect(result.summary.updateCount).toBe(1);
    expect(result.updates[0].fieldsToFill).toEqual({ Location: 'Boston' });
    expect(result.updates[0].matchedBy).toBe('email');
  });

  it('never overwrites non-empty primary values', () => {
    const primary: SheetRow[] = [
      { Email: 'user@test.com', Phoneno: '111', FullName: 'Original Name', Location: 'NYC' },
    ];
    const source: SheetRow[] = [
      { email: 'user@test.com', phone: '111', name: 'Different Name', city: 'Boston' },
    ];

    const result = runComparison(primary, source, MAPPINGS);

    // Both FullName and Location are non-empty in primary, so nothing to fill
    expect(result.summary.skippedCount).toBe(1);
    expect(result.skipped[0].reason).toBe('Matched but no blank fields to fill');
  });

  it('skips rows with no usable Email or Phoneno', () => {
    const primary: SheetRow[] = [];
    const source: SheetRow[] = [
      { email: '', phone: '', name: 'Nobody', city: 'Nowhere' },
    ];

    const result = runComparison(primary, source, MAPPINGS);

    expect(result.summary.skippedCount).toBe(1);
    expect(result.skipped[0].reason).toBe('No usable Email or Phoneno');
  });

  it('falls back to phone matching when email does not match', () => {
    const primary: SheetRow[] = [
      { Email: 'different@test.com', Phoneno: '5551234', FullName: '', Location: 'NYC' },
    ];
    const source: SheetRow[] = [
      { email: 'other@test.com', phone: '555-1234', name: 'Phone Match', city: '' },
    ];

    const result = runComparison(primary, source, MAPPINGS);

    expect(result.summary.updateCount).toBe(1);
    expect(result.updates[0].matchedBy).toBe('phoneno');
    expect(result.updates[0].fieldsToFill['FullName']).toBe('Phone Match');
  });

  it('handles email normalization for matching', () => {
    const primary: SheetRow[] = [
      { Email: 'USER@Test.Com', Phoneno: '', FullName: '', Location: '' },
    ];
    const source: SheetRow[] = [
      { email: '  user@test.com  ', phone: '', name: 'Found', city: 'LA' },
    ];

    const result = runComparison(primary, source, MAPPINGS);

    expect(result.summary.updateCount).toBe(1);
    expect(result.updates[0].fieldsToFill['FullName']).toBe('Found');
    expect(result.updates[0].fieldsToFill['Location']).toBe('LA');
  });

  it('handles mixed scenario with new, update, and skipped', () => {
    const primary: SheetRow[] = [
      { Email: 'a@test.com', Phoneno: '111', FullName: 'A', Location: '' },
      { Email: 'b@test.com', Phoneno: '222', FullName: 'B', Location: 'NYC' },
    ];
    const source: SheetRow[] = [
      { email: 'a@test.com', phone: '111', name: 'A', city: 'Boston' },  // update
      { email: 'b@test.com', phone: '222', name: 'B', city: 'LA' },      // skipped (Location filled)
      { email: 'c@test.com', phone: '333', name: 'C', city: 'SF' },      // new
      { email: '', phone: '', name: 'D', city: 'X' },                      // skipped (no key)
    ];

    const result = runComparison(primary, source, MAPPINGS);

    expect(result.summary.newLeadCount).toBe(1);
    expect(result.summary.updateCount).toBe(1);
    expect(result.summary.skippedCount).toBe(2);
  });
});
