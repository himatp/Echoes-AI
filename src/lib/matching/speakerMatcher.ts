import { TeamMember } from '@/types';

export interface MatchResult {
  member: TeamMember | null;
  confidence: number;
  isUnlinked: boolean;
  unlinkedName?: string;
}

export function matchSpeakerToMember(
  extractedName: string,
  attendees: TeamMember[],
  globalTeam: TeamMember[]
): MatchResult {
  if (!extractedName || !extractedName.trim()) {
    return { member: null, confidence: 0, isUnlinked: true, unlinkedName: 'Unassigned' };
  }

  const cleanSpoken = extractedName.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const spokenTokens = cleanSpoken.split(/\s+/).filter(Boolean);

  if (spokenTokens.length === 0) {
    return { member: null, confidence: 0, isUnlinked: true, unlinkedName: extractedName };
  }

  // 1. Try matching against Meeting Attendees first
  const attendeeMatch = findBestMatchInPool(cleanSpoken, spokenTokens, attendees);
  if (attendeeMatch && attendeeMatch.confidence >= 0.85) {
    return {
      member: attendeeMatch.member,
      confidence: attendeeMatch.confidence,
      isUnlinked: false,
    };
  }

  // 2. Fall back to Global Team Members pool
  const globalMatch = findBestMatchInPool(cleanSpoken, spokenTokens, globalTeam);
  if (globalMatch && globalMatch.confidence >= 0.85) {
    return {
      member: globalMatch.member,
      confidence: globalMatch.confidence,
      isUnlinked: false,
    };
  }

  // 3. High-Confidence Safety Threshold: Return Unlinked
  return {
    member: null,
    confidence: 0,
    isUnlinked: true,
    unlinkedName: extractedName,
  };
}

function findBestMatchInPool(
  cleanSpoken: string,
  spokenTokens: string[],
  pool: TeamMember[]
): { member: TeamMember; confidence: number } | null {
  if (!pool || pool.length === 0) return null;

  // Rule 1: Exact Full Name Match (1.0 / 100%)
  for (const m of pool) {
    const cleanMember = m.name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
    if (cleanSpoken === cleanMember) {
      return { member: m, confidence: 1.0 };
    }
  }

  // Rule 2: First Name + Last Initial Match (0.90 / 90%)
  // e.g., "Sarah C" or "Sarah C."
  if (spokenTokens.length === 2 && spokenTokens[1].length === 1) {
    const [spFirstName, spLastInitial] = spokenTokens;
    const candidates = pool.filter((m) => {
      const parts = m.name.trim().toLowerCase().split(/\s+/);
      const fName = parts[0] || '';
      const lInitial = (parts[1] || '')[0] || '';
      return fName === spFirstName && lInitial === spLastInitial;
    });

    if (candidates.length === 1) {
      return { member: candidates[0], confidence: 0.90 };
    }
  }

  // Rule 3: Unique First Name Match (0.85 / 85%)
  // e.g. "Sarah" matches "Sarah Chen" ONLY IF "Sarah" is unique in pool.
  const firstName = spokenTokens[0];
  const firstNameMatches = pool.filter((m) => {
    const fName = m.name.trim().toLowerCase().split(/\s+/)[0] || '';
    return fName === firstName;
  });

  if (firstNameMatches.length === 1) {
    return { member: firstNameMatches[0], confidence: 0.85 };
  }

  // Multi-candidate ambiguity (e.g. Sarah Chen and Sarah Smith) or low similarity -> null
  return null;
}
