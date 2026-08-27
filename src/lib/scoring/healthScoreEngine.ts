import { Meeting, MeetingHealthScore } from '@/types';

/**
 * Stage 9: Dynamic Meeting Health Score Algorithm Engine
 * Calculates multi-factor meeting health score based on empirical transcript data.
 */
export function calculateMeetingHealthScore(meeting: Partial<Meeting>): MeetingHealthScore {
  const speakerSegments = meeting.speakerSegments || [];
  const keyDecisions = meeting.keyDecisions || [];
  const actionItems = meeting.actionItems || [];
  const durationStr = meeting.duration || '30 min';

  // Parse duration in minutes
  const durationMinsMatch = durationStr.match(/\d+/);
  const durationMinutes = durationMinsMatch ? Math.max(1, parseInt(durationMinsMatch[0], 10)) : 30;

  // ----------------------------------------------------
  // 1. TALK-TIME BALANCE SCORE (0-100)
  // ----------------------------------------------------
  const speakerCharCounts: Record<string, number> = {};
  let totalChars = 0;

  speakerSegments.forEach((seg) => {
    const len = (seg.text || '').length;
    speakerCharCounts[seg.speaker] = (speakerCharCounts[seg.speaker] || 0) + len;
    totalChars += len;
  });

  const uniqueSpeakers = Object.keys(speakerCharCounts);
  const numSpeakers = uniqueSpeakers.length;

  let talkTimeBalance = 80; // Default baseline if no segments

  if (totalChars > 0 && numSpeakers > 0) {
    const idealRatio = 1 / numSpeakers;
    let maxDominanceRatio = 0;

    uniqueSpeakers.forEach((spk) => {
      const ratio = speakerCharCounts[spk] / totalChars;
      if (ratio > maxDominanceRatio) {
        maxDominanceRatio = ratio;
      }
    });

    // Dominance penalty: how much the top speaker exceeds ideal share
    const excessShare = Math.max(0, maxDominanceRatio - idealRatio);
    talkTimeBalance = Math.max(30, Math.min(100, Math.round(100 - (excessShare * 110))));
  }

  // ----------------------------------------------------
  // 2. DECISION DENSITY SCORE (0-100)
  // ----------------------------------------------------
  // Rate of key decisions per 15 minutes of meeting time
  const decisionsCount = keyDecisions.length;
  const decisionRatePer15Min = (decisionsCount / durationMinutes) * 15;
  // Ideal rate: 1 to 2 decisions per 15 minutes -> score 85 to 100
  const decisionDensity = Math.min(100, Math.round(decisionRatePer15Min * 45 + (decisionsCount > 0 ? 30 : 10)));

  // ----------------------------------------------------
  // 3. UNASSIGNED ACTION ITEM PENALTY
  // ----------------------------------------------------
  const unassignedCount = actionItems.filter(
    (item) => !item.assignee || item.assignee.toLowerCase() === 'unassigned' || item.assignee.trim() === ''
  ).length;

  const unassignedPenalty = unassignedCount * 10;

  // ----------------------------------------------------
  // 4. OVERALL HEALTH SCORE CALCULATION
  // ----------------------------------------------------
  // Weighted: 45% Talk-time balance + 45% Decision density - Unassigned Penalty + 10% Baseline
  const rawScore = (0.45 * talkTimeBalance) + (0.45 * decisionDensity) + 10 - unassignedPenalty;
  const overallScore = Math.max(15, Math.min(99, Math.round(rawScore)));

  // ----------------------------------------------------
  // 5. DYNAMIC CONTEXTUAL SUGGESTIONS
  // ----------------------------------------------------
  const suggestions: string[] = [];

  if (talkTimeBalance < 70 && numSpeakers > 1) {
    // Identify top speaker
    let topSpeaker = uniqueSpeakers[0];
    let maxChar = 0;
    uniqueSpeakers.forEach((s) => {
      if (speakerCharCounts[s] > maxChar) {
        maxChar = speakerCharCounts[s];
        topSpeaker = s;
      }
    });
    const topPct = Math.round((maxChar / (totalChars || 1)) * 100);
    suggestions.push(`Dominant speaker detected: ${topSpeaker} spoke ${topPct}% of the time. Encourage quieter members to contribute.`);
  } else if (numSpeakers > 1) {
    suggestions.push(`Great participation balance across all ${numSpeakers} active speakers.`);
  }

  if (unassignedPenalty > 0) {
    suggestions.push(`${unassignedCount} action item(s) remain unassigned. Assign explicit owners to ensure task accountability.`);
  }

  if (decisionDensity < 50) {
    suggestions.push('Low decision density relative to duration. Consider summarizing key takeaways explicitly before wrapping up.');
  } else {
    suggestions.push(`High decision density: ${decisionsCount} decision(s) made in ${durationMinutes} minutes.`);
  }

  return {
    score: overallScore,
    talkTimeBalance,
    decisionDensity,
    unassignedPenalty,
    suggestions,
  };
}
