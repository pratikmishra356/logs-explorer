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

  if (loading) return <div className="text-gray-500">Loading...</div>;
  if (!org) return <div className="text-red-400">Organization not found</div>;

  const stats = [
    { label: 'Indexes', count: org.index_count },
    { label: 'Sources', count: org.source_count },
    { label: 'Applications', count: org.application_count },
    { label: 'Dashboards', count: org.dashboard_count },
  ];

  return (
    <div>
      <Link to="/" className="text-sm text-blue-400 hover:text-blue-300 mb-4 inline-block">&larr; Back to Organizations</Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-sm text-gray-500">{org.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          {provider?.is_configured && (
            <>
              <Link
                to={`/orgs/${orgId}/search`}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition"
              >
                Search Logs
              </Link>
              <button onClick={handleTest} disabled={testing}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                {testing ? 'Testing...' : 'Test'}
              </button>
              <button onClick={handleSync} disabled={syncing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                {syncing ? 'Syncing...' : 'Sync Metadata'}
              </button>
            </>
          )}
          <div className={`text-xs px-2 py-1 rounded-full ${org.is_active ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
            {org.is_active ? 'Active' : 'Inactive'}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{s.count}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Provider config */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Provider Configuration</h2>
          <button
            onClick={() => setShowProviderForm(!showProviderForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
          >
            {showProviderForm ? 'Cancel' : provider?.is_configured ? 'Update Credentials' : 'Configure Provider'}
          </button>
        </div>

        {provider?.is_configured && !showProviderForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Provider:</span>{' '}
                <span className="text-white">{provider.provider_type}</span>
              </div>
              <div>
                <span className="text-gray-500">Host:</span>{' '}
                <span className="text-white font-mono text-xs">{provider.host_url}</span>
              </div>
              <div>
                <span className="text-gray-500">Last synced:</span>{' '}
                <span className="text-white">{provider.last_synced_at ? new Date(provider.last_synced_at).toLocaleString() : 'Never'}</span>
              </div>
            </div>
          </div>
        )}

        {showProviderForm && (
          <form onSubmit={handleSaveProvider} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Provider</label>
                <select
                  value={form.provider_type}
                  onChange={e => setForm({ ...form, provider_type: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <option value="splunk_cloud">Splunk Cloud</option>
                  <option value="opensearch" disabled>OpenSearch (coming soon)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Host URL</label>
                <input
                  value={form.host_url}
                  onChange={e => setForm({ ...form, host_url: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://your-instance.splunkcloud.com"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Cookie</label>
                <textarea
                  value={form.cookie}
                  onChange={e => setForm({ ...form, cookie: e.target.value })}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="Paste Splunk session cookie..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">CSRF Token</label>
                <input
                  value={form.csrf_token}
                  onChange={e => setForm({ ...form, csrf_token: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="CSRF token value"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </form>
        )}

        {!provider?.is_configured && !showProviderForm && (
          <div className="text-gray-500 text-center py-8 border border-dashed border-gray-800 rounded-xl">
            No provider configured. Click "Configure Provider" to connect to Splunk or another log provider.
          </div>
        )}
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`mb-4 p-4 rounded-xl border text-sm ${testResult.success ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-red-900/20 border-red-800 text-red-300'}`}>
          <strong>{testResult.success ? 'Connected' : 'Failed'}:</strong> {testResult.message}
          {testResult.details && (
            <pre className="mt-2 text-xs text-gray-400 overflow-auto">{JSON.stringify(testResult.details, null, 2)}</pre>
          )}
        </div>
      )}

      {/* Sync result */}
      {syncResult && (
        <div className={`mb-4 p-4 rounded-xl border text-sm ${syncResult.success ? 'bg-blue-900/20 border-blue-800 text-blue-300' : 'bg-red-900/20 border-red-800 text-red-300'}`}>
          <strong>{syncResult.success ? 'Sync complete' : 'Sync failed'}:</strong> {syncResult.message}
          {syncResult.success && (
            <div className="mt-2 flex gap-4 text-xs text-gray-400">
              <span>Indexes: {syncResult.indexes_synced}</span>
              <span>Apps: {syncResult.applications_synced}</span>
              <span>Dashboards: {syncResult.dashboards_synced}</span>
            </div>
          )}
        </div>
      )}

      {/* Used Indexes */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Important Indexes</h2>
          <button
            onClick={() => {
              setEditingUsedIndexes(!editingUsedIndexes);
              if (org?.used_indexes) {
                setUsedIndexesInput(org.used_indexes.join(', '));
              }
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
          >
            {editingUsedIndexes ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editingUsedIndexes ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Index names (comma-separated)
            </label>
            <input
              type="text"
              value={usedIndexesInput}
              onChange={e => setUsedIndexesInput(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              placeholder="prod_g2, prod_restaurant, staging_logs"
            />
            <button
              onClick={handleSaveUsedIndexes}
              disabled={savingUsedIndexes}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
            >
              {savingUsedIndexes ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            {org?.used_indexes && org.used_indexes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {org.used_indexes.map((idx, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-blue-900/50 text-blue-300 rounded-lg text-sm font-mono"
                  >
                    {idx}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No important indexes marked yet</p>
            )}
          </div>
        )}
      </div>

      {/* Source Search */}
      {provider?.is_configured && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Search Sources</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex gap-2 mb-4">
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
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter search term (space-separated for multiple terms)"
              />
              <button
                onClick={handleSearchSources}
                disabled={searchingSources}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
              >
                {searchingSources ? 'Searching...' : 'Search'}
              </button>
            </div>

            {sourceSearchResults.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-400 mb-2">
                  Found {sourceSearchResults.length} matching source{sourceSearchResults.length !== 1 ? 's' : ''}
                </p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {sourceSearchResults.map(source => (
                    <div
                      key={source.id}
                      className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs text-white">{source.name}</span>
                        <span className="text-xs text-gray-500">{source.repository_name}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500 mt-2">
                        {source.total_count !== null && (
                          <span>Count: {formatCount(source.total_count)}</span>
                        )}
                        {source.last_event_at && (
                          <span>Last: {new Date(source.last_event_at).toLocaleString()}</span>
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
          <div className="border-b border-gray-800 mb-6">
            <div className="flex gap-1 -mb-px overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setExpandedIndex(null); }}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {tabLoading ? (
            <div className="text-gray-500">Loading {activeTab}...</div>
          ) : tabData.length === 0 ? (
            <div className="text-gray-500 text-center py-12">
              No {activeTab} found. Click "Sync Metadata" to fetch from the provider.
            </div>
          ) : activeTab === 'indexes' ? (
            /* ── Indexes with expandable sources ── */
            <div className="space-y-2">
              {tabData.map((idx: IndexItem) => (
                <div key={idx.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition"
                    onClick={() => toggleIndex(idx.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs">{expandedIndex === idx.id ? '▼' : '▶'}</span>
                      <div>
                        <span className="font-medium text-white">{idx.name}</span>
                        <span className="text-xs text-gray-500 ml-3">
                          {idx.synced_at ? `synced ${new Date(idx.synced_at).toLocaleString()}` : 'not synced'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSyncSources(idx.id); }}
                      disabled={syncingSourcesFor === idx.id}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition"
                      title={syncingSourcesFor === idx.id ? 'This may take several minutes for large indexes...' : 'Sync sources from this index'}
                    >
                      {syncingSourcesFor === idx.id ? 'Syncing Sources...' : 'Sync Sources'}
                    </button>
                  </div>

                  {expandedIndex === idx.id && (
                    <div className="border-t border-gray-800 bg-gray-950/50">
                      {sourcesLoading ? (
                        <div className="text-gray-500 text-sm p-4">Loading sources...</div>
                      ) : indexSources.length === 0 ? (
                        <div className="text-gray-500 text-sm p-4 text-center">
                          No sources synced yet. Click "Sync Sources" to fetch from this index.
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-800 text-left text-gray-500">
                              <th className="py-2 px-4 font-medium">Source Name</th>
                              <th className="py-2 px-4 font-medium text-right">Total Count</th>
                              <th className="py-2 px-4 font-medium">Last Event</th>
                              <th className="py-2 px-4 font-medium">First Event</th>
                            </tr>
                          </thead>
                          <tbody>
                            {indexSources.map(source => (
                              <tr key={source.id} className="border-b border-gray-800/30 hover:bg-gray-900/50">
                                <td className="py-2 px-4 font-mono text-xs text-white">{source.name}</td>
                                <td className="py-2 px-4 text-gray-400 text-xs text-right">{formatCount(source.total_count)}</td>
                                <td className="py-2 px-4 text-gray-500 text-xs">
                                  {source.last_event_at ? new Date(source.last_event_at).toLocaleString() : '-'}
                                </td>
                                <td className="py-2 px-4 text-gray-500 text-xs">
                                  {source.first_event_at ? new Date(source.first_event_at).toLocaleString() : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* ── Generic table for apps / dashboards ── */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-gray-500">
                    <th className="py-3 px-4 font-medium">Name</th>
                    <th className="py-3 px-4 font-medium">External ID</th>
                    {activeTab === 'applications' && <th className="py-3 px-4 font-medium">Version</th>}
                    <th className="py-3 px-4 font-medium">Synced At</th>
                  </tr>
                </thead>
                <tbody>
                  {tabData.map((item: Record<string, unknown>) => (
                    <tr key={item.id as string} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                      <td className="py-3 px-4 font-medium text-white">{item.name as string}</td>
                      <td className="py-3 px-4 text-gray-400 font-mono text-xs">{(item.external_id as string) || '-'}</td>
                      {activeTab === 'applications' && <td className="py-3 px-4 text-gray-400">{(item.version as string) || '-'}</td>}
                      <td className="py-3 px-4 text-gray-500 text-xs">
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
