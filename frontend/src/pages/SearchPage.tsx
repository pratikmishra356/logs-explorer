import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import type { OrganizationSummary, IndexItem, SourceItem, LogSearchResponse } from '../api/types';

export default function SearchPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [org, setOrg] = useState<OrganizationSummary | null>(null);
  const [indexes, setIndexes] = useState<IndexItem[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);

  // Form
  const [selectedIndex, setSelectedIndex] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [sourceSearch, setSourceSearch] = useState('');
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [query, setQuery] = useState<string[]>([]);
  const [queryInput, setQueryInput] = useState('');
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');
  const [maxResults, setMaxResults] = useState(100);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<LogSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Init default times: last 1 hour
  useEffect(() => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    setToTime(toLocalISOString(now));
    setFromTime(toLocalISOString(oneHourAgo));
  }, []);

  useEffect(() => {
    const load = async () => {
      const [orgRes, indexRes] = await Promise.all([
        api.get(`/organizations/${orgId}`),
        api.get(`/organizations/${orgId}/indexes`),
      ]);
      setOrg(orgRes.data);
      setIndexes(indexRes.data);
    };
    load();
  }, [orgId]);

  // Load sources when index changes
  useEffect(() => {
    if (!selectedIndex) {
      setSources([]);
      setSelectedSource('');
      setSourceSearch('');
      return;
    }
    const idx = indexes.find(i => i.name === selectedIndex);
    if (!idx) return;
    api.get(`/organizations/${orgId}/indexes/${idx.id}/sources`).then(res => {
      setSources(res.data);
    });
  }, [selectedIndex, indexes, orgId]);

  // Filter sources based on search
  const filteredSources = sources.filter(s =>
    s.name.toLowerCase().includes(sourceSearch.toLowerCase())
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIndex) {
      setError('Please select an index');
      return;
    }
    setSearching(true);
    setResult(null);
    setError(null);
    try {
      const res = await api.post(`/organizations/${orgId}/search`, {
        index: selectedIndex,
        source: selectedSource || undefined,
        query: query.length > 0 ? query : undefined,
        from_time: new Date(fromTime).toISOString(),
        to_time: new Date(toTime).toISOString(),
        max_results: maxResults,
      });
      setResult(res.data);
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === 'string') {
          setError(detail);
        } else if (Array.isArray(detail)) {
          setError(detail.map((d: { msg: string }) => d.msg).join(', '));
        } else {
          setError(JSON.stringify(detail));
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Search failed';
        setError(msg);
      }
    } finally {
      setSearching(false);
    }
  };

  if (!org) return (
    <div className="text-center py-20">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      <p className="mt-4 text-slate-600">Loading...</p>
    </div>
  );

  return (
    <div>
      <Link to={`/orgs/${orgId}`} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-cyan-600 mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Organization
      </Link>

      <h1 className="text-3xl font-bold mb-2">
        <span className="text-slate-800">Search Logs</span>{' '}
        <span className="text-slate-600 text-xl">— {org.name}</span>
      </h1>
      <p className="text-slate-600 mb-8">Query logs by index, source, and search terms</p>

      <form onSubmit={handleSearch} className="bg-white border border-slate-200 rounded-2xl p-8 space-y-6 mb-8 shadow-lg">
        {/* Index + Source */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Index *</label>
            <select
              value={selectedIndex}
              onChange={e => { setSelectedIndex(e.target.value); setSelectedSource(''); }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
              required
            >
              <option value="">Select an index...</option>
              {indexes.map(idx => (
                <option key={idx.id} value={idx.name}>{idx.name}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Source (service name)</label>
            <div className="relative">
              <input
                type="text"
                value={selectedSource || sourceSearch}
                onChange={e => {
                  setSourceSearch(e.target.value);
                  setSelectedSource('');
                  setShowSourceDropdown(true);
                }}
                onFocus={() => setShowSourceDropdown(true)}
                onBlur={() => setTimeout(() => setShowSourceDropdown(false), 200)}
                placeholder={selectedSource ? selectedSource : "Search or select source..."}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
              />
              {selectedSource && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSource('');
                    setSourceSearch('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm font-bold"
                >
                  ✕
                </button>
              )}
              {showSourceDropdown && filteredSources.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSource('');
                      setSourceSearch('');
                      setShowSourceDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 text-slate-700 border-b border-slate-200"
                  >
                    <span className="text-slate-500">All sources</span>
                  </button>
                  {filteredSources.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedSource(s.name);
                        setSourceSearch('');
                        setShowSourceDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-cyan-50 text-slate-800 font-mono border-b border-slate-100 last:border-0"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">Backend wraps with wildcards automatically</p>
          </div>
        </div>

        {/* Query */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Search Query (optional)</label>
          <p className="text-xs text-slate-600 mb-3">Add multiple search terms - each will be searched as a quoted phrase</p>
          
          {/* Query list */}
          {query.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {query.map((q, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-gradient-to-r from-cyan-50 to-teal-50 border border-cyan-200 rounded-lg px-3 py-1.5 text-sm"
                >
                  <span className="text-slate-800 font-mono text-xs font-medium">"{q}"</span>
                  <button
                    type="button"
                    onClick={() => setQuery(query.filter((_, i) => i !== idx))}
                    className="text-slate-500 hover:text-slate-700 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add query input */}
          <div className="flex gap-3">
            <input
              type="text"
              value={queryInput}
              onChange={e => setQueryInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (queryInput.trim()) {
                    setQuery([...query, queryInput.trim()]);
                    setQueryInput('');
                  }
                }
              }}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
              placeholder='Enter search term and press Enter (e.g. ERROR)'
            />
            <button
              type="button"
              onClick={() => {
                if (queryInput.trim()) {
                  setQuery([...query, queryInput.trim()]);
                  setQueryInput('');
                }
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg"
            >
              Add
            </button>
          </div>
        </div>

        {/* Time range */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">From</label>
            <input
              type="datetime-local"
              value={fromTime}
              onChange={e => setFromTime(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">To</label>
            <input
              type="datetime-local"
              value={toTime}
              onChange={e => setToTime(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Max Results</label>
            <input
              type="number"
              value={maxResults}
              onChange={e => setMaxResults(Number(e.target.value))}
              min={1}
              max={1000}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
            />
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-slate-600 font-medium mr-1">Quick presets:</span>
          {[
            { label: '15m', mins: 15 },
            { label: '1h', mins: 60 },
            { label: '4h', mins: 240 },
            { label: '24h', mins: 1440 },
            { label: '7d', mins: 10080 },
          ].map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                const now = new Date();
                setToTime(toLocalISOString(now));
                setFromTime(toLocalISOString(new Date(now.getTime() - preset.mins * 60 * 1000)));
              }}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:border-cyan-400 hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 rounded-lg text-xs font-medium transition-all shadow-sm"
            >
              Last {preset.label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={searching}
          className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        >
          {searching ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Searching...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Run Search
            </>
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl border-2 bg-red-50 border-red-200 text-red-800 text-sm">
          <strong className="font-semibold">✗ Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          <div className="mb-6 p-4 rounded-xl text-sm bg-gradient-to-r from-cyan-50 to-teal-50 border-2 border-cyan-200">
            <span className="text-slate-700 font-medium">
              Found <strong className="text-cyan-700 text-lg">{result.data.length}</strong> result{result.data.length !== 1 ? 's' : ''}
            </span>
          </div>

          {result.data.length > 0 && (
            <div className="space-y-4">
              {result.data.map((entry, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center gap-4 text-xs text-slate-600 mb-3 flex-wrap">
                    {entry._time && (
                      <span className="bg-slate-100 px-2 py-1 rounded font-medium text-slate-700">
                        {entry._time as string}
                      </span>
                    )}
                    {entry.index && (
                      <span className="bg-cyan-100 text-cyan-700 px-2 py-1 rounded font-medium">
                        index={entry.index as string}
                      </span>
                    )}
                    {entry.source && (
                      <span className="bg-teal-100 text-teal-700 px-2 py-1 rounded font-medium font-mono text-xs">
                        source={entry.source as string}
                      </span>
                    )}
                    {entry.sourcetype && (
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">
                        sourcetype={entry.sourcetype as string}
                      </span>
                    )}
                    {entry.host && (
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">
                        host={entry.host as string}
                      </span>
                    )}
                  </div>
                  <pre className="text-sm text-slate-800 whitespace-pre-wrap break-all font-mono leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-200">
                    {(entry._raw as string) || JSON.stringify(entry, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function toLocalISOString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isAxiosError(err: unknown): err is { response?: { data?: { detail?: unknown } } } {
  return typeof err === 'object' && err !== null && 'response' in err;
}
