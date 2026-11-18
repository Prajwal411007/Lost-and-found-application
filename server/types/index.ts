export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

export interface MatchScoreDimension {
  name: string;
  weight: number;
  score: number;
  explanation: string;
}

export interface MatchResult {
  totalScore: number; // 0 to 100
  tier: 'High' | 'Medium' | 'Low';
  breakdown: Record<string, MatchScoreDimension>;
}

export interface MatchStrategy {
  readonly name: string;
  computeMatch(lostItem: any, foundItem: any): MatchResult;
}

