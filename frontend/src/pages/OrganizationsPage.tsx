import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import type { Organization } from '../api/types';

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [creating, setCreating] = useState(false);

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/organizations');
      setOrgs(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrgs(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/organizations', {
        name: form.name,
        slug: form.slug,
        description: form.description || null,
      });
      setForm({ name: '', slug: '', description: '' });
      setShowForm(false);
      fetchOrgs();
    } finally {
      setCreating(false);
    }
  };

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
          >
            {showInstructions ? 'Hide' : 'Show'} Setup Guide
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
          >
            {showForm ? 'Cancel' : '+ New Organization'}
          </button>
        </div>
      </div>

      {/* Setup Instructions */}
      {showInstructions && (
        <div className="mb-8 bg-blue-900/20 border border-blue-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-blue-300 mb-4">Organization Setup Guide</h2>
          <div className="space-y-4 text-sm text-gray-300">
            <div className="flex gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</div>
              <div>
                <h3 className="font-semibold text-white mb-1">Create Organization</h3>
                <p className="text-gray-400">Click "+ New Organization" above and fill in:</p>
                <ul className="list-disc list-inside mt-1 text-gray-400 ml-4 space-y-1">
                  <li><strong>Name</strong>: Display name (e.g., "Production", "Staging")</li>
                  <li><strong>Slug</strong>: URL-friendly identifier (auto-generated from name)</li>
                  <li><strong>Description</strong>: Optional description</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</div>
              <div>
                <h3 className="font-semibold text-white mb-1">Configure Provider Connection</h3>
                <p className="text-gray-400">After creating, click on the organization and:</p>
                <ul className="list-disc list-inside mt-1 text-gray-400 ml-4 space-y-1">
                  <li>Click <strong>"Configure Provider"</strong> in the Provider Configuration section</li>
                  <li>Select provider type (currently <strong>Splunk Cloud</strong>)</li>
                  <li>Enter <strong>Host URL</strong> (e.g., <code className="text-blue-400">https://your-instance.splunkcloud.com</code>)</li>
                  <li>Paste your <strong>Cookie</strong> (Splunk session cookie)</li>
                  <li>Enter <strong>CSRF Token</strong> (from Splunk)</li>
                  <li>Click <strong>"Save Configuration"</strong></li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">3</div>
              <div>
                <h3 className="font-semibold text-white mb-1">Sync Metadata</h3>
                <p className="text-gray-400">Once provider is configured:</p>
                <ul className="list-disc list-inside mt-1 text-gray-400 ml-4 space-y-1">
                  <li>Click <strong>"Test"</strong> to verify connection</li>
                  <li>Click <strong>"Sync Metadata"</strong> to fetch indexes, applications, and dashboards</li>
                  <li>Wait for sync to complete (may take a minute)</li>
                  <li>Indexes will appear in the <strong>Indexes</strong> tab</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">4</div>
              <div>
                <h3 className="font-semibold text-white mb-1">Mark Important Indexes</h3>
                <p className="text-gray-400">In the organization detail page:</p>
                <ul className="list-disc list-inside mt-1 text-gray-400 ml-4 space-y-1">
                  <li>Scroll to the <strong>"Important Indexes"</strong> section</li>
                  <li>Click <strong>"Edit"</strong></li>
                  <li>Enter index names separated by commas (e.g., <code className="text-blue-400">prod_g2, prod_restaurant</code>)</li>
                  <li>Click <strong>"Save"</strong></li>
                  <li>These indexes will be prioritized in API responses and UI</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">5</div>
              <div>
                <h3 className="font-semibold text-white mb-1">Sync Sources (Optional)</h3>
                <p className="text-gray-400">To discover services/log sources within an index:</p>
                <ul className="list-disc list-inside mt-1 text-gray-400 ml-4 space-y-1">
                  <li>Go to the <strong>Indexes</strong> tab</li>
                  <li>Click on an index to expand it</li>
                  <li>Click <strong>"Sync Sources"</strong> for that index</li>
                  <li>Wait for sync (may take several minutes for large indexes)</li>
                  <li>Sources will appear with their log counts and time ranges</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-blue-800">
              <p className="text-xs text-gray-400">
                <strong>Tip:</strong> Once setup is complete, you can use the <strong>"Search Logs"</strong> button to query logs by index, source, and search terms.
              </p>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
              <input
                value={form.name}
                onChange={e => { setForm({ ...form, name: e.target.value, slug: autoSlug(e.target.value) }); }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Acme Inc."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Slug</label>
              <input
                value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="acme-inc"
                required
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <input
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Optional description"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
          >
            {creating ? 'Creating...' : 'Create Organization'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : orgs.length === 0 ? (
        <div className="text-gray-500 text-center py-20">No organizations yet. Create one to get started.</div>
      ) : (
        <div className="grid gap-4">
          {orgs.map(org => (
            <Link
              key={org.id}
              to={`/orgs/${org.id}`}
              className="block bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{org.name}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{org.slug}</p>
                  {org.description && (
                    <p className="text-sm text-gray-400 mt-1">{org.description}</p>
                  )}
                </div>
                <div className={`text-xs px-2 py-1 rounded-full ${org.is_active ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                  {org.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
