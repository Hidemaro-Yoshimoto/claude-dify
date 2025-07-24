'use client'

import { 
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'

interface StatsCardsProps {
  stats?: {
    totalAnalyses: number
    successRate: number  
    avgScore: number
    totalCost: number
  }
  loading?: boolean
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="card-body">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const cards = [
    {
      name: 'Total Analyses',
      value: stats?.totalAnalyses || 0,
      icon: ChartBarIcon,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50'
    },
    {
      name: 'Success Rate',
      value: `${stats?.successRate || 0}%`,
      icon: CheckCircleIcon,
      color: 'text-success-600',
      bgColor: 'bg-success-50'
    },
    {
      name: 'Average Score',
      value: `${stats?.avgScore || 0}%`,
      icon: ClockIcon,
      color: 'text-warning-600',
      bgColor: 'bg-warning-50'
    },
    {
      name: 'Total Cost',
      value: `$${stats?.totalCost?.toFixed(2) || '0.00'}`,
      icon: CurrencyDollarIcon,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => (
        <div key={card.name} className="card card-hover">
          <div className="card-body">
            <div className="flex items-center">
              <div className={`${card.bgColor} rounded-md p-3`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{card.name}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}