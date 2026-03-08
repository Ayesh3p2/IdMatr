export default function Identities() {
  const users = [
    { name: 'John Doe', email: 'john.doe@idmatr.com', status: 'Active', risk: 85, apps: 12, lastLogin: '10m ago' },
    { name: 'Jane Smith', email: 'jane.smith@idmatr.com', status: 'Active', risk: 45, apps: 8, lastLogin: '2h ago' },
    { name: 'Bob Johnson', email: 'bob.johnson@idmatr.com', status: 'Suspended', risk: 10, apps: 0, lastLogin: '15d ago' },
    { name: 'Alice Brown', email: 'alice.brown@idmatr.com', status: 'Active', risk: 62, apps: 15, lastLogin: '1h ago' },
    { name: 'Charlie Davis', email: 'charlie.davis@idmatr.com', status: 'Inactive', risk: 30, apps: 5, lastLogin: '30d ago' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Identities & Access</h2>
        <div className="flex space-x-3">
          <input 
            type="text" 
            placeholder="Search identities..." 
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <button className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition">
            Export Report
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Score</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Apps Connected</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Activity</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.map((user) => (
              <tr key={user.email} className="hover:bg-slate-50 transition group">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 mr-3">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500 font-mono tracking-tight uppercase">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.status === 'Active' ? 'bg-green-100 text-green-700' : 
                    user.status === 'Suspended' ? 'bg-red-100 text-red-700' : 
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono font-bold text-slate-900">
                  <span className={`${
                    user.risk > 70 ? 'text-red-600' : 
                    user.risk > 40 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {user.risk}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600 font-medium">{user.apps}</td>
                <td className="px-6 py-4 text-slate-400 text-xs font-medium">{user.lastLogin}</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-xs font-bold text-blue-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition hover:underline">
                    Manage Access
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
