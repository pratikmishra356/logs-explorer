import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import type {
  OrganizationSummary,
  ProviderConfigResponse,
  ProviderTestResult,
  SyncResult,
  IndexItem,
  SourceItem,
  SourceSearchResult,
} from '../api/types';

type TabKey = 'indexes' | 'applications' | 'dashboards';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'indexes', label: 'Indexes' },
  { key: 'applications', label: 'Applications' },
  { key: 'dashboards', label: 'Dashboards' },
];

export default function OrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();

  // Org
  const [org, setOrg] = useState<OrganizationSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Provider config
  const [provider, setProvider] = useState<ProviderConfigResponse | null>(null);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    provider_type: 'splunk_cloud',
    host_url: '',
    auth_type: 'cookie',
    cookie: '',
    csrf_token: '',
  });

  // Test / Sync
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<TabKey>('indexes');
  const [tabData, setTabData] = useState<IndexItem[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Per-index source drill-down
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);
  const [indexSources, setIndexSources] = useState<SourceItem[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [syncingSourcesFor, setSyncingSourcesFor] = useState<string | null>(null);

  // Used indexes
  const [editingUsedIndexes, setEditingUsedIndexes] = useState(false);
  const [usedIndexesInput, setUsedIndexesInput] = useState('');
  const [savingUsedIndexes, setSavingUsedIndexes] = useState(false);

  // Source search
  const [sourceSearchTerm, setSourceSearchTerm] = useState('');
  const [sourceSearchResults, setSourceSearchResults] = useState<SourceSearchResult[]>([]);
  const [searchingSources, setSearchingSources] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────

  const fetchOrg = async () => {
    setLoading(true);
    try {
      const [orgRes, provRes] = await Promise.all([
        api.get(`/organizations/${orgId}`),
        api.get(`/organizations/${orgId}/provider`),
      ]);
      setOrg(orgRes.data);
      setProvider(provRes.data);
      // Pre-fill form with existing host
      if (provRes.data.is_configured) {
        setForm(f => ({ ...f, host_url: provRes.data.host_url }));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTab = async (tab: TabKey) => {
    setTabLoading(true);
    try {
      const res = await api.get(`/organizations/${orgId}/${tab}`);
      setTabData(res.data);
    } finally {
      setTabLoading(false);
    }
  };

  useEffect(() => { fetchOrg(); }, [orgId]);
  useEffect(() => { if (org && provider?.is_configured) fetchTab(activeTab); }, [org, activeTab, provider?.is_configured]);
  useEffect(() => {
    if (org?.used_indexes) {
      setUsedIndexesInput(org.used_indexes.join(', '));
    }
  }, [org]);

  // ── Provider config ───────────────────────────────────────────────

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put(`/organizations/${orgId}/provider`, {
        provider_type: form.provider_type,
        host_url: form.host_url,
        auth_type: form.auth_type,
        credentials: {
          cookie: form.cookie,
          csrf_token: form.csrf_token,
        },
      });
      setProvider(res.data);
      setShowProviderForm(false);
      fetchOrg();
    } finally {
      setSaving(false);
    }
  };

  // ── Test / Sync ───────────────────────────────────────────────────

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post(`/organizations/${orgId}/provider/test`);
      setTestResult(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test failed';
      setTestResult({ success: false, message: msg, details: null });
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.post(`/organizations/${orgId}/provider/sync`);
      setSyncResult(res.data);
      fetchOrg();
      fetchTab(activeTab);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setSyncResult({ success: false, message: msg, indexes_synced: 0, applications_synced: 0, dashboards_synced: 0 });
    } finally {
      setSyncing(false);
    }
  };

  // ── Sources drill-down ────────────────────────────────────────────

  const fetchSourcesForIndex = async (indexId: string) => {
    setSourcesLoading(true);
    try {
      const res = await api.get(`/organizations/${orgId}/indexes/${indexId}/sources`);
      setIndexSources(res.data);
    } finally {
      setSourcesLoading(false);
    }
  };

  const toggleIndex = (indexId: string) => {
    if (expandedIndex === indexId) {
      setExpandedIndex(null);
      setIndexSources([]);
    } else {
      setExpandedIndex(indexId);
      fetchSourcesForIndex(indexId);
    }
  };

  const handleSyncSources = async (indexId: string) => {
    setSyncingSourcesFor(indexId);
    try {
      await api.post(`/organizations/${orgId}/indexes/${indexId}/sync-sources`);
      if (expandedIndex === indexId) {
        fetchSourcesForIndex(indexId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      alert(`Source sync failed: ${msg}\n\nNote: Large indexes may take several minutes.`);
    } finally {
      setSyncingSourcesFor(null);
    }
  };

  const formatCount = (n: number | null) => {
    if (n == null) return '-';
    return n.toLocaleString();
  };

  // ── Used indexes ─────────────────────────────────────────────────────

  const handleSaveUsedIndexes = async () => {
    setSavingUsedIndexes(true);
    try {
      const indexes = usedIndexesInput.split(',').map(s => s.trim()).filter(s => s);
      await api.patch(`/organizations/${orgId}`, { used_indexes: indexes });
      setEditingUsedIndexes(false);
      fetchOrg();
    } finally {
      setSavingUsedIndexes(false);
    }
  };

  // ── Source search ────────────────────────────────────────────────────

  const handleSearchSources = async () => {
    if (!sourceSearchTerm.trim()) {
      setSourceSearchResults([]);
      return;
    }
    setSearchingSources(true);
    try {
      const res = await api.post(`/organizations/${orgId}/sources/search`, {
        search: sourceSearchTerm,
      });
      setSourceSearchResults(res.data.matches);
    } catch (err) {
      console.error('Source search failed:', err);
      setSourceSearchResults([]);
    } finally {
      setSearchingSources(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────

  if (loading) return (
    <div className="text-center py-20">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      <p className="mt-4 text-slate-600">Loading...</p>
    </div>
  );
  if (!org) return <div className="text-red-600 font-medium">Organization not found</div>;

  const stats = [
    { label: 'Indexes', count: org.index_count },
    { label: 'Sources', count: org.source_count },
    { label: 'Applications', count: org.application_count },
    { label: 'Dashboards', count: org.dashboard_count },
  ];

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-cyan-600 mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Organizations
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-1">{org.name}</h1>
          <p className="text-sm text-slate-500 font-mono">{org.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          {provider?.is_configured && (
            <>
              <Link
                to={`/orgs/${orgId}/search`}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg"
              >
                Search Logs
              </Link>
              <button onClick={handleTest} disabled={testing}
                className="px-4 py-2 bg-white border border-slate-300 hover:border-cyan-400 text-slate-700 hover:text-cyan-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-all shadow-sm">
                {testing ? 'Testing...' : 'Test'}
              </button>
              <button onClick={handleSync} disabled={syncing}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg">
                {syncing ? 'Syncing...' : 'Sync Metadata'}
              </button>
            </>
          )}
          <div className={`text-xs px-3 py-1 rounded-full font-medium ${
            org.is_active 
              ? 'bg-emerald-100 text-emerald-700' 
              : 'bg-slate-100 text-slate-600'
          }`}>
            {org.is_active ? 'Active' : 'Inactive'}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-shadow">
            <div className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">{s.count}</div>
            <div className="text-xs text-slate-600 mt-2 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Provider config */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800">Provider Configuration</h2>
          <button
            onClick={() => setShowProviderForm(!showProviderForm)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg"
          >
            {showProviderForm ? 'Cancel' : provider?.is_configured ? 'Update Credentials' : 'Configure Provider'}
          </button>
        </div>

        {provider?.is_configured && !showProviderForm && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <span className="text-slate-500 font-medium">Provider:</span>{' '}
                <span className="text-slate-800 font-semibold">{provider.provider_type}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Host:</span>{' '}
                <span className="text-slate-800 font-mono text-xs">{provider.host_url}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Last synced:</span>{' '}
                <span className="text-slate-800">{provider.last_synced_at ? new Date(provider.last_synced_at).toLocaleString() : 'Never'}</span>
              </div>
            </div>
          </div>
        )}

        {showProviderForm && (
          <form onSubmit={handleSaveProvider} className="bg-white border border-slate-200 rounded-xl p-8 space-y-6 shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Provider</label>
                <select
                  value={form.provider_type}
                  onChange={e => setForm({ ...form, provider_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                >
                  <option value="splunk_cloud">Splunk Cloud</option>
                  <option value="opensearch" disabled>OpenSearch (coming soon)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Host URL</label>
                <input
                  value={form.host_url}
                  onChange={e => setForm({ ...form, host_url: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                  placeholder="https://your-instance.splunkcloud.com"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Cookie</label>
                <textarea
                  value={form.cookie}
                  onChange={e => setForm({ ...form, cookie: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 font-mono transition"
                  placeholder="Paste Splunk session cookie..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">CSRF Token</label>
                <input
                  value={form.csrf_token}
                  onChange={e => setForm({ ...form, csrf_token: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 font-mono transition"
                  placeholder="CSRF token value"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </form>
        )}

        {!provider?.is_configured && !showProviderForm && (
          <div className="text-slate-500 text-center py-12 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
            <svg className="w-12 h-12 mx-auto text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="font-medium">No provider configured</p>
            <p className="text-sm mt-1">Click "Configure Provider" to connect to Splunk or another log provider</p>
          </div>
        )}
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`mb-6 p-4 rounded-xl border-2 text-sm ${
          testResult.success 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <strong className="font-semibold">{testResult.success ? '✓ Connected' : '✗ Failed'}:</strong> {testResult.message}
          {testResult.details && (
            <pre className="mt-3 text-xs text-slate-600 bg-white p-3 rounded border border-slate-200 overflow-auto">{JSON.stringify(testResult.details, null, 2)}</pre>
          )}
        </div>
      )}

      {/* Sync result */}
      {syncResult && (
        <div className={`mb-6 p-4 rounded-xl border-2 text-sm ${
          syncResult.success 
            ? 'bg-cyan-50 border-cyan-200 text-cyan-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <strong className="font-semibold">{syncResult.success ? '✓ Sync complete' : '✗ Sync failed'}:</strong> {syncResult.message}
          {syncResult.success && (
            <div className="mt-3 flex gap-6 text-xs font-medium">
              <span>Indexes: <strong className="text-cyan-700">{syncResult.indexes_synced}</strong></span>
              <span>Apps: <strong className="text-cyan-700">{syncResult.applications_synced}</strong></span>
              <span>Dashboards: <strong className="text-cyan-700">{syncResult.dashboards_synced}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Used Indexes */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800">Important Indexes</h2>
          <button
            onClick={() => {
              setEditingUsedIndexes(!editingUsedIndexes);
              if (org?.used_indexes) {
                setUsedIndexesInput(org.used_indexes.join(', '));
              }
            }}
            className="px-4 py-2 bg-white border border-slate-300 hover:border-cyan-400 text-slate-700 hover:text-cyan-700 rounded-lg text-sm font-medium transition-all shadow-sm"
          >
            {editingUsedIndexes ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editingUsedIndexes ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Index names (comma-separated)
            </label>
            <input
              type="text"
              value={usedIndexesInput}
              onChange={e => setUsedIndexesInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 mb-4 transition"
              placeholder="prod_g2, prod_restaurant, staging_logs"
            />
            <button
              onClick={handleSaveUsedIndexes}
              disabled={savingUsedIndexes}
              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg"
            >
              {savingUsedIndexes ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            {org?.used_indexes && org.used_indexes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {org.used_indexes.map((idx, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 bg-gradient-to-r from-cyan-100 to-teal-100 border border-cyan-200 text-cyan-700 rounded-lg text-sm font-mono font-medium"
                  >
                    {idx}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No important indexes marked yet</p>
            )}
          </div>
        )}
      </div>

      {/* Source Search */}
      {provider?.is_configured && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Search Sources</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={sourceSearchTerm}
                onChange={e => setSourceSearchTerm(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchSources();
                  }
                }}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                placeholder="Enter search term (space-separated for multiple terms)"
              />
              <button
                onClick={handleSearchSources}
                disabled={searchingSources}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg"
              >
                {searchingSources ? 'Searching...' : 'Search'}
              </button>
            </div>

            {sourceSearchResults.length > 0 && (
              <div className="mt-6">
                <p className="text-sm text-slate-600 mb-3 font-medium">
                  Found {sourceSearchResults.length} matching source{sourceSearchResults.length !== 1 ? 's' : ''}
                </p>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {sourceSearchResults.map(source => (
                    <div
                      key={source.id}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm hover:border-cyan-300 transition"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm text-slate-800 font-semibold">{source.name}</span>
                        <span className="text-xs text-slate-600 bg-slate-200 px-2 py-1 rounded font-medium">{source.repository_name}</span>
                      </div>
                      <div className="flex gap-6 text-xs text-slate-600 mt-2">
                        {source.total_count !== null && (
                          <span><strong>Count:</strong> {formatCount(source.total_count)}</span>
                        )}
                        {source.last_event_at && (
                          <span><strong>Last:</strong> {new Date(source.last_event_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metadata tabs (only when provider configured) */}
      {provider?.is_configured && (
        <>
          <div className="border-b-2 border-slate-200 mb-8">
            <div className="flex gap-2 -mb-px overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setExpandedIndex(null); }}
                  className={`px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-cyan-600 text-cyan-600'
                      : 'border-transparent text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {tabLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
              <p className="mt-4 text-slate-600">Loading {activeTab}...</p>
            </div>
          ) : tabData.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
              <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-slate-600 font-medium">No {activeTab} found</p>
              <p className="text-sm text-slate-500 mt-1">Click "Sync Metadata" to fetch from the provider</p>
            </div>
          ) : activeTab === 'indexes' ? (
            /* ── Indexes with expandable sources ── */
            <div className="space-y-3">
              {tabData.map((idx: IndexItem) => (
                <div key={idx.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
                  <div
                    className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 transition"
                    onClick={() => toggleIndex(idx.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-cyan-600 text-sm font-bold">{expandedIndex === idx.id ? '▼' : '▶'}</span>
                      <div>
                        <span className="font-semibold text-slate-800 text-base">{idx.name}</span>
                        <span className="text-xs text-slate-500 ml-3">
                          {idx.synced_at ? `synced ${new Date(idx.synced_at).toLocaleString()}` : 'not synced'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSyncSources(idx.id); }}
                      disabled={syncingSourcesFor === idx.id}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all shadow-sm hover:shadow"
                      title={syncingSourcesFor === idx.id ? 'This may take several minutes for large indexes...' : 'Sync sources from this index'}
                    >
                      {syncingSourcesFor === idx.id ? 'Syncing...' : 'Sync Sources'}
                    </button>
                  </div>

                  {expandedIndex === idx.id && (
                    <div className="border-t border-slate-200 bg-slate-50">
                      {sourcesLoading ? (
                        <div className="text-slate-600 text-sm p-6 text-center">
                          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600 mb-2"></div>
                          <p>Loading sources...</p>
                        </div>
                      ) : indexSources.length === 0 ? (
                        <div className="text-slate-500 text-sm p-6 text-center">
                          No sources synced yet. Click "Sync Sources" to fetch from this index.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-left bg-white">
                                <th className="py-3 px-5 font-semibold text-slate-700">Source Name</th>
                                <th className="py-3 px-5 font-semibold text-slate-700 text-right">Total Count</th>
                                <th className="py-3 px-5 font-semibold text-slate-700">Last Event</th>
                                <th className="py-3 px-5 font-semibold text-slate-700">First Event</th>
                              </tr>
                            </thead>
                            <tbody>
                              {indexSources.map(source => (
                                <tr key={source.id} className="border-b border-slate-100 hover:bg-white transition">
                                  <td className="py-3 px-5 font-mono text-xs text-slate-800 font-medium">{source.name}</td>
                                  <td className="py-3 px-5 text-slate-600 text-xs text-right font-medium">{formatCount(source.total_count)}</td>
                                  <td className="py-3 px-5 text-slate-600 text-xs">
                                    {source.last_event_at ? new Date(source.last_event_at).toLocaleString() : '-'}
                                  </td>
                                  <td className="py-3 px-5 text-slate-600 text-xs">
                                    {source.first_event_at ? new Date(source.first_event_at).toLocaleString() : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* ── Generic table for apps / dashboards ── */
            <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left bg-slate-50">
                    <th className="py-4 px-5 font-semibold text-slate-700">Name</th>
                    <th className="py-4 px-5 font-semibold text-slate-700">External ID</th>
                    {activeTab === 'applications' && <th className="py-4 px-5 font-semibold text-slate-700">Version</th>}
                    <th className="py-4 px-5 font-semibold text-slate-700">Synced At</th>
                  </tr>
                </thead>
                <tbody>
                  {tabData.map((item: Record<string, unknown>) => (
                    <tr key={item.id as string} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="py-4 px-5 font-semibold text-slate-800">{item.name as string}</td>
                      <td className="py-4 px-5 text-slate-600 font-mono text-xs">{(item.external_id as string) || '-'}</td>
                      {activeTab === 'applications' && <td className="py-4 px-5 text-slate-600">{(item.version as string) || '-'}</td>}
                      <td className="py-4 px-5 text-slate-600 text-xs">
                        {item.synced_at ? new Date(item.synced_at as string).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
