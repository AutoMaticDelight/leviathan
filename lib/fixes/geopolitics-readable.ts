/**
 * Hand-rebuilt text of JD's "Geopolitics (Readable)" (uploaded 2026-10-03).
 *
 * The original upload went through plain PDF text extraction, which read the
 * relations grid column-by-column and scrambled which nation thought what of
 * whom. The PDF itself was never stored, so this was reconstructed from the
 * extracted fragments. Reading rule, from the document's own legend and
 * confirmed against the cells (e.g. Zurozen "gladly accept Lilrean support",
 * Lilris "give aid to Bishop Meydan's cause"): each COLUMN is one nation's
 * opinion of every row nation.
 *
 * One block per nation, so every chunk carries one nation's complete view and
 * a question like "who does Zurozen consider friendly" lands on one passage.
 */

const NATIONS = ["Nimbel", "Tytalia", "Tigrisara", "Lilris", "Archidonis", "Pyrzol", "Zurozen"] as const;
type Nation = (typeof NATIONS)[number];

// OPINION[holder][subject] = what `holder` thinks of `subject`.
const OPINION: Record<Nation, Partial<Record<Nation, string>>> = {
  Nimbel: {
    Tytalia: "Active Cold War, but the guilds and the generals are divided on how to act.",
    Tigrisara: "Some lords have funded failed coups against Pharaoh Hur.",
    Lilris: "Trade partners, but politically neutral.",
    Archidonis: "Trade and cultural partners for the Empire's history. New tensions after the War.",
    Pyrzol: "Guarded, committed to staying uninvolved with the Civil War.",
    Zurozen: "Some Imperial support, but guarded and uninvolved.",
  },
  Tytalia: {
    Nimbel: "Active Cold War, giving funding to the Eisenist Greencloak movement.",
    Tigrisara: "Maintain steady trade relations despite post-Rykizanic tensions.",
    Lilris: "New scholarly exchange program and trade have provided benefits and significant leverage.",
    Archidonis: "Some disputes over ocean travel from the founding of Kishibe.",
    Pyrzol: "Officially neutral, but Tytalia will \"only attack if provoked.\"",
    Zurozen: "Officially neutral, but Tytalia will \"only attack if provoked.\"",
  },
  Tigrisara: {
    Nimbel: "Resentments linger over the attacks in the Rykizanic war. Heretics!",
    Tytalia: "Reluctant trade partners. Great hostility lingers.",
    Lilris: "Tolerated trade partners due to Lilris's religious freedom.",
    Archidonis: "Pharaoh demands conversion. Tension over battles from the Rykizanic war, but no hostility.",
    Pyrzol: "Want Kruzinel dead; unofficially still at war.",
    Zurozen: "Nothing more than a mad insurgency. Some trade, no relation.",
  },
  Lilris: {
    Nimbel: "Eager trade partners. Lilrean University partnered with the Technocrat Guild.",
    Tytalia: "Scholarly exchange program + trade. Considered reliable and valuable allies.",
    Tigrisara: "Trade partners. Tigrisara supplies food for the rapidly growing City-State.",
    Archidonis: "Extremely fraught ceasefire. Desperate for allies to survive Archidonis when war resumes.",
    Pyrzol: "\"Abomination!\" Ideological embargo, though Pyrzolian refugees are welcome.",
    Zurozen: "Give aid to Bishop Meydan's cause out of principle.",
  },
  Archidonis: {
    Nimbel: "Old allies, ancestral trust from before the Empire's founding. Trade goes back centuries.",
    Tytalia: "There are bigger priorities. Tytalia is a problem that can be outlasted.",
    Tigrisara: "Trade partners since the foundation of Onren.",
    Lilris: "Lilris shall be destroyed and Lilrea rebuilt. Tradition must be restored and House Hrafn avenged!",
    Pyrzol: "Open hostility, though neither side has truly acted in years.",
    Zurozen: "Give aid to their elven kin to outdo Lilrean influence.",
  },
  Pyrzol: {
    Nimbel: "Old marriages prevent any hostility. Trade continues with difficulty.",
    Tytalia: "Tytalian pirates have raided! Suspect an imminent Tytalian attack.",
    Tigrisara: "Piracy, frequently stealing food from merchants to keep the war effort going.",
    Lilris: "No folk of Lilris are allowed, on penalty of death.",
    Archidonis: "They instigate and fund Zurozen. Stop them!",
    Zurozen: "Painted Spider betrayed Kruzinel and must all die for it. WAR!",
  },
  Zurozen: {
    Nimbel: "Some imperial provinces offer trade and help; the rest are all \"Dragon Fuckers.\"",
    Tytalia: "Believe Tytalia plans attacks on Zurozen and Pyrzol!",
    Tigrisara: "Piracy, frequently stealing food from merchants.",
    Lilris: "Gladly accept Lilrean support and aid, but cannot give anything back save for open trade.",
    Archidonis: "Cultural allies, though with reservations.",
    Pyrzol: "Kill the drakunatei, usurpers of the Relans! WAR!",
  },
};

const PROFILE: Record<Nation, { accent: string; languages: string }> = {
  Nimbel: { accent: "UK accents (North)", languages: "Lellebanic (Common)" },
  Tytalia: { accent: "Yes — various", languages: "Various, Lellebanic" },
  Tigrisara: { accent: "Spanish/Russian", languages: "Lellebanic, Sylvan" },
  Lilris: { accent: "American + various", languages: "Elvish, Lellebanic" },
  Archidonis: { accent: "Irish", languages: "Elvish, Sylvan" },
  Pyrzol: { accent: "Roman/Italian", languages: "Lellebanic, Draconic" },
  Zurozen: { accent: "German", languages: "Elvish (rest cut off in the source)" },
};

export const GEOPOLITICS_TITLE = "Geopolitics (Readable)";

/** One "page" per block; the chunker keeps each block whole. */
export function geopoliticsPages(): string[] {
  const intro =
    "Project Mira — Geopolitics. A transcribed version of the whiteboard in the Project Mira drive. " +
    "Some things differ from the whiteboard because of creative changes made while developing the world " +
    "in greater detail. This is what people in the world believe; time will tell what is true.\n\n" +
    "Nations: " + NATIONS.join(", ") + ".\n\n" +
    "Accents and languages:\n" +
    NATIONS.map((n) => `- ${n}: regional accent ${PROFILE[n].accent}; major languages ${PROFILE[n].languages}.`).join("\n");

  const views = NATIONS.map((holder) => {
    const lines = NATIONS.filter((s) => s !== holder).map(
      (subject) => `- ${holder}'s view of ${subject}: ${OPINION[holder][subject]}`
    );
    return `How ${holder} sees the other nations (${holder}'s opinions, foreign relations, allies and enemies):\n${lines.join("\n")}`;
  });

  const seenBy = NATIONS.map((subject) => {
    const lines = NATIONS.filter((h) => h !== subject).map(
      (holder) => `- ${holder} on ${subject}: ${OPINION[holder][subject]}`
    );
    return `How the other nations see ${subject} (every nation's opinion of ${subject}):\n${lines.join("\n")}`;
  });

  return [intro, ...views, ...seenBy];
}
