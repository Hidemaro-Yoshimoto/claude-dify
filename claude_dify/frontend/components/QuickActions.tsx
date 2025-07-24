'use client'

import {
  GlobeAltIcon,
  DocumentTextIcon,
  ChartBarIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'

interface QuickActionsProps {
  onAnalyze: () => void
}

export function QuickActions({ onAnalyze }: QuickActionsProps) {
  const actions = [
    {
      name: 'Single URL Analysis',
      description: 'Analyze a single website URL',
      icon: GlobeAltIcon,
      action: onAnalyze,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50 hover:bg-primary-100'
    },
    {
      name: 'Batch Analysis',
      description: 'Upload CSV file with multiple URLs',
      icon: DocumentTextIcon,
      action: () => console.log('Batch analysis'),
      color: 'text-success-600',
      bgColor: 'bg-success-50 hover:bg-success-100'
    },
    {
      name: 'View Reports',
      description: 'Browse generated analysis reports',
      icon: ChartBarIcon,
      action: () => console.log('View reports'),
      color: 'text-warning-600',
      bgColor: 'bg-warning-50 hover:bg-warning-100'
    },
    {
      name: 'Settings',
      description: 'Configure analysis parameters',
      icon: Cog6ToothIcon,
      action: () => console.log('Settings'),
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 hover:bg-gray-100'
    }
  ]

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {actions.map((action) => (
            <button
              key={action.name}
              onClick={action.action}
              className={`${action.bgColor} border border-transparent rounded-lg p-4 text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
            >
              <div className="flex items-center">
                <action.icon className={`h-6 w-6 ${action.color} mr-3`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {action.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {action.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}