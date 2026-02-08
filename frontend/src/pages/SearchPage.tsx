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

  if (!org) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <Link to={`/orgs/${orgId}`} className="text-sm text-blue-400 hover:text-blue-300 mb-4 inline-block">
        &larr; Back to Organization
      </Link>

      <h1 className="text-2xl font-bold mb-6">Search Logs &mdash; {org.name}</h1>

      <form onSubmit={handleSearch} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4 mb-6">
        {/* Index + Source */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Index *</label>
            <select
              value={selectedIndex}
              onChange={e => { setSelectedIndex(e.target.value); setSelectedSource(''); }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none"
              required
            >
              <option value="">Select an index...</option>
              {indexes.map(idx => (
                <option key={idx.id} value={idx.name}>{idx.name}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-400 mb-1">Source (service name)</label>
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
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              {selectedSource && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSource('');
                    setSourceSearch('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
              {showSourceDropdown && filteredSources.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSource('');
                      setSourceSearch('');
                      setShowSourceDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 text-gray-300"
                  >
                    <span className="text-gray-500">All sources</span>
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
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-700 text-gray-300 font-mono"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-1">Backend wraps with wildcards automatically</p>
          </div>
        </div>

        {/* Query */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Search Query (optional)</label>
          <p className="text-xs text-gray-600 mb-2">Add multiple search terms - each will be searched as a quoted phrase</p>
          
          {/* Query list */}
          {query.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {query.map((q, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm"
                >
                  <span className="text-gray-300 font-mono text-xs">"{q}"</span>
                  <button
                    type="button"
                    onClick={() => setQuery(query.filter((_, i) => i !== idx))}
                    className="text-gray-500 hover:text-white text-xs ml-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add query input */}
          <div className="flex gap-2">
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
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
            >
              Add
            </button>
          </div>
        </div>

        {/* Time range */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">From</label>
            <input
              type="datetime-local"
              value={fromTime}
              onChange={e => setFromTime(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">To</label>
            <input
              type="datetime-local"
              value={toTime}
              onChange={e => setToTime(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Max Results</label>
            <input
              type="number"
              value={maxResults}
              onChange={e => setMaxResults(Number(e.target.value))}
              min={1}
              max={1000}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-gray-500 self-center mr-1">Quick:</span>
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
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-xs transition"
            >
              Last {preset.label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={searching}
          className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
        >
          {searching ? 'Searching...' : 'Run Search'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 rounded-xl border bg-red-900/20 border-red-800 text-red-300 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          <div className="mb-4 p-3 rounded-lg text-sm bg-gray-900 border border-gray-800">
            <span className="text-gray-300">
              Found <strong className="text-white">{result.data.length}</strong> results
            </span>
          </div>

          {result.data.length > 0 && (
            <div className="space-y-2">
              {result.data.map((entry, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                    {entry._time && <span className="text-gray-400">{entry._time as string}</span>}
                    {entry.index && <span>index={entry.index as string}</span>}
                    {entry.source && <span>source={entry.source as string}</span>}
                    {entry.sourcetype && <span>sourcetype={entry.sourcetype as string}</span>}
                    {entry.host && <span>host={entry.host as string}</span>}
                  </div>
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap break-all font-mono leading-relaxed">
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
