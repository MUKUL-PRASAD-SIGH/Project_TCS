# Municipal Permit Assistant

A conversational frontend for checking municipal permit eligibility. React + TypeScript + Vite + Tailwind CSS.

The chat is driven live by **Gemini** ([src/api/gemini.ts](src/api/gemini.ts)), reasoning over the permit rules in [src/data/permitRules.json](src/data/permitRules.json) (a local copy of the project's `Licence_Permits.json`, kept in sync manually — if that file changes, re-copy it here). There is no backend — Gemini and Deepgram are both called directly from the browser.

## Run locally

```bash
npm install
npm run dev
```

## Gemini (required — this is the assistant's brain)

1. Copy `.env.example` to `.env`.
2. Set `VITE_GEMINI_API_KEY` to a Gemini API key ([aistudio.google.com](https://aistudio.google.com)).
3. Restart `npm run dev`.

Without a key, the chat still loads but every turn shows an inline error ("Voice features are unavailable" — actually "The assistant is unavailable..." — see `GeminiConfigError` in `src/api/gemini.ts`) instead of a reply.

**How it works**: on the user's first message, the system prompt includes the *full* permit catalog and asks Gemini to pick the best-matching `permit_id` and start asking clarifying questions. Once a permit is matched, `src/data/permitRules.ts` deterministically derives stable requirement/document IDs from that permit's fields (`min_age`, `citizenship`, `allowed_business_types`, `allowed_zones`, `max_annual_turnover`, and one per `required_documents` entry) — these IDs, not anything Gemini invents, are what the UI tracks and what subsequent prompts tell Gemini to reference. Every turn, Gemini must reply with raw JSON matching:

```json
{
  "reply_message": "...",
  "newly_satisfied_requirements": ["min_age", "doc_aadhar"],
  "is_evaluation_complete": false,
  "final_eligibility": null,
  "matched_permit_id": "PMT001"
}
```
(`generationConfig.responseSchema` constrains this shape server-side.) `reply_message` becomes the chat bubble + TTS text; `newly_satisfied_requirements` flips matching requirement/document IDs from pending/missing to met/have in the right-hand panel; `is_evaluation_complete` + `final_eligibility` trigger the `ResultCard`, using Gemini's own `reply_message` as the closing summary (there's no separate hardcoded "next steps" list anymore).

**Multilingual replies**: the system prompt is told the session language directly ("You MUST respond entirely in the language corresponding to this code: hi") — Gemini generates the reply in that language itself. This replaced the old hardcoded per-language translation dictionaries entirely; session-language *detection* (via Deepgram) is unchanged, see below.

**Demo override**: the toggle in the bottom-right corner (Auto / Force Eligible / Force Ineligible) is *not* applied client-side — it's appended to the system prompt as an instruction Gemini must follow for the final verdict only, so the conversation still reasons naturally either way.

**Document uploads feed Gemini too**: selecting file(s) via the paperclip button still shows the same mock "Uploading…" → file-chip bubble UI as before, but instead of a hardcoded acknowledgment, a hidden line (`SYSTEM_NOTE: The user just uploaded 2 files: aadhar.pdf, pan.pdf.`) is sent to Gemini as a turn — invisible in the chat UI, but Gemini sees it, replies with an acknowledgment, and includes the relevant document IDs in `newly_satisfied_requirements`.

## Voice input/output (optional)

The chat input has a microphone button for speech-to-text, and each assistant message has a "Play audio" button for text-to-speech, both powered by [Deepgram](https://deepgram.com). Voice is entirely optional — the app works with typed text if it's not configured. Every new assistant reply starts speaking itself automatically as soon as it appears (`autoPlay` on `ChatMessage`/`TtsButton`); the button still lets you pause, resume, or replay it from the start once it's finished.

To enable it:

1. Set `VITE_DEEPGRAM_API_KEY` in `.env` (same file as the Gemini key above).
2. Restart `npm run dev`.

All Deepgram calls are isolated to [src/api/deepgram.ts](src/api/deepgram.ts). Both keys are read from Vite env vars and used directly from the browser — fine for this hackathon demo, but not for production (they'd be visible in the bundle).

**Speech-to-text language**: the dropdown next to the mic button defaults to "🌐 Auto-detect" — Deepgram identifies the spoken language itself (`detect_language=true`) from English, Hindi, Spanish, French, German, Dutch, Italian, or Japanese. **Kannada can't be auto-detected** (it's outside Deepgram's 35 detectable languages), so it's the one language you must pick manually from the dropdown — when explicitly selected, it's routed through Deepgram's hosted `whisper-large` model instead of `nova-2` (best-effort: broader coverage, lower accuracy than a dedicated model).

**Session language persistence**: the first language detected (or manually picked) becomes the conversation's "session language" — passed straight into Gemini's system prompt (see above) — and is remembered for the rest of the chat even if a later utterance is mis-detected. Speaking your initial request on the *landing page* carries its detected language into the chat screen too. Re-selecting "Auto-detect" from the dropdown unlocks it so the next utterance can re-set it.

**Hybrid text-to-speech**: Deepgram's Aura voices only cover English, Spanish, French, German, Dutch, Italian, and Japanese (`AURA_SUPPORTED_LANGUAGES` in [src/api/deepgram.ts](src/api/deepgram.ts)). For the session language, `TtsButton` picks the matching Aura voice from those seven (e.g. `aura-2-celeste-es` for Spanish). For Hindi and Kannada — which Aura can't speak at all — it falls back to the browser's own Web Speech API (`window.speechSynthesis`, see [src/api/webSpeechTts.ts](src/api/webSpeechTts.ts)) instead, so playback still works, just with a different engine and voice quality that depends on what your OS/browser has installed.

## Demo controls

The toggle in the bottom-right corner (Auto / Force Eligible / Force Ineligible) steers Gemini's final verdict for live demos — see "Demo override" above. "Auto" is the real, unforced behavior.
