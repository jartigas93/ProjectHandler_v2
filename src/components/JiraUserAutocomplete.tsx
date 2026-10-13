import React, { useEffect, useRef, useState } from 'react';
import { Loader2, User as UserIcon } from 'lucide-react';
import { JiraUser } from '../types';

interface JiraUserAutocompleteProps {
  value: string;
  onChange: (text: string) => void;
  onSelect: (user: JiraUser) => void;
  jiraConnection: {
    domain: string;
    userEmail: string;
    apiToken: string;
    projectKey: string;
    simulationMode: boolean;
  };
  /** Jira accountIds to hide from suggestions (e.g. users already added) */
  excludeAccountIds?: string[];
  placeholder?: string;
  className?: string;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

export const JiraUserAutocomplete: React.FC<JiraUserAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  jiraConnection,
  excludeAccountIds = [],
  placeholder,
  className,
}) => {
  const [suggestions, setSuggestions] = useState<JiraUser[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [justSelected, setJustSelected] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search; cancels the in-flight request when the text changes
  useEffect(() => {
    if (justSelected) {
      setJustSelected(false);
      return;
    }

    const q = value.trim();
    if (q.length < MIN_CHARS) {
      setSuggestions([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/jira/search-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...jiraConnection, query: q }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setSuggestions([]);
          setError(data.error || 'No se pudo buscar usuarios en Jira.');
        } else {
          setSuggestions(Array.isArray(data.users) ? data.users : []);
        }
        setHighlighted(0);
        setIsOpen(true);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setSuggestions([]);
          setError('No se pudo buscar usuarios en Jira.');
          setIsOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const visible = suggestions.filter((u) => !excludeAccountIds.includes(u.accountId));

  const choose = (user: JiraUser) => {
    setJustSelected(true);
    setIsOpen(false);
    setSuggestions([]);
    onSelect(user);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || visible.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % visible.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + visible.length) % visible.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(visible[highlighted]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const showPanel =
    isOpen && value.trim().length >= MIN_CHARS && (isLoading || error || visible.length > 0 || suggestions.length === 0);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        required
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => value.trim().length >= MIN_CHARS && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className={className}
      />
      {isLoading && (
        <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
      )}

      {showPanel && (
        <ul className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-[#1C1E20] border border-[#3E4247] rounded-xl shadow-xl shadow-black/40">
          {error ? (
            <li className="px-3 py-2 text-[11px] text-red-400">{error}</li>
          ) : isLoading && visible.length === 0 ? (
            <li className="px-3 py-2 text-[11px] text-slate-400">Buscando en Jira…</li>
          ) : visible.length === 0 ? (
            <li className="px-3 py-2 text-[11px] text-slate-500">
              Sin coincidencias en Jira. Puedes completar los datos manualmente.
            </li>
          ) : (
            visible.map((u, idx) => (
              <li
                key={u.accountId}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(u);
                }}
                onMouseEnter={() => setHighlighted(idx)}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer ${
                  idx === highlighted ? 'bg-[#FF5038]/15' : 'hover:bg-[#2A2C2F]'
                }`}
              >
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" className="w-6 h-6 rounded-full shrink-0" />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-[#2A2C2F] flex items-center justify-center shrink-0">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-xs text-white truncate">{u.displayName}</span>
                  {u.emailAddress && (
                    <span className="block text-[10px] text-slate-400 truncate">{u.emailAddress}</span>
                  )}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};
