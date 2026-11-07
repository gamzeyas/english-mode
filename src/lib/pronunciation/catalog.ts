/**
 * Read-aloud practice sets built around sounds Turkish speakers commonly
 * substitute, plus interview phrases for the learner's goals. Real practice
 * content (not demo data): each sentence has a Turkish meaning.
 */
export type PracticeSentence = { key: string; text: string; meaningTr: string };
export type PracticeSet = {
  slug: string;
  title: string;
  focusTr: string;
  sentences: PracticeSentence[];
};

const set = (
  slug: string,
  title: string,
  focusTr: string,
  sentences: [string, string][],
): PracticeSet => ({
  slug,
  title,
  focusTr,
  sentences: sentences.map(([text, meaningTr], index) => ({
    key: `${slug}-${index + 1}`,
    text,
    meaningTr,
  })),
});

export const PRACTICE_SETS: PracticeSet[] = [
  set(
    "th",
    "TH sounds",
    "θ ve ð: dil ucu dişlerin arasında; “t, s, d, z” ile değiştirme.",
    [
      [
        "I think this is the third time this month.",
        "Sanırım bu, bu ay üçüncü kez oluyor.",
      ],
      [
        "Thank you for the thoughtful feedback.",
        "Düşünceli geri bildirimin için teşekkürler.",
      ],
      ["They're both there on Thursday.", "İkisi de perşembe günü orada."],
      [
        "Is there anything else I should think about?",
        "Düşünmem gereken başka bir şey var mı?",
      ],
      [
        "My brother thinks the weather is better there.",
        "Kardeşim orada havanın daha iyi olduğunu düşünüyor.",
      ],
    ],
  ),
  set("w-v", "W and V", "w dudak yuvarlayarak, v alt dudak dişe değerek.", [
    [
      "We were very worried about the weather.",
      "Hava yüzünden çok endişelenmiştik.",
    ],
    [
      "Would you like to visit our office next week?",
      "Gelecek hafta ofisimizi ziyaret etmek ister misin?",
    ],
    [
      "What was the value of the previous version?",
      "Önceki sürümün değeri neydi?",
    ],
    [
      "I'll work with the video team on Wednesday.",
      "Çarşamba günü video ekibiyle çalışacağım.",
    ],
    ["Everyone was waiting for the vote.", "Herkes oylamayı bekliyordu."],
  ]),
  set(
    "vowels",
    "Short and long vowels",
    "ɪ / iː, ʊ / uː ve æ / e farkı: uzunluk ve ağız açıklığı anlamı değiştirir.",
    [
      ["Please sit in this seat.", "Lütfen bu koltuğa otur."],
      ["The full moon looked beautiful.", "Dolunay çok güzel görünüyordu."],
      [
        "I had a bad day, but my bed was comfortable.",
        "Kötü bir gün geçirdim ama yatağım rahattı.",
      ],
      [
        "He will leave the city early this week.",
        "Bu hafta şehirden erken ayrılacak.",
      ],
      [
        "Let's meet at the coffee shop next to the bank.",
        "Bankanın yanındaki kafede buluşalım.",
      ],
    ],
  ),
  set(
    "endings",
    "Word endings and -ed",
    "Sondaki ünsüzleri ve -ed eklerini yutma: /t/, /d/ ya da /ɪd/.",
    [
      [
        "I worked late and missed the last train.",
        "Geç saate kadar çalıştım ve son treni kaçırdım.",
      ],
      [
        "She asked about the planned changes.",
        "Planlanan değişiklikleri sordu.",
      ],
      [
        "We discussed the budget and decided to wait.",
        "Bütçeyi konuştuk ve beklemeye karar verdik.",
      ],
      [
        "The new products need to be tested this week.",
        "Yeni ürünlerin bu hafta test edilmesi gerekiyor.",
      ],
      [
        "He looked tired, but he finished the project.",
        "Yorgun görünüyordu ama projeyi bitirdi.",
      ],
    ],
  ),
  set(
    "interview",
    "Interview phrases",
    "Mülakatta sık kullanılan cümleler: vurgu ve akıcılık.",
    [
      [
        "I'm passionate about using AI to solve creative problems.",
        "Yaratıcı problemleri çözmek için yapay zekâ kullanmaya tutkuyla bağlıyım.",
      ],
      [
        "In my previous role, I led a team of five designers.",
        "Önceki görevimde beş tasarımcıdan oluşan bir ekibi yönettim.",
      ],
      [
        "My biggest strength is turning ideas into working products.",
        "En büyük gücüm fikirleri çalışan ürünlere dönüştürmek.",
      ],
      [
        "I'd love to hear more about the team's priorities.",
        "Ekibin öncelikleri hakkında daha fazla şey duymak isterim.",
      ],
      [
        "Could you tell me what success looks like in this role?",
        "Bu rolde başarının neye benzediğini anlatabilir misiniz?",
      ],
    ],
  ),
  set(
    "connected",
    "Connected speech",
    "Kelimeleri birbirine bağla: “want to” → “wanna”, “did you” → “didja”.",
    [
      [
        "What do you want to do this weekend?",
        "Bu hafta sonu ne yapmak istiyorsun?",
      ],
      ["I'm going to pick it up later.", "Onu daha sonra alacağım."],
      ["Did you get a chance to look at it?", "Ona bakma fırsatın oldu mu?"],
      [
        "Let me know if you need anything else.",
        "Başka bir şeye ihtiyacın olursa haber ver.",
      ],
      [
        "Can I ask you a quick question?",
        "Sana kısa bir soru sorabilir miyim?",
      ],
    ],
  ),
];

const BY_KEY = new Map(
  PRACTICE_SETS.flatMap((s) => s.sentences.map((x) => [x.key, x] as const)),
);

export const findPracticeSentence = (key: string) => BY_KEY.get(key) ?? null;
