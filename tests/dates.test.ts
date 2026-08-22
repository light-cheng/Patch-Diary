import { describe, expect, it } from 'vitest'
import { baseVersion, nextVersion, parseVersionSuffix } from '../src/lib/dates'

describe('baseVersion', () => {
  it('formats as vYY.M.D', () => {
    expect(baseVersion(new Date(2026, 7, 22))).toBe('v26.8.22')
    expect(baseVersion(new Date(2026, 0, 5))).toBe('v26.1.5')
  })
})

describe('parseVersionSuffix', () => {
  it('returns 0 for exact base', () => {
    expect(parseVersionSuffix('v26.8.22', 'v26.8.22')).toBe(0)
  })
  it('parses numeric suffix', () => {
    expect(parseVersionSuffix('v26.8.22.3', 'v26.8.22')).toBe(3)
    expect(parseVersionSuffix('v26.8.22.12', 'v26.8.22')).toBe(12)
  })
  it('returns null for mismatched base or non-numeric', () => {
    expect(parseVersionSuffix('v26.8.21', 'v26.8.22')).toBeNull()
    expect(parseVersionSuffix('v26.8.22.abc', 'v26.8.22')).toBeNull()
    expect(parseVersionSuffix('v26.8.22.', 'v26.8.22')).toBeNull()
  })
})

describe('nextVersion', () => {
  it('returns base when no existing', () => {
    expect(nextVersion(null, new Date(2026, 7, 22))).toBe('v26.8.22')
    expect(nextVersion(undefined, new Date(2026, 7, 22))).toBe('v26.8.22')
  })
  it('bumps from base to .1', () => {
    expect(nextVersion('v26.8.22', new Date(2026, 7, 22))).toBe('v26.8.22.1')
  })
  it('increments suffix', () => {
    expect(nextVersion('v26.8.22.1', new Date(2026, 7, 22))).toBe('v26.8.22.2')
    expect(nextVersion('v26.8.22.9', new Date(2026, 7, 22))).toBe('v26.8.22.10')
  })
  it('resets when existing is from another day', () => {
    expect(nextVersion('v26.8.21.3', new Date(2026, 7, 22))).toBe('v26.8.22')
    expect(nextVersion('v26.8.22.1', new Date(2026, 7, 23))).toBe('v26.8.23')
  })
})
