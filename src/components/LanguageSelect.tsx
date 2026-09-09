import type { VoiceLanguage } from "../api/deepgram";

interface LanguageSelectProps {
  value: VoiceLanguage;
  onChange: (language: VoiceLanguage) => void;
  disabled?: boolean;
  size?: "md" | "lg";
}

const LANGUAGES: { value: VoiceLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "kn", label: "ಕನ್ನಡ" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "nl", label: "Nederlands" },
  { value: "it", label: "Italiano" },
  { value: "ja", label: "日本語" },
];

export function LanguageSelect({
  value,
  onChange,
  disabled,
  size = "md",
}: LanguageSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as VoiceLanguage)}
      disabled={disabled}
      aria-label="Voice input language"
      title="Voice input language"
      className={`shrink-0 rounded-lg border border-gray-200 bg-gray-50 text-slate-600 text-xs pl-2 pr-1 outline-none focus:ring-2 focus:ring-slate-900 disabled:text-gray-300 ${
        size === "lg" ? "h-11" : "h-9"
      }`}
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.value} value={lang.value}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}
