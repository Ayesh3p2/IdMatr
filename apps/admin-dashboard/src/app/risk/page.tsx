export default function Risk() {
  const events = [
    { type: 'Excessive Privilege', severity: 'High', description: 'User John Doe has admin on 5 SaaS apps but only uses 1', target: 'John Doe', timestamp: '2h ago' },
    { type: 'Dormant Account', severity: 'Medium', description: 'Jane Smith account not used for 120 days', target: 'Jane Smith', timestamp: '5h ago' },
    { type: 'Abnormal Behavior', severity: 'Critical', description: 'Multiple login attempts from new location (Moscow)', target: 'Bob Johnson', timestamp: '12h ago' },
    { type: 'Privilege Escalation', severity: 'High', description: 'Alice Brown granted self-approval permission', target: 'Alice Brown', timestamp: '1d ago' },
  ];

  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight mb-8">Identity Risk Engine</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <div className="lg:col-span-2 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold mb-6">Active Risk Events</h3>
          <div className="space-y-6">
            {events.map((event, i) => (
              <div key={i} className="flex items-start p-5 bg-slate-50 rounded-xl border border-slate-100 group hover:border-blue-200 transition">
                <div className={`w-3 h-3 rounded-full mt-1.5 mr-5 flex-shrink-0 ${
                  event.severity === 'Critical' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
                  event.severity === 'High' ? 'bg-orange-500' : 'bg-yellow-500'
                }`}></div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{event.type}</p>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-tight">{event.target}</p>
                    </div>
                    <span className="text-xs font-medium text-slate-400">{event.timestamp}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{event.description}</p>
                </div>
                <button className="ml-6 text-xs font-bold text-blue-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition px-3 py-1 bg-white rounded-md border border-slate-200 hover:bg-slate-50">
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-xl shadow-xl text-white">
          <h3 className="text-lg font-bold mb-6 text-blue-400">Risk Analytics</h3>
          <div className="space-y-8">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400 font-medium">Excessive Privileges</span>
                <span className="font-bold text-orange-400">65%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400 w-[65%] rounded-full shadow-[0_0_8px_rgba(251,146,60,0.4)]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400 font-medium">Dormant Accounts</span>
                <span className="font-bold text-yellow-400">24%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 w-[24%] rounded-full shadow-[0_0_8px_rgba(250,204,21,0.4)]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400 font-medium">Policy Violations</span>
                <span className="font-bold text-red-400">12%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-400 w-[12%] rounded-full shadow-[0_0_8px_rgba(248,113,113,0.4)]"></div>
              </div>
            </div>
          </div>

          <div className="mt-12 p-6 bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3">Insights</p>
            <p className="text-sm text-slate-200 leading-relaxed italic">
              "Privileged users in Engineering have 3x more access than required for daily tasks. 15% of admin accounts lack MFA."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
