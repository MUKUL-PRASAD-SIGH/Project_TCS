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

**Speech-to-text language**: the dropdown next to the mic button defaults to "🌐 Auto-detect" — Deepgram identifies the spoken language itself (`detect_language=true`) from English, Hindi, Spanish, French, German, Dutch, Italian, or Japanese. **Kannada can't be auto-detected** (it's outside Deepgram's 35 detectable languages), so it's the one language you must pick manually from the dropdown — when explicitly selected, it's routed through Deepgram's hosted `whisper-large` model instead of `nova-2` (best-effort: broader coverage, lower accuracy than a dedicated model). Picking any other language manually also works and skips detection for that turn.

**Session language persistence**: the first language detected (or manually picked) becomes the conversation's "session language" and is remembered for the rest of the chat — later replies and TTS keep using it even if a subsequent utterance is mis-detected. Speaking your initial request on the *landing page* carries its detected language into the chat screen too. Re-selecting "Auto-detect" from the dropdown unlocks it so the next utterance can re-set it.

**Hybrid text-to-speech**: Deepgram's Aura voices only cover English, Spanish, French, German, Dutch, Italian, and Japanese (`AURA_SUPPORTED_LANGUAGES` in [src/api/deepgram.ts](src/api/deepgram.ts)). For the session language, `TtsButton` picks the matching Aura voice from those seven (e.g. `aura-2-celeste-es` for Spanish). For Hindi and Kannada — which Aura can't speak at all — it falls back to the browser's own Web Speech API (`window.speechSynthesis`, see [src/api/webSpeechTts.ts](src/api/webSpeechTts.ts)) instead, so playback still works, just with a different engine and voice quality that depends on what your OS/browser has installed.

**Mock replies are only translated into Spanish, French, and Hindi.** The assistant's script is hardcoded English text (`src/data/mockData.ts`); speaking that text aloud in a mismatched voice/language sounds wrong, so `src/data/translations.ts` hardcodes translated versions of the four script lines (plus the file-upload acknowledgment) for those three languages — `getScriptMessage`/`getFileAckMessage` swap them in before display and TTS. Kannada, German, Dutch, Italian, and Japanese still get the *correct native voice* but *English* text, since no translation exists for them yet — extend the dictionaries in that file to close the gap. The very first assistant message is generated before any language can be detected, so it's always English; translation only kicks in from the second reply onward.

**Document upload (mock)**: the paperclip button next to the input opens the native file picker. Selecting a file shows a brief "Uploading…" state, then adds it to the chat as a file bubble, has the assistant acknowledge it (in the session language), and flips the first "missing" document in the right-hand panel to "have" — no file is actually sent anywhere, this is purely a frontend mock for the demo.

## Demo controls

A toggle in the bottom-right corner switches the final chat outcome between "Eligible" and "Ineligible" for demo purposes.
