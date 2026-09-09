import type { VoiceLanguage } from "../api/deepgram";

// Hardcoded translations of the mock chat script (src/data/mockData.ts),
// indexed to match chatScript's step order. Deepgram's Aura TTS voices are
// language-specific — reading the English mock text with a Spanish or
// French voice mispronounces every word, so when the user has selected one
// of these languages, the AI's reply is swapped for the translated line
// below before it's displayed or spoken.
//
// Only Spanish and French are translated for this hackathon demo. Other
// non-English languages (Hindi, Kannada, German, Dutch, Italian, Japanese)
// still speak/display the English original — see getScriptMessage below.
const CHAT_SCRIPT_TRANSLATIONS: Partial<Record<VoiceLanguage, string[]>> = {
  es: [
    "Parece que quieres abrir un negocio de comida. Puedo ayudarte a verificar tu elegibilidad para un Permiso de Restaurante. Primero, ¿qué tipo de negocio de comida planeas abrir?",
    "¡Suena genial! ¿Cuál es el área aproximada de la propiedad en pies cuadrados?",
    "Entendido. Por último, ¿eres propietario de esta propiedad o la estás alquilando actualmente?",
    "¡Gracias! Tengo suficiente información para evaluar tu elegibilidad. Dame un momento.",
  ],
  fr: [
    "Il semble que vous souhaitiez ouvrir un commerce alimentaire. Je peux vous aider à vérifier votre éligibilité pour un permis de restaurant. D'abord, quel type de commerce alimentaire envisagez-vous d'ouvrir ?",
    "Parfait ! Quelle est la superficie approximative du local en pieds carrés ?",
    "Compris. Enfin, êtes-vous propriétaire de ce local ou le louez-vous actuellement ?",
    "Merci ! J'ai assez d'informations pour évaluer votre éligibilité. Un instant, s'il vous plaît.",
  ],
};

/** Returns the chat script line at `stepIndex` translated into `language`, falling back to the English original when no translation exists. */
export function getScriptMessage(
  stepIndex: number,
  language: VoiceLanguage,
  englishFallback: string,
): string {
  return CHAT_SCRIPT_TRANSLATIONS[language]?.[stepIndex] ?? englishFallback;
}
