import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import type { Organization } from '../api/types';

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
        >
          {showForm ? 'Cancel' : '+ New Organization'}
        </button>
      </div>

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
