/**
 * Weekly focus (PRD Phase 3 "personalized plan using measured mastery and
 * activity patterns"). Pure and deterministic: each skill gets a need score
 * from real signals — measured scores where they exist, how long since it
 * was practised, and backlog — never from guesses. Unmeasured skills are
 * labelled as such rather than given a score.
 */
export type SkillKey =
  "speaking" | "listening" | "pronunciation" | "vocabulary" | "writing";

export type SkillSignals = {
  speaking: { sessions7: number };
  /** Average score 0–1 over recent exercises; null when none were done. */
  listening: {
    done28: number;
    avgScore: number | null;
    daysSinceLast: number | null;
  };
  /** Average Azure pronunciation score 0–100; null when never assessed. */
  pronunciation: {
    attempts28: number;
    avgScore: number | null;
    daysSinceLast: number | null;
  };
  vocabulary: { due: number };
  writing: { entries28: number; daysSinceLast: number | null };
};

export type SkillFocus = {
  skill: SkillKey;
  need: number;
  /** Short Turkish reason built only from the signals above. */
  reasonTr: string;
};

export const skillLabelsTr: Record<SkillKey, string> = {
  speaking: "Konuşma",
  listening: "Dinleme",
  pronunciation: "Telaffuz",
  vocabulary: "Kelime tekrarı",
  writing: "Yazma",
};

/** Extra need for a skill left alone: never > a week > a few days. */
function staleness(daysSinceLast: number | null): number {
  if (daysSinceLast === null) return 20;
  if (daysSinceLast > 7) return 15;
  if (daysSinceLast > 3) return 5;
  return 0;
}

const ago = (days: number | null) =>
  days === null
    ? "hiç çalışılmadı"
    : days === 0
      ? "bugün çalışıldı"
      : `${days} gündür çalışılmadı`;

export function rankFocus(signals: SkillSignals): SkillFocus[] {
  const { speaking, listening, pronunciation, vocabulary, writing } = signals;
  const focus: SkillFocus[] = [
    {
      skill: "listening",
      need:
        (listening.avgScore === null ? 55 : (1 - listening.avgScore) * 100) +
        staleness(listening.daysSinceLast),
      reasonTr:
        listening.avgScore === null
          ? "Henüz ölçülmedi: kısa bir dikte ile başla."
          : `Son alıştırmalarda ortalama %${Math.round(listening.avgScore * 100)}, ${ago(listening.daysSinceLast)}.`,
    },
    {
      skill: "pronunciation",
      need:
        (pronunciation.avgScore === null ? 55 : 100 - pronunciation.avgScore) +
        staleness(pronunciation.daysSinceLast),
      reasonTr:
        pronunciation.avgScore === null
          ? "Henüz ölçülmedi: bir cümleyi sesli oku."
          : `Ortalama telaffuz puanı ${Math.round(pronunciation.avgScore)}, ${ago(pronunciation.daysSinceLast)}.`,
    },
    {
      skill: "speaking",
      need: Math.max(10, 50 - speaking.sessions7 * 10),
      reasonTr:
        speaking.sessions7 === 0
          ? "Bu hafta henüz konuşma yok."
          : `Bu hafta ${speaking.sessions7} konuşma.`,
    },
    {
      skill: "vocabulary",
      need: vocabulary.due === 0 ? 0 : Math.min(70, 25 + vocabulary.due * 4),
      reasonTr:
        vocabulary.due === 0
          ? "Tekrar bekleyen ifade yok."
          : `${vocabulary.due} ifade tekrar bekliyor.`,
    },
    {
      skill: "writing",
      need: 15 + staleness(writing.daysSinceLast),
      reasonTr:
        writing.entries28 === 0
          ? "Son 4 haftada yazma çalışması yok."
          : `Son 4 haftada ${writing.entries28} yazma çalışması, ${ago(writing.daysSinceLast)}.`,
    },
  ];
  // Stable order for ties keeps the plan deterministic.
  return focus.sort((a, b) => b.need - a.need);
}

/** Skills the 5-minute skill slot can serve, most needed first. */
export type SlotSkill = "listening" | "pronunciation" | "writing";

export function slotSkills(focus: SkillFocus[]): SlotSkill[] {
  return focus
    .map((f) => f.skill)
    .filter(
      (s): s is SlotSkill =>
        s === "listening" || s === "pronunciation" || s === "writing",
    );
}

export const daysBetween = (fromIso: string | null, now: number) =>
  fromIso === null
    ? null
    : Math.max(0, Math.floor((now - Date.parse(fromIso)) / 86_400_000));
