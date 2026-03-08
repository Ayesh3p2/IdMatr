export default function AuditLogs() {
  const logs = [
    { id: '1', timestamp: '2026-03-08 10:24:00', actor: 'John Doe', action: 'Login', target: 'IDMatr Portal', status: 'Success', ip: '192.168.1.1' },
    { id: '2', timestamp: '2026-03-08 11:15:32', actor: 'Jane Smith', action: 'Access Request', target: 'AWS Production', status: 'Success', ip: '192.168.1.5' },
    { id: '3', timestamp: '2026-03-08 12:05:10', actor: 'System', action: 'App Discovery', target: 'Slack', status: 'Failure', ip: 'Internal' },
    { id: '4', timestamp: '2026-03-08 14:45:22', actor: 'Admin', action: 'Policy Update', target: 'RBAC Global', status: 'Success', ip: '10.0.0.1' },
  ];

  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight mb-8">System Audit Logs</h2>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Timestamp</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actor</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Target</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4 text-sm font-mono text-slate-500">{log.timestamp}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{log.actor}</td>
                <td className="px-6 py-4 text-sm font-bold text-blue-600">{log.action}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{log.target}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    log.status === 'Success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {log.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-400 font-mono">{log.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
