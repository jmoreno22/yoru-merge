import { describe, expect, it } from 'vitest';
import { avatarGradient, initialsFrom } from './avatar';

describe('initialsFrom', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsFrom('Jane Doe')).toBe('JD');
  });

  it('splits the local part of an email address', () => {
    expect(initialsFrom('jane.doe@example.com')).toBe('JD');
  });

  it('falls back to the first two letters of a single word', () => {
    expect(initialsFrom('octocat')).toBe('OC');
  });

  it('marks an empty author', () => {
    expect(initialsFrom('   ')).toBe('?');
  });
});

describe('avatarGradient', () => {
  it('is stable for the same seed', () => {
    expect(avatarGradient('jane@example.com')).toEqual(
      avatarGradient('jane@example.com'),
    );
  });

  it('ignores case and surrounding whitespace', () => {
    expect(avatarGradient(' Jane@Example.com ')).toEqual(
      avatarGradient('jane@example.com'),
    );
  });

  it('spreads different seeds across the palette', () => {
    const seeds = ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com', 'f@x.com'];
    const distinct = new Set(seeds.map((s) => avatarGradient(s).from));
    expect(distinct.size).toBeGreaterThan(1);
  });
});
