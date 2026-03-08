export default function Governance() {
  const workflows = [
    { id: 'w1', type: 'Access Request', requester: 'Jane Smith', target: 'AWS Production', status: 'Pending', sla: '12h left', approver: 'John Doe' },
    { id: 'w2', type: 'Role Change', requester: 'Alice Brown', target: 'Engineering Admin', status: 'Approved', sla: '2d left', approver: 'John Doe' },
    { id: 'w3', type: 'Certification', requester: 'System', target: 'Financial Data Access', status: 'In Progress', sla: '5d left', approver: 'Jane Smith' },
    { id: 'w4', type: 'Access Request', requester: 'Charlie Davis', target: 'GitHub Org', status: 'Rejected', sla: 'N/A', approver: 'Admin' },
  ];

  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight mb-8">Access Governance & Workflows</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-blue-600 p-8 rounded-2xl shadow-lg shadow-blue-500/20 text-white relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-2">Pending Approvals</p>
            <p className="text-4xl font-bold tracking-tight">12</p>
            <p className="text-sm text-blue-100 font-medium mt-3 italic opacity-90">"8 requests are nearing SLA deadline"</p>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500 rounded-full opacity-20 group-hover:scale-110 transition duration-500"></div>
        </div>
        <div className="bg-slate-900 p-8 rounded-2xl shadow-lg text-white relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Campaign Progress</p>
            <p className="text-4xl font-bold tracking-tight">68%</p>
            <div className="h-1.5 bg-slate-800 rounded-full mt-4 overflow-hidden border border-slate-700/50">
              <div className="h-full bg-blue-400 w-[68%] rounded-full shadow-[0_0_8px_rgba(96,165,250,0.5)]"></div>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-slate-800 rounded-full opacity-20 group-hover:scale-110 transition duration-500"></div>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Policy Health</p>
          <div className="flex items-end space-x-2">
            <p className="text-4xl font-bold text-slate-900">94</p>
            <span className="text-sm font-bold text-green-600 mb-1.5">/100</span>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-3 tracking-wide">6 active policy violations</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900">Active Workflows</h3>
          <div className="flex space-x-2">
            <button className="text-xs font-bold px-3 py-1.5 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50 transition uppercase tracking-tight">Filter</button>
            <button className="text-xs font-bold px-3 py-1.5 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50 transition uppercase tracking-tight">Sort</button>
          </div>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Requester</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Resource</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">SLA</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Approver</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {workflows.map((w) => (
              <tr key={w.id} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-slate-900">{w.type}</span>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-600">{w.requester}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-600 font-mono text-xs uppercase tracking-tight">{w.target}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-tight uppercase ${
                    w.status === 'Pending' ? 'bg-blue-100 text-blue-700' : 
                    w.status === 'Approved' ? 'bg-green-100 text-green-700' : 
                    w.status === 'Rejected' ? 'bg-red-100 text-red-700' : 
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {w.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-mono text-slate-500">{w.sla}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-600">{w.approver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
