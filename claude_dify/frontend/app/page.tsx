'use client'

import { useState, useEffect } from 'react'
import { useQuery } from 'react-query'
import { 
  ChartBarIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import { AnalysisForm } from '@/components/AnalysisForm'
import { StatsCards } from '@/components/StatsCards'
import { RecentAnalyses } from '@/components/RecentAnalyses'
import { QuickActions } from '@/components/QuickActions'

interface DashboardStats {
  totalAnalyses: number
  successRate: number
  avgScore: number
  totalCost: number
  recentAnalyses: any[]
}

export default function Dashboard() {
  const [showAnalysisForm, setShowAnalysisForm] = useState(false)

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>(
    'dashboard-stats',
    async () => {
      // In a real app, this would fetch from your API
      // For now, return mock data
      return {
        totalAnalyses: 142,
        successRate: 94.2,
        avgScore: 73.5,
        totalCost: 5.96,
        recentAnalyses: [
          {
            id: '1',
            url: 'https://example.com',
            score: 78,
            timestamp: new Date().toISOString(),
            status: 'completed'
          },
          {
            id: '2', 
            url: 'https://test-site.com',
            score: 65,
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            status: 'completed'
          }
        ]
      }
    },
    {
      refetchInterval: 30000 // Refresh every 30 seconds
    }
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Website Analysis Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Monitor and analyze website performance, accessibility, and SEO
            </p>
          </div>
          <button
            onClick={() => setShowAnalysisForm(true)}
            className="btn-primary"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Analysis
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} loading={statsLoading} />

      {/* Quick Actions */}
      <QuickActions onAnalyze={() => setShowAnalysisForm(true)} />

      {/* Recent Analyses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentAnalyses analyses={stats?.recentAnalyses || []} />
        
        {/* System Status */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">System Status</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-success-500 mr-2" />
                  <span className="text-sm text-gray-700">Cloud Run API</span>
                </div>
                <span className="badge-success">Healthy</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-success-500 mr-2" />
                  <span className="text-sm text-gray-700">Playwright Service</span>
                </div>
                <span className="badge-success">Operational</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-success-500 mr-2" />
                  <span className="text-sm text-gray-700">GCS Storage</span>
                </div>
                <span className="badge-success">Available</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="h-5 w-5 text-warning-500 mr-2" />
                  <span className="text-sm text-gray-700">LLM Services</span>
                </div>
                <span className="badge-warning">Rate Limited</span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                <p>Last updated: {new Date().toLocaleTimeString()}</p>
                <p>Average response time: 2.3s</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Tracking */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Cost Tracking</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">
                ${stats?.totalCost?.toFixed(2) || '0.00'}
              </div>
              <div className="text-sm text-gray-500">Total Spent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success-600">$0.042</div>
              <div className="text-sm text-gray-500">Cost per Analysis</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-warning-600">
                ${((30 - new Date().getDate()) * 0.5).toFixed(2)}
              </div>
              <div className="text-sm text-gray-500">Remaining Budget</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {Math.round(((30 - new Date().getDate()) * 0.5) / 0.042)}
              </div>
              <div className="text-sm text-gray-500">Remaining Analyses</div>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Form Modal */}
      {showAnalysisForm && (
        <AnalysisForm onClose={() => setShowAnalysisForm(false)} />
      )}
    </div>
  )
}