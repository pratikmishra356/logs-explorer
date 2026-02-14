import { Routes, Route, Link } from 'react-router-dom';
import OrganizationsPage from './pages/OrganizationsPage';
import OrgDetailPage from './pages/OrgDetailPage';
import SearchPage from './pages/SearchPage';

function App() {
  return (
    <div className="min-h-screen bg-white">

      {/* Top nav */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-14 gap-8">
          <Link to="/" className="text-lg font-semibold text-slate-800">
            Log Explorer
          </Link>
          <Link 
            to="/" 
            className="text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            Organizations
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<OrganizationsPage />} />
          <Route path="/orgs/:orgId" element={<OrgDetailPage />} />
          <Route path="/orgs/:orgId/search" element={<SearchPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
