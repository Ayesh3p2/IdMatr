'use client';

import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    identities: '...',
    apps: '...',
    risk: '...',
    approvals: '...'
  });

  useEffect(() => {
    // In a real app, this would fetch from the API Gateway
    // fetch('http://localhost:3001/api/identities').then(...)
    setTimeout(() => {
      setStats({
        identities: '1,248',
        apps: '154',
        risk: '42',
        approvals: '24'
      });
    }, 1000);
  }, []);

  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight mb-8">Executive Dashboard</h2>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Identities</p>
          <p className="text-3xl font-bold mt-2">{stats.identities}</p>
          <p className="text-xs text-green-600 font-semibold mt-1">↑ 12% from last month</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Discovered Apps</p>
          <p className="text-3xl font-bold mt-2">{stats.apps}</p>
          <p className="text-xs text-red-600 font-semibold mt-1">↑ 8 shadow IT detected</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Risk Score (Avg)</p>
          <p className="text-3xl font-bold mt-2">{stats.risk}</p>
          <p className="text-xs text-yellow-600 font-semibold mt-1">Medium Risk</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Pending Approvals</p>
          <p className="text-3xl font-bold mt-2">{stats.approvals}</p>
          <p className="text-xs text-slate-500 mt-1">12 overdue</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Risk Heatmap Placeholder */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 h-96 flex flex-col items-center justify-center text-slate-400 border-dashed border-2">
          <span className="text-lg font-medium">Risk Heatmap Visualization</span>
          <p className="text-sm">Mapping user privileges vs. behavior</p>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 h-96">
          <h3 className="text-lg font-bold mb-6">Critical Security Alerts</h3>
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-red-50 rounded-lg border border-red-100">
              <div className="w-2 h-2 rounded-full bg-red-500 mr-4"></div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-900">Privilege Escalation Detected</p>
                <p className="text-xs text-red-700">User John Doe gained Admin on Google Workspace</p>
              </div>
              <span className="text-xs font-medium text-red-600">2m ago</span>
            </div>
            <div className="flex items-center p-4 bg-yellow-50 rounded-lg border border-yellow-100">
              <div className="w-2 h-2 rounded-full bg-yellow-500 mr-4"></div>
              <div className="flex-1">
                <p className="text-sm font-bold text-yellow-900">Shadow IT Detected</p>
                <p className="text-xs text-yellow-700">15 users using Notion without SSO</p>
              </div>
              <span className="text-xs font-medium text-yellow-600">1h ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
