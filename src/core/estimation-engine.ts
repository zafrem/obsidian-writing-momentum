import type { QaAnswers, Recommendation, UnitType } from '../types/interfaces';

const RULE_VERSION = "1.0.0";

interface PresetRule {
  sessionLengthMin: number;
  targetWords: number;
  sessionsPerWeek: number;
}

const PRESETS: Record<string, PresetRule> = {
  express: {
    sessionLengthMin: 18,  // 15-20 min average
    targetWords: 400,      // 300-500 words average
    sessionsPerWeek: 3
  },
  monetize: {
    sessionLengthMin: 38,  // 30-45 min average
    targetWords: 1000,     // 800-1200 words average
    sessionsPerWeek: 4
  },
  fun: {
    sessionLengthMin: 20,  // 15-25 min average
    targetWords: 350,
    sessionsPerWeek: 2.5   // 2-3 average
  },
  skill: {
    sessionLengthMin: 25,
    targetWords: 750,      // 600-900 words average
    sessionsPerWeek: 5
  },
  custom: {
    sessionLengthMin: 20,
    targetWords: 500,
    sessionsPerWeek: 3
  }
};

// Ambition mapping based on outcome keywords
const AMBITION_MAP: Record<string, number> = {
  'publish': 2,
  'book': 2,
  'career': 2,
  'professional': 2,
  'serious': 2,
  'improve': 1,
  'better': 1,
  'practice': 1,
  'learn': 1,
  'explore': 0,
  'try': 0,
  'fun': 0,
  'casual': 0,
  'relax': 0
};

export class EstimationEngine {
  /**
   * Main estimation function
   * Calculates session length, target, and frequency based on Q&A answers
   */
  static estimate(answers: QaAnswers): Recommendation {
    const base = PRESETS[answers.purpose] || PRESETS.custom;
    let rec = { ...base };

    // 1. Adjust for outcome ambition
    const ambition = this.getAmbitionLevel(answers.outcome || '');
    rec.sessionsPerWeek += ambition;

    // Words: +20% per ambition level
    rec.targetWords = Math.round(rec.targetWords * (1 + 0.2 * ambition));

    // Minutes: +20% per ambition level
    rec.sessionLengthMin = Math.round(rec.sessionLengthMin * (1 + 0.2 * ambition));

    // 2. Adjust for feasibility
    if (answers.feasibility === 'busy') {
      rec.sessionsPerWeek = Math.max(2, rec.sessionsPerWeek - 1);
    } else if (answers.feasibility === 'free') {
      rec.sessionsPerWeek += 1;
    }

    // 3. Apply user hint if provided
    if (answers.targetHint && answers.targetHint > 0) {
      if (answers.unitPref === 'words') {
        rec.targetWords = answers.targetHint;
      } else {
        rec.sessionLengthMin = answers.targetHint;
      }
    }

    // 4. Build final recommendation based on unit preference
    const finalRec: Recommendation = {
      sessionLengthMin: this.clamp(rec.sessionLengthMin, 10, 90),
      target: answers.unitPref === 'words'
        ? { type: 'words', value: this.clamp(rec.targetWords, 100, 3000) }
        : { type: 'minutes', value: this.clamp(rec.sessionLengthMin, 10, 90) },
      sessionsPerWeek: this.clamp(Math.round(rec.sessionsPerWeek), 1, 7),
      ruleVersion: RULE_VERSION,
      calculatedAt: Date.now()
    };

    return finalRec;
  }

  /**
   * Determine ambition level from outcome text
   * Returns 0 (low), 1 (medium), or 2 (high)
   */
  private static getAmbitionLevel(outcome: string): number {
    const lower = outcome.toLowerCase();
    let maxAmbition = 0;

    for (const [keyword, level] of Object.entries(AMBITION_MAP)) {
      if (lower.includes(keyword)) {
        maxAmbition = Math.max(maxAmbition, level);
      }
    }

    return maxAmbition;
  }

  /**
   * Clamp value between min and max
   */
  private static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Get suggested defaults for a purpose (without answers)
   */
  static getPresetForPurpose(purpose: string, unitPref: UnitType = 'words'): Recommendation {
    const base = PRESETS[purpose] || PRESETS.custom;

    return {
      sessionLengthMin: base.sessionLengthMin,
      target: unitPref === 'words'
        ? { type: 'words', value: base.targetWords }
        : { type: 'minutes', value: base.sessionLengthMin },
      sessionsPerWeek: Math.round(base.sessionsPerWeek),
      ruleVersion: RULE_VERSION,
      calculatedAt: Date.now()
    };
  }

  /**
   * Convert time to estimated word count (rough approximation)
   * Assumes average typing speed of ~40 words/minute
   */
  static timeToWords(minutes: number): number {
    return Math.round(minutes * 40);
  }

  /**
   * Convert word count to estimated time
   */
  static wordsToTime(words: number): number {
    return Math.round(words / 40);
  }

  /**
   * Check if recommendation needs recalculation
   * (e.g., rule version changed)
   */
  static needsRecalculation(rec: Recommendation): boolean {
    return rec.ruleVersion !== RULE_VERSION;
  }

  /**
   * Get human-readable description of recommendation
   */
  static describe(rec: Recommendation): string {
    const target = rec.target.type === 'words'
      ? `${rec.target.value} words`
      : `${rec.target.value} minutes`;

    const freq = rec.sessionsPerWeek === 7
      ? 'daily'
      : `${rec.sessionsPerWeek}× per week`;

    return `${target}, ${freq}`;
  }

  /**
   * Get defaults description based on purpose
   */
  static describePurpose(purpose: string): string {
    const descriptions: Record<string, string> = {
      express: 'Self-Expression: 15–20 min or 300–500 words, 3× per week',
      monetize: 'Monetization: 30–45 min or 800–1200 words, 4× per week',
      fun: 'Fun: 15–25 min, 2–3× per week',
      skill: 'Skill Development: 25 min or 600–900 words, 5× per week',
      custom: 'Custom: Define your own goals'
    };

    return descriptions[purpose] || descriptions.custom;
  }
}
