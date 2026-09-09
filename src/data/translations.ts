import type { VoiceLanguage } from "../api/deepgram";

// Hardcoded translations of the mock chat script (src/data/mockData.ts),
// indexed to match chatScript's step order. Deepgram's Aura TTS voices are
// language-specific — reading the English mock text with a Spanish, French,
// or Hindi voice mispronounces every word, so when the session language is
// one of these, the AI's reply is swapped for the translated line below
// before it's displayed or spoken.
//
// Only Spanish, French, and Hindi are translated for this hackathon demo.
// Other non-English languages (Kannada, German, Dutch, Italian, Japanese)
// still speak/display the English original — see getScriptMessage below.
const CHAT_SCRIPT_TRANSLATIONS: Partial<Record<VoiceLanguage, string[]>> = {
  es: [
    "Parece que quieres abrir un negocio de comida. Puedo ayudarte a verificar tu elegibilidad para un Permiso de Restaurante. Primero, ¿qué tipo de negocio de comida planeas abrir?",
    "¡Suena genial! ¿Cuál es el área aproximada de la propiedad en pies cuadrados?",
    "Entendido. Por último, ¿eres propietario de esta propiedad o la estás alquilando actualmente?",
    "¡Gracias! Tengo suficiente información para evaluar tu elegibilidad. Dame un momento.",
  ],
  fr: [
    "Il semble que vous souhaitiez ouvrir un commerce alimentaire. Je peux vous aider à vérifier votre éligibilité pour un permis de restaurant. D'abord, quel type de commerce alimentaire envisagez-vous d'ouvrir ?",
    "Parfait ! Quelle est la superficie approximative du local en pieds carrés ?",
    "Compris. Enfin, êtes-vous propriétaire de ce local ou le louez-vous actuellement ?",
    "Merci ! J'ai assez d'informations pour évaluer votre éligibilité. Un instant, s'il vous plaît.",
  ],
  hi: [
    "ऐसा लगता है कि आप खाने-पीने का व्यवसाय शुरू करना चाहते हैं। मैं आपको रेस्टोरेंट परमिट के लिए पात्रता जांचने में मदद कर सकता हूं। सबसे पहले, आप किस प्रकार का खाद्य व्यवसाय शुरू करने की योजना बना रहे हैं?",
    "बहुत बढ़िया! संपत्ति का अनुमानित क्षेत्रफल वर्ग फुट में कितना है?",
    "ठीक है। अंत में, क्या यह संपत्ति आपकी अपनी है, या आप इसे किराए पर ले रहे हैं?",
    "धन्यवाद! आपकी पात्रता का मूल्यांकन करने के लिए मेरे पास पर्याप्त जानकारी है। कृपया एक क्षण दें।",
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

// The AI's acknowledgment when a document is "uploaded" (see the file
// upload mock in ChatScreen). Same translation scope as above: es/fr/hi
// only, everything else falls back to English.
const FILE_ACK_TRANSLATIONS: Partial<Record<VoiceLanguage, string>> = {
  es: "¡Gracias! He recibido tu documento y lo he añadido a tu solicitud.",
  fr: "Merci ! J'ai bien reçu votre document et je l'ai ajouté à votre dossier.",
  hi: "धन्यवाद! मुझे आपका दस्तावेज़ मिल गया है और इसे आपके आवेदन में जोड़ दिया गया है।",
};

const FILE_ACK_ENGLISH =
  "Thanks! I've received your document and added it to your application.";

/** Returns the AI's document-upload acknowledgment translated into `language`. */
export function getFileAckMessage(language: VoiceLanguage): string {
  return FILE_ACK_TRANSLATIONS[language] ?? FILE_ACK_ENGLISH;
}
