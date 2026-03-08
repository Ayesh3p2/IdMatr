export default function Applications() {
  const apps = [
    { name: 'Google Workspace', users: 150, admins: 5, privilege: 'High', risk: 25, status: 'Managed' },
    { name: 'Slack', users: 140, admins: 3, privilege: 'Medium', risk: 15, status: 'Managed' },
    { name: 'GitHub', users: 50, admins: 10, privilege: 'Critical', risk: 45, status: 'Managed' },
    { name: 'Notion', users: 20, admins: 2, privilege: 'Low', risk: 60, status: 'Shadow IT' },
    { name: 'Dropbox', users: 5, admins: 1, privilege: 'Low', risk: 75, status: 'Shadow IT' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Application Discovery</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
          Run Discovery Scan
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Application</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Users</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Admins</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Privilege Level</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Score</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {apps.map((app) => (
              <tr key={app.name} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4 font-medium text-slate-900">{app.name}</td>
                <td className="px-6 py-4 text-slate-600">{app.users}</td>
                <td className="px-6 py-4 text-slate-600">{app.admins}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    app.privilege === 'Critical' ? 'bg-red-100 text-red-700' : 
                    app.privilege === 'High' ? 'bg-orange-100 text-orange-700' : 
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {app.privilege}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono font-bold text-slate-900">{app.risk}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    app.status === 'Shadow IT' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {app.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
