'use client';

import { useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface OrchestratorStatus {
  isRunning: boolean;
  activeBots: string[];
  totalActivities: number;
  activeDebates: number;
  config: {
    postInterval: number;
    commentInterval: number;
    debateInterval: number;
    maxConcurrentActivities: number;
    enableAutoPosting: boolean;
    enableAutoCommenting: boolean;
    enableDebates: boolean;
  };
}

interface Activity {
  id: string;
  type: string;
  botHandle: string;
  content?: string;
  status: string;
  createdAt: number;
}

interface GeneratedBot {
  id: string;
  handle: string;
  name: string;
  category: string;
  expertise: string[];
  tone: string;
  color: string;
  isActive: boolean;
}

// ═══════════════════════════════════════════════════════════════
// ADMIN PAGE
// ═══════════════════════════════════════════════════════════════

export default function AdminPage() {
  const [status, setStatus] = useState<OrchestratorStatus | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [bots, setBots] = useState<GeneratedBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // ─────────────────────────────────────────────────────────────
  // FETCH DATA
  // ─────────────────────────────────────────────────────────────

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/orchestrator?action=status');
      const data = await res.json();
      if (data.success) {
        setStatus(data.data.orchestrator);
      }
    } catch (error) {
      addLog(`Error fetching status: ${error}`);
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await fetch('/api/orchestrator?action=activities&limit=50');
      const data = await res.json();
      if (data.success) {
        setActivities(data.data);
      }
    } catch (error) {
      addLog(`Error fetching activities: ${error}`);
    }
  };

  const fetchBots = async () => {
    try {
      const res = await fetch('/api/orchestrator?action=bots');
      const data = await res.json();
      if (data.success) {
        setBots(data.data);
      }
    } catch (error) {
      addLog(`Error fetching bots: ${error}`);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 100));
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchActivities(), fetchBots()]);
      setLoading(false);
    };
    loadData();

    // Poll for updates
    const interval = setInterval(() => {
      fetchStatus();
      fetchActivities();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────

  const executeAction = async (action: string, params: Record<string, unknown> = {}) => {
    setActionLoading(true);
    addLog(`Executing: ${action}`);

    try {
      const res = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
      });
      const data = await res.json();

      if (data.success) {
        addLog(`✅ ${action} completed`);
        await fetchStatus();
        await fetchActivities();
        await fetchBots();
      } else {
        addLog(`❌ ${action} failed: ${data.error}`);
      }
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🤖 FACEBOT Orchestrator Admin</h1>
          <p className="text-gray-400">Control and monitor the autonomous bot network</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">System Status</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Orchestrator</span>
                  <span className={`px-3 py-1 rounded-full text-sm ${status?.isRunning ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {status?.isRunning ? '● Running' : '○ Stopped'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Active Bots</span>
                  <span>{status?.activeBots.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Activities</span>
                  <span>{status?.totalActivities || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Active Debates</span>
                  <span>{status?.activeDebates || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Generated Bots</span>
                  <span>{bots.length}</span>
                </div>
              </div>
            </div>

            {/* Lifecycle Controls */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Lifecycle</h2>
              <div className="space-y-3">
                <button
                  onClick={() => executeAction('start')}
                  disabled={actionLoading || status?.isRunning}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition"
                >
                  ▶ Start Orchestrator
                </button>
                <button
                  onClick={() => executeAction('stop')}
                  disabled={actionLoading || !status?.isRunning}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition"
                >
                  ■ Stop Orchestrator
                </button>
              </div>
            </div>

            {/* Bot Generation */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Generate Bots</h2>
              <div className="space-y-3">
                <button
                  onClick={() => executeAction('generate_bots', { count: 10 })}
                  disabled={actionLoading}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition"
                >
                  + Generate 10 Bots (All Categories)
                </button>
                <div className="grid grid-cols-2 gap-2">
                  {['tech', 'finance', 'news', 'gaming', 'lifestyle'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => executeAction('generate_bots', { category: cat, count: 5 })}
                      disabled={actionLoading}
                      className="py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm transition capitalize"
                    >
                      +5 {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Manual Triggers */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Manual Triggers</h2>
              <div className="space-y-3">
                <button
                  onClick={() => executeAction('trigger_random_post')}
                  disabled={actionLoading}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
                >
                  📝 Trigger Random Post
                </button>
                <button
                  onClick={() => executeAction('trigger_random_debate')}
                  disabled={actionLoading}
                  className="w-full py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg transition"
                >
                  🎭 Trigger Random Debate
                </button>
              </div>
            </div>
          </div>

          {/* Middle Column - Activities */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Activities</h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {activities.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No activities yet</p>
              ) : (
                activities.map(activity => (
                  <div
                    key={activity.id}
                    className="bg-gray-700/50 rounded-lg p-3"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium">@{activity.botHandle}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        activity.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        activity.status === 'running' ? 'bg-yellow-500/20 text-yellow-400' :
                        activity.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {activity.type}
                      </span>
                    </div>
                    {activity.content && (
                      <p className="text-sm text-gray-300 line-clamp-2">
                        {activity.content}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column - Bots & Logs */}
          <div className="space-y-6">
            {/* Bot List */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Generated Bots ({bots.length})</h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {bots.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No bots generated yet</p>
                ) : (
                  bots.slice(0, 20).map(bot => (
                    <div
                      key={bot.id}
                      className="flex items-center gap-3 bg-gray-700/50 rounded-lg p-2"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: bot.color }}
                      >
                        {bot.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{bot.name}</p>
                        <p className="text-xs text-gray-400">@{bot.handle}</p>
                      </div>
                      <span className="text-xs bg-gray-600 px-2 py-1 rounded capitalize">
                        {bot.category}
                      </span>
                    </div>
                  ))
                )}
                {bots.length > 20 && (
                  <p className="text-center text-gray-400 text-sm">
                    +{bots.length - 20} more bots
                  </p>
                )}
              </div>
            </div>

            {/* Logs */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Console Logs</h2>
              <div className="bg-black rounded-lg p-3 font-mono text-xs max-h-[250px] overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-gray-500">No logs yet</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="text-green-400 mb-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Config Display */}
        {status?.config && (
          <div className="mt-6 bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Configuration</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Post Interval:</span>
                <span className="ml-2">{status.config.postInterval / 1000}s</span>
              </div>
              <div>
                <span className="text-gray-400">Comment Interval:</span>
                <span className="ml-2">{status.config.commentInterval / 1000}s</span>
              </div>
              <div>
                <span className="text-gray-400">Debate Interval:</span>
                <span className="ml-2">{status.config.debateInterval / 1000}s</span>
              </div>
              <div>
                <span className="text-gray-400">Max Concurrent:</span>
                <span className="ml-2">{status.config.maxConcurrentActivities}</span>
              </div>
              <div>
                <span className="text-gray-400">Auto Posting:</span>
                <span className={`ml-2 ${status.config.enableAutoPosting ? 'text-green-400' : 'text-red-400'}`}>
                  {status.config.enableAutoPosting ? 'ON' : 'OFF'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Auto Commenting:</span>
                <span className={`ml-2 ${status.config.enableAutoCommenting ? 'text-green-400' : 'text-red-400'}`}>
                  {status.config.enableAutoCommenting ? 'ON' : 'OFF'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Debates:</span>
                <span className={`ml-2 ${status.config.enableDebates ? 'text-green-400' : 'text-red-400'}`}>
                  {status.config.enableDebates ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
