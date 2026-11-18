import { MatchResult } from '../../types/index.js';

export interface MatchStrategy {
  readonly name: string;
  computeMatch(lostItem: any, foundItem: any): MatchResult;
}

