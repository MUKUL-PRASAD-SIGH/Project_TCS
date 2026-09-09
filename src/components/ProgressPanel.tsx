import type { PermitDetails } from "../types";

interface ProgressPanelProps {
  permit: PermitDetails;
  progress: number;
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4"
    >
      <circle cx="10" cy="10" r="7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ProgressPanel({ permit, progress }: ProgressPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Identified Permit
        </p>
        <p className="mt-1 font-medium text-slate-900">{permit.name}</p>
        <p className="mt-1 text-xs text-slate-500">{permit.description}</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Progress
          </p>
          <span className="text-xs font-medium text-slate-600">
            {progress}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-slate-900 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
          Requirements
        </p>
        <ul className="flex flex-col gap-2">
          {permit.requirements.map((req) => (
            <li key={req.id} className="flex items-center gap-2 text-sm">
              <span
                className={
                  req.status === "met"
                    ? "text-emerald-600"
                    : req.status === "failed"
                      ? "text-red-500"
                      : "text-gray-300"
                }
              >
                {req.status === "met" ? (
                  <CheckIcon />
                ) : req.status === "failed" ? (
                  <XIcon />
                ) : (
                  <CircleIcon />
                )}
              </span>
              <span
                className={
                  req.status === "pending"
                    ? "text-slate-400"
                    : "text-slate-700"
                }
              >
                {req.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
          Documents
        </p>
        <ul className="flex flex-col gap-2">
          {permit.documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 text-sm">
              <span
                className={
                  doc.status === "have" ? "text-emerald-600" : "text-amber-500"
                }
              >
                {doc.status === "have" ? <CheckIcon /> : <WarningIcon />}
              </span>
              <span className="text-slate-700">{doc.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
