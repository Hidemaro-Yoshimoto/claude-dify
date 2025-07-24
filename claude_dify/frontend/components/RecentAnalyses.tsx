'use client'

import { formatDistanceToNow } from 'date-fns'
import { ExternalLinkIcon } from '@heroicons/react/24/outline'

interface Analysis {
  id: string
  url: string
  score: number
  timestamp: string
  status: 'completed' | 'processing' | 'failed'
}

interface RecentAnalysesProps {
  analyses: Analysis[]
}

export function RecentAnalyses({ analyses }: RecentAnalysesProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success-600 bg-success-50'
    if (score >= 60) return 'text-warning-600 bg-warning-50'
    return 'text-danger-600 bg-danger-50'
  }

  const getStatusBadge = (status: Analysis['status']) => {
    switch (status) {
      case 'completed':
        return <span className="badge-success">Completed</span>
      case 'processing':
        return <span className="badge-info">Processing</span>
      case 'failed':
        return <span className="badge-danger">Failed</span>
      default:
        return <span className="badge-info">Unknown</span>
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-medium text-gray-900">Recent Analyses</h3>
      </div>
      <div className="card-body p-0">
        <div className="flow-root">
          <ul className="divide-y divide-gray-200">
            {analyses.length === 0 ? (
              <li className="px-6 py-8 text-center text-gray-500">
                <p>No analyses yet</p>
                <p className="text-sm">Start by analyzing your first website</p>
              </li>
            ) : (
              analyses.map((analysis) => (
                <li key={analysis.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className={`inline-flex items-center justify-center h-10 w-10 rounded-full ${getScoreColor(analysis.score)}`}>
                            <span className="text-sm font-medium">
                              {analysis.score}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {new URL(analysis.url).hostname}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {analysis.url}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(analysis.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(analysis.status)}
                      <button className="text-gray-400 hover:text-gray-600">
                        <ExternalLinkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      {analyses.length > 0 && (
        <div className="card-footer">
          <button className="w-full text-center text-sm text-primary-600 hover:text-primary-700 font-medium">
            View All Analyses
          </button>
        </div>
      )}
    </div>
  )
}