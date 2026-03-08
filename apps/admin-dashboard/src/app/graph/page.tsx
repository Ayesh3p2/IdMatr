export default function IdentityGraph() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Identity Graph</h2>
          <p className="text-sm text-slate-500 mt-1">Visualizing relationships between User → Role → Permission → Application</p>
        </div>
        <div className="flex space-x-3">
          <select className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-medium">
            <option>Select User to Map</option>
            <option>John Doe</option>
            <option>Jane Smith</option>
          </select>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
            Generate Map
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden flex flex-col items-center justify-center border-dashed border-2 text-slate-400 group cursor-pointer hover:border-blue-400 transition duration-500">
        <div className="absolute inset-0 bg-slate-50 opacity-10 group-hover:opacity-20 transition duration-500" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        <div className="relative z-10 flex flex-col items-center animate-pulse group-hover:animate-none">
          <svg className="w-16 h-16 mb-4 text-slate-300 group-hover:text-blue-400 transition duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <span className="text-lg font-bold tracking-tight text-slate-500 group-hover:text-slate-900 transition duration-500">Interactive Identity Graph</span>
          <p className="text-sm mt-2 text-slate-400 font-medium group-hover:text-slate-500 transition duration-500">Select a target identity to visualize its privilege chain and lateral movement paths.</p>
        </div>
        
        {/* Legend */}
        <div className="absolute bottom-6 left-6 flex space-x-6 bg-slate-50/80 backdrop-blur-md p-4 rounded-xl border border-slate-200/50">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">User</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Role</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">App</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Critical Path</span>
          </div>
        </div>
      </div>
    </div>
  );
}
