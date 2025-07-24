'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useMutation } from 'react-query' 
import toast from 'react-hot-toast'

interface AnalysisFormProps {
  onClose: () => void
}

interface FormData {
  url: string
  viewports: string[]
  timeout: number
  waitFor?: string
}

export function AnalysisForm({ onClose }: AnalysisFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<FormData>({
    defaultValues: {
      url: '',
      viewports: ['mobile', 'desktop'],
      timeout: 30000,
      waitFor: ''
    }
  })

  const analysisMutation = useMutation(
    async (data: FormData) => {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: data.url,
          viewports: data.viewports.map(name => {
            const viewportConfig = {
              mobile: { name: 'mobile', width: 375, height: 667 },
              tablet: { name: 'tablet', width: 768, height: 1024 },
              desktop: { name: 'desktop', width: 1920, height: 1080 },
              '4k': { name: '4k', width: 3840, height: 2160 }
            }
            return viewportConfig[name as keyof typeof viewportConfig]
          }),
          options: {
            timeout: data.timeout,
            waitFor: data.waitFor || undefined,
            generateReport: true
          }
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Analysis failed')
      }

      return response.json()
    },
    {
      onSuccess: (data) => {
        toast.success('Analysis completed successfully!')
        console.log('Analysis result:', data)
        onClose()
        // Here you could redirect to the results page or update the dashboard
      },
      onError: (error: Error) => {
        toast.error(`Analysis failed: ${error.message}`)
      }
    }
  )

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      await analysisMutation.mutateAsync(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  New Website Analysis
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* URL Input */}
                <div>
                  <label htmlFor="url" className="label">
                    Website URL
                  </label>
                  <input
                    type="url"
                    id="url"
                    className="input"
                    placeholder="https://example.com"
                    {...register('url', { 
                      required: 'URL is required',
                      pattern: {
                        value: /^https?:\\/\\/.+/,
                        message: 'Please enter a valid URL starting with http:// or https://'
                      }
                    })}
                  />
                  {errors.url && (
                    <p className="mt-1 text-sm text-danger-600">{errors.url.message}</p>
                  )}
                </div>

                {/* Viewport Selection */}
                <div>
                  <label className="label">Screenshot Viewports</label>
                  <div className="space-y-2">
                    {[
                      { id: 'mobile', label: 'Mobile (375×667)', value: 'mobile' },
                      { id: 'tablet', label: 'Tablet (768×1024)', value: 'tablet' },
                      { id: 'desktop', label: 'Desktop (1920×1080)', value: 'desktop' },
                      { id: '4k', label: '4K (3840×2160)', value: '4k' }
                    ].map((viewport) => (
                      <label key={viewport.id} className="flex items-center">
                        <input
                          type="checkbox"
                          value={viewport.value}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          {...register('viewports')}
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          {viewport.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Advanced Options */}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Advanced Options
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="timeout" className="label">
                        Timeout (milliseconds)
                      </label>
                      <select
                        id="timeout"
                        className="input"
                        {...register('timeout', { valueAsNumber: true })}
                      >
                        <option value={15000}>15 seconds</option>
                        <option value={30000}>30 seconds</option>
                        <option value={60000}>60 seconds</option>
                        <option value={120000}>2 minutes</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="waitFor" className="label">
                        Wait for Element (CSS Selector)
                      </label>
                      <input
                        type="text"
                        id="waitFor"
                        className="input"
                        placeholder=".main-content, #app"
                        {...register('waitFor')}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Optional: Wait for a specific element to load before analysis
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cost Estimate */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Estimated Cost:</span>
                    <span className="font-medium text-gray-900">$0.042</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Includes Playwright analysis + AI evaluation
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full sm:w-auto sm:ml-3"
              >
                {isSubmitting ? (
                  <>
                    <div className="loading-spinner mr-2 h-4 w-4" />
                    Analyzing...
                  </>
                ) : (
                  'Start Analysis'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary w-full sm:w-auto mt-3 sm:mt-0"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}