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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-1">Organizations</h1>
          <p className="text-slate-600">Manage your organizations and their log providers</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            {showInstructions ? 'Hide' : 'Show'} Setup Guide
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {showForm ? 'Cancel' : '+ New Organization'}
          </button>
        </div>
      </div>

      {/* Setup Instructions */}
      {showInstructions && (
        <div className="mb-8 bg-slate-50 border border-slate-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Setup Guide</h2>
          <div className="space-y-6 text-sm text-slate-700">
            {[
              {
                step: 1,
                title: 'Create Organization',
                desc: 'Click "Create workspace" and fill in name, slug, and optional description.',
              },
              {
                step: 2,
                title: 'Configure Provider',
                desc: 'Open the organization → Click "Configure Provider" → Enter Splunk Cloud host URL, cookie, and CSRF token.',
              },
              {
                step: 3,
                title: 'Sync Metadata',
                desc: 'Click "Test" to verify connection, then "Sync Metadata" to fetch indexes, applications, and dashboards.',
              },
              {
                step: 4,
                title: 'Mark Important Indexes',
                desc: 'In "Important Indexes" section, click "Edit" → Enter comma-separated index names → Save.',
              },
              {
                step: 5,
                title: 'Sync Sources (Optional)',
                desc: 'Go to Indexes tab → Expand an index → Click "Sync Sources" to discover services/log sources.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-3">
                <div className="shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                  {item.step}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-slate-800 mb-1 text-sm">{item.title}</h3>
                  <p className="text-slate-600 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Create New Organization</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Name</label>
              <input
                value={form.name}
                onChange={e => { setForm({ ...form, name: e.target.value, slug: autoSlug(e.target.value) }); }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition"
                placeholder="Production"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Slug</label>
              <input
                value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition"
                placeholder="production"
                required
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              />
            </div>
          </div>
          <div className="mt-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
            <input
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition"
              placeholder="Optional description"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="mt-4 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all"
          >
            {creating ? 'Creating...' : 'Create Organization'}
          </button>
        </form>
      )}

      {/* Organizations List */}
      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-slate-400"></div>
          <p className="mt-3 text-slate-600 text-sm">Loading...</p>
        </div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <p className="text-slate-600 mb-2">No organizations yet</p>
          <p className="text-slate-500 text-sm">Create your first organization to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs.map(org => (
            <Link
              key={org.id}
              to={`/orgs/${org.id}`}
              className="group block bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-slate-800 group-hover:text-slate-900">{org.name}</h2>
                  <p className="text-xs text-slate-500 mt-1 font-mono">{org.slug}</p>
                  {org.description && (
                    <p className="text-sm text-slate-600 mt-2">{org.description}</p>
                  )}
                </div>
                <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                  org.is_active 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-slate-100 text-slate-600'
                }`}>
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
