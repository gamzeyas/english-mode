import type { PronunciationWord } from "@/lib/speech/pronunciation";

/**
 * Turkish guidance for English sounds that Turkish speakers commonly
 * substitute. Keyed by IPA as Azure returns it. Advice is tied to phonemes
 * Azure actually scored low on a read-aloud target — never inferred from a
 * text transcript (PRD §6 rule 8).
 */
const PHONEME_TIPS: Record<string, string> = {
  θ: "“th” (think): dil ucunu üst dişlerin arasına koy ve üfle; “t” ya da “s” deme.",
  ð: "“th” (this): dil dişlerin arasında, ses telleri titreşir; “d” ya da “z” deme.",
  w: "“w”: dudakları yuvarlayıp aç; alt dudak dişe değmez, Türkçe “v” değil.",
  v: "“v”: alt dudak üst dişlere hafifçe değer; dudakları “w” gibi yuvarlama.",
  æ: "“æ” (cat): ağzı “e”den daha çok aç; “e” ile “a” arası bir ses.",
  ɪ: "“ɪ” (sit): kısa ve gevşek bir “i”; uzun “ii” yapma.",
  i: "“iː” (seat): gergin ve uzun bir “ii”.",
  iː: "“iː” (seat): gergin ve uzun bir “ii”.",
  ʊ: "“ʊ” (book): kısa, gevşek bir “u”.",
  u: "“uː” (food): dudaklar yuvarlak, uzun bir “uu”.",
  uː: "“uː” (food): dudaklar yuvarlak, uzun bir “uu”.",
  ə: "“ə” (schwa): vurgusuz hecede harfi tam okuma; hafif, kısa bir “ı”.",
  ʌ: "“ʌ” (cup): kısa ve açık bir “a”; “u” deme.",
  ɑ: "“ɑ” (hot): ağız açık, arkadan gelen bir “a”.",
  ɔ: "“ɔ” (thought): yuvarlak, açık bir “o”.",
  ɝ: "r'li ünlü (work, bird): dil geride hafifçe kıvrılır; “ö” ya da “ör” değil.",
  ɚ: "Vurgusuz r'li ünlü (teacher): kısa “ır” gibi, dil geride.",
  ɹ: "İngilizce “r”: dil ucu hiçbir yere değmez; Türkçe titrek “r” yapma.",
  ŋ: "“ŋ” (sing): sonunda “g” sesi çıkarmadan genizden bitir.",
  eɪ: "“eɪ” (day): “e”den “i”ye kayan çift ses; düz “e” değil.",
  oʊ: "“oʊ” (go): “o” ile başlayıp “u”ya kayan çift ses.",
  əʊ: "“əʊ” (go, İngiliz): “ö”ye yakın başlayıp “u”ya kayar.",
  l: "Kelime sonundaki “l” (feel, call) kalın ve koyu söylenir.",
  h: "“h”: nefesle, hafif ama duyulur; yutma.",
  ʒ: "“ʒ” (measure): Türkçe “j” sesi.",
};

/** Final voiced consonants Turkish devoices (bad → “bat”). */
const FINAL_VOICED = new Set(["b", "d", "g", "v", "z", "dʒ", "ð"]);
const FINAL_TIP =
  "Kelimenin son sesini net ve yumuşak bitir: Türkçede sondaki ünsüz sertleşir (bad → “bat”), İngilizcede bu anlamı değiştirir.";

/** Below this, Azure itself starts calling a word mispronounced. */
export const WEAK_SCORE = 60;

export type PhonemeTip = { phoneme: string; tip: string };

/** Tips for the weakest sounds in one word, most important first. */
export function tipsForWord(word: PronunciationWord, limit = 2): PhonemeTip[] {
  const last = word.phonemes.length - 1;
  const tips: PhonemeTip[] = [];
  const seen = new Set<string>();
  [...word.phonemes]
    .map((p, index) => ({ ...p, index }))
    .filter((p) => p.accuracy < WEAK_SCORE)
    .sort((a, b) => a.accuracy - b.accuracy)
    .forEach((p) => {
      const tip =
        p.index === last && FINAL_VOICED.has(p.phoneme)
          ? FINAL_TIP
          : PHONEME_TIPS[p.phoneme];
      if (tip && !seen.has(tip)) {
        seen.add(tip);
        tips.push({ phoneme: p.phoneme, tip });
      }
    });
  return tips.slice(0, limit);
}

/** Turkish explanation for each word-level error type. */
export const ERROR_LABELS_TR: Record<
  Exclude<PronunciationWord["errorType"], "None">,
  string
> = {
  Mispronunciation: "Telaffuz farklı",
  Omission: "Atlandı",
  Insertion: "Fazladan söylendi",
  UnexpectedBreak: "Beklenmedik duraklama",
  MissingBreak: "Burada kısa bir duraklama olmalı",
  Monotone: "Tonlama düz",
};

/** The general tip for one sound, if there is one for Turkish speakers. */
export const tipForPhoneme = (phoneme: string): string | null =>
  PHONEME_TIPS[phoneme] ?? null;
