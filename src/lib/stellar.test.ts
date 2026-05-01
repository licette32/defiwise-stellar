import { describe, it, expect } from 'vitest';
import { buildRewardQuizArgs, buildMintBadgeArgs } from './stellar';
import * as StellarSdk from '@stellar/stellar-sdk';

describe('stellar validations', () => {
  describe('buildRewardQuizArgs', () => {
    it('throws error when userPublicKey is empty', () => {
      expect(() => buildRewardQuizArgs('', 'challenge1', 5, 10, 50)).toThrow('userPublicKey cannot be empty');
      expect(() => buildRewardQuizArgs('   ', 'challenge1', 5, 10, 50)).toThrow('userPublicKey cannot be empty');
    });

    it('throws error when challengeId is empty', () => {
      expect(() => buildRewardQuizArgs('GASHSELFFKPP5BTMD73FBODXO65MLGP4JCRIXQNEM3RYCWMRKSGOUVHC', '', 5, 10, 50)).toThrow('challengeId cannot be empty');
    });

    it('throws error when maxXp is not a positive integer', () => {
      expect(() => buildRewardQuizArgs('GASHSELFFKPP5BTMD73FBODXO65MLGP4JCRIXQNEM3RYCWMRKSGOUVHC', 'challenge1', 5, 10, 0)).toThrow('xpAmount must be a positive integer');
      expect(() => buildRewardQuizArgs('GASHSELFFKPP5BTMD73FBODXO65MLGP4JCRIXQNEM3RYCWMRKSGOUVHC', 'challenge1', 5, 10, -10)).toThrow('xpAmount must be a positive integer');
      expect(() => buildRewardQuizArgs('GASHSELFFKPP5BTMD73FBODXO65MLGP4JCRIXQNEM3RYCWMRKSGOUVHC', 'challenge1', 5, 10, 5.5)).toThrow('xpAmount must be a positive integer');
    });

    it('returns valid args', () => {
      const args = buildRewardQuizArgs('GASHSELFFKPP5BTMD73FBODXO65MLGP4JCRIXQNEM3RYCWMRKSGOUVHC', 'challenge1', 5, 10, 50);
      expect(args.length).toBe(5);
      expect(args[0]).toBeInstanceOf(StellarSdk.xdr.ScVal);
    });
  });

  describe('buildMintBadgeArgs', () => {
    it('throws error when userPublicKey is empty', () => {
      expect(() => buildMintBadgeArgs('', 'mod1', 'Title', 50, 100)).toThrow('userPublicKey cannot be empty');
    });

    it('throws error when moduleId is empty', () => {
      expect(() => buildMintBadgeArgs('GASHSELFFKPP5BTMD73FBODXO65MLGP4JCRIXQNEM3RYCWMRKSGOUVHC', '', 'Title', 50, 100)).toThrow('moduleId cannot be empty');
    });

    it('throws error when moduleTitle is empty', () => {
      expect(() => buildMintBadgeArgs('GASHSELFFKPP5BTMD73FBODXO65MLGP4JCRIXQNEM3RYCWMRKSGOUVHC', 'mod1', '   ', 50, 100)).toThrow('moduleTitle cannot be empty');
    });

    it('throws error when xpEarned is not a positive integer', () => {
      expect(() => buildMintBadgeArgs('GASHSELFFKPP5BTMD73FBODXO65MLGP4JCRIXQNEM3RYCWMRKSGOUVHC', 'mod1', 'Title', 0, 100)).toThrow('xpAmount must be a positive integer');
      expect(() => buildMintBadgeArgs('GASHSELFFKPP5BTMD73FBODXO65MLGP4JCRIXQNEM3RYCWMRKSGOUVHC', 'mod1', 'Title', -5, 100)).toThrow('xpAmount must be a positive integer');
      expect(() => buildMintBadgeArgs('GASHSELFFKPP5BTMD73FBODXO65MLGP4JCRIXQNEM3RYCWMRKSGOUVHC', 'mod1', 'Title', 5.5, 100)).toThrow('xpAmount must be a positive integer');
    });

    it('throws error when score is invalid', () => {
      expect(() => buildMintBadgeArgs('GASHSELFFKPP5BTMD73FBODXO65MLGP4JCRIXQNEM3RYCWMRKSGOUVHC', 'mod1', 'Title', 50, -1)).toThrow('score must be between 0 and 100');
      expect(() => buildMintBadgeArgs('GASHSELFFKPP5BTMD73FBODXO65MLGP4JCRIXQNEM3RYCWMRKSGOUVHC', 'mod1', 'Title', 50, 101)).toThrow('score must be between 0 and 100');
    });

    it('returns valid args', () => {
      const args = buildMintBadgeArgs('GASHSELFFKPP5BTMD73FBODXO65MLGP4JCRIXQNEM3RYCWMRKSGOUVHC', 'mod1', 'Title', 50, 100);
      expect(args.length).toBe(5);
      expect(args[0]).toBeInstanceOf(StellarSdk.xdr.ScVal);
    });
  });
});
