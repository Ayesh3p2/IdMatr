'use client';

import { useEffect, useState } from 'react';
import { getIdentities, getApplications, getRiskEvents, getWorkflows } from '@/lib/api';

interface DashboardStats {
  identities: string;
  apps: string;
  risk: string;
  approvals: string;
  shadowIt: number;
  highRiskUsers: number;
}

interface Alert {
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  time: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    identities: '—',
    apps: '—',
    risk: '—',
    approvals: '—',
    shadowIt: 0,
    highRiskUsers: 0,
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [identitiesData, appsData, riskData, workflowsData] = await Promise.allSettled([
          getIdentities() as Promise<any[]>,
          getApplications() as Promise<any[]>,
          getRiskEvents() as Promise<any[]>,
          getWorkflows() as Promise<any[]>,
        ]);

        const identities = identitiesData.status === 'fulfilled' ? identitiesData.value : [];
        const apps = appsData.status === 'fulfilled' ? appsData.value : [];
        const riskEvents = riskData.status === 'fulfilled' ? riskData.value : [];
        const workflows = workflowsData.status === 'fulfilled' ? workflowsData.value : [];

        const avgRisk = identities.length > 0
          ? Math.round(identities.reduce((sum: number, u: any) => sum + (u.riskScore || 0), 0) / identities.length)
          : 0;

        const pendingApprovals = workflows.filter((w: any) => w.status === 'pending').length;
        const shadowItApps = apps.filter((a: any) => a.status === 'shadow-it').length;
        const highRisk = identities.filter((u: any) => u.riskScore > 70).length;

        setStats({
          identities: identities.length.toLocaleString(),
          apps: apps.length.toLocaleString(),
          risk: avgRisk.toString() || '—',
          approvals: pendingApprovals.toString(),
          shadowIt: shadowItApps,
          highRiskUsers: highRisk,
        });

        // Build alerts from real risk events
        const recentAlerts: Alert[] = riskEvents.slice(0, 5).map((e: any) => ({
          severity: e.severity === 'critical' ? 'critical' : e.severity === 'high' ? 'high' : 'medium',
          title: e.eventType || 'Risk Event',
          description: e.description || `${e.userId} triggered a risk event`,
          time: e.detectedAt ? new Date(e.detectedAt).toLocaleTimeString() : 'recently',
        }));

        setAlerts(recentAlerts.length > 0 ? recentAlerts : [
          { severity: 'critical', title: 'Privilege Escalation Detected', description: 'User John Doe gained Admin on Google Workspace', time: '2m ago' },
          { severity: 'high', title: 'Shadow IT Detected', description: '15 users using Notion without SSO', time: '1h ago' },
        ]);

        setApiStatus('online');
      } catch {
        // API is offline, use demo data
        setStats({ identities: '1,248', apps: '154', risk: '42', approvals: '24', shadowIt: 8, highRiskUsers: 12 });
        setAlerts([
          { severity: 'critical', title: 'Privilege Escalation Detected', description: 'User John Doe gained Admin on Google Workspace', time: '2m ago' },
          { severity: 'high', title: 'Shadow IT Detected', description: '15 users using Notion without SSO', time: '1h ago' },
          { severity: 'medium', title: 'Dormant Account Alert', description: 'Bob Johnson account inactive for 120 days', time: '3h ago' },
        ]);
        setApiStatus('offline');
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const severityStyle: Record<string, string> = {
    critical: 'bg-red-50 border-red-100',
    high: 'bg-orange-50 border-orange-100',
    medium: 'bg-yellow-50 border-yellow-100',
  };

  const dotStyle: Record<string, string> = {
    critical: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
  };

  const textStyle: Record<string, { title: string; time: string }> = {
    critical: { title: 'text-red-900', time: 'text-red-600' },
    high: { title: 'text-orange-900', time: 'text-orange-600' },
    medium: { title: 'text-yellow-900', time: 'text-yellow-600' },
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Executive Dashboard</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-green-500' : apiStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">
            {apiStatus === 'online' ? 'Live Data' : apiStatus === 'offline' ? 'Demo Mode' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Identities</p>
          <p className={`text-3xl font-bold mt-2 ${loading ? 'animate-pulse text-slate-300' : ''}`}>{stats.identities}</p>
          <p className="text-xs text-slate-500 font-semibold mt-1">{stats.highRiskUsers} high-risk users</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Discovered Apps</p>
          <p className={`text-3xl font-bold mt-2 ${loading ? 'animate-pulse text-slate-300' : ''}`}>{stats.apps}</p>
          <p className="text-xs text-red-600 font-semibold mt-1">↑ {stats.shadowIt} shadow IT detected</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Risk Score (Avg)</p>
          <p className={`text-3xl font-bold mt-2 ${loading ? 'animate-pulse text-slate-300' : ''}`}>{stats.risk}</p>
          <p className="text-xs text-yellow-600 font-semibold mt-1">
            {parseInt(stats.risk) > 70 ? 'High Risk' : parseInt(stats.risk) > 40 ? 'Medium Risk' : 'Low Risk'}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Pending Approvals</p>
          <p className={`text-3xl font-bold mt-2 ${loading ? 'animate-pulse text-slate-300' : ''}`}>{stats.approvals}</p>
          <p className="text-xs text-slate-500 mt-1">Requires action</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Risk Breakdown */}
        <div className="bg-slate-900 p-8 rounded-xl shadow-xl text-white">
          <h3 className="text-lg font-bold mb-6 text-blue-400">Risk Breakdown</h3>
          <div className="space-y-6">
            {[
              { label: 'Excessive Privileges', value: 65, color: 'bg-orange-400', shadow: 'shadow-[0_0_8px_rgba(251,146,60,0.4)]' },
              { label: 'Dormant Accounts', value: 24, color: 'bg-yellow-400', shadow: 'shadow-[0_0_8px_rgba(250,204,21,0.4)]' },
              { label: 'Policy Violations', value: 12, color: 'bg-red-400', shadow: 'shadow-[0_0_8px_rgba(248,113,113,0.4)]' },
              { label: 'Shadow IT Usage', value: 38, color: 'bg-purple-400', shadow: 'shadow-[0_0_8px_rgba(192,132,252,0.4)]' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400 font-medium">{item.label}</span>
                  <span className={`font-bold ${item.color.replace('bg-', 'text-')}`}>{item.value}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full ${item.shadow}`}
                    style={{ width: `${item.value}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 p-5 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2">AI Insight</p>
            <p className="text-sm text-slate-200 leading-relaxed italic">
              "Privileged users in Engineering have 3x more access than required. 15% of admin accounts lack MFA."
            </p>
          </div>
        </div>

        {/* Security Alerts */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold mb-6">Security Alerts</h3>
          <div className="space-y-3">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="animate-pulse h-16 bg-slate-100 rounded-lg"></div>
              ))
            ) : alerts.map((alert, i) => (
              <div key={i} className={`flex items-center p-4 rounded-lg border ${severityStyle[alert.severity]}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mr-4 ${dotStyle[alert.severity]}`}></div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${textStyle[alert.severity].title}`}>{alert.title}</p>
                  <p className="text-xs text-slate-600 truncate">{alert.description}</p>
                </div>
                <span className={`text-xs font-medium ml-3 flex-shrink-0 ${textStyle[alert.severity].time}`}>{alert.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
