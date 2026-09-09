export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-sm bg-gray-100 w-fit">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" />
    </div>
  );
}
