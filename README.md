# Municipal Permit Assistant

A conversational frontend for checking municipal permit eligibility. React + TypeScript + Vite + Tailwind CSS. The chat flow is a scripted mock state machine (see `src/data/mockData.ts`) — there is no backend yet.

## Run locally

```bash
npm install
npm run dev
```

## Voice input/output (optional)

The chat input has a microphone button for speech-to-text, and each assistant message has a "Play audio" button for text-to-speech, both powered by [Deepgram](https://deepgram.com). Voice is entirely optional — the app works with typed text if it's not configured.

To enable it:

1. Copy `.env.example` to `.env`.
2. Set `VITE_DEEPGRAM_API_KEY` to a Deepgram API key.
3. Restart `npm run dev`.

All Deepgram calls are isolated to [src/api/deepgram.ts](src/api/deepgram.ts). The key is read from a Vite env var and used directly from the browser — fine for this hackathon demo, but not for production (it would be visible in the bundle).

**Speech-to-text language**: a dropdown next to the mic button switches between English, Hindi, Kannada, Spanish, French, German, Dutch, Italian, and Japanese.
- English, Hindi, and the six European/Japanese languages (es/fr/de/nl/it/ja) all use Deepgram's `nova-2` model — first-class supported, so accuracy should be good.
- Kannada isn't supported by `nova-2`, so it's routed through Deepgram's hosted `whisper-large` model instead. This is a best-effort fallback (broader language coverage, but lower accuracy than a dedicated model) — treat Kannada transcripts as less reliable, especially in a noisy room or with short utterances.

**Text-to-speech voice** is picked per language from Deepgram's Aura 2 catalog (e.g. `aura-2-celeste-es` for Spanish, `aura-2-agathe-fr` for French — see `TTS_VOICE` in [src/api/deepgram.ts](src/api/deepgram.ts)). Hindi and Kannada have no Aura voice at all, so those two fall back to the English voice.

**Mock replies are only translated into Spanish and French.** The assistant's script is hardcoded English text (`src/data/mockData.ts`); reading that text aloud with a German/Dutch/Italian/Japanese voice would mispronounce every word, so as a stopgap `src/data/translations.ts` hardcodes Spanish and French versions of the four script lines — when one of those two languages is selected, both the displayed chat bubble and the TTS audio switch to the translated line. German, Dutch, Italian, and Japanese get the correct native *voice* but still speak the *English* text, since no translation exists for them yet — extend `CHAT_SCRIPT_TRANSLATIONS` in that file to close the gap. Note also that each screen (landing page, chat screen) tracks its selected language independently, and the very first assistant message is generated before your chat-screen language choice can take effect (it always sends in whatever language was selected on mount) — translation only kicks in from the second reply onward.

## Demo controls

A toggle in the bottom-right corner switches the final chat outcome between "Eligible" and "Ineligible" for demo purposes.
