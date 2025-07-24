const logger = require('../utils/logger');
const gcsService = require('./gcsService');
const { v4: uuidv4 } = require('uuid');

class ReportService {
  async generateReport(analysisResult) {
    try {
      logger.info(`📄 Generating HTML report for ${analysisResult.url}`);
      
      const html = await this.generateHTMLReport(analysisResult);
      const filename = `reports/${analysisResult.analysisId}-report.html`;
      
      const reportUrl = await gcsService.uploadReport(html, filename, 'text/html');
      
      logger.info(`✅ Report generated successfully: ${reportUrl}`);
      return reportUrl;
    } catch (error) {
      logger.error('Report generation failed:', error);
      throw error;
    }
  }

  async generateHTMLReport(data) {
    const { url, analysis, screenshots, performance, timestamp, processingTime } = data;
    
    // Calculate category scores
    const categoryScores = {};
    Object.keys(analysis.summary.categories).forEach(category => {
      const categoryItems = analysis.items.filter(item => item.category === category);
      const passed = categoryItems.filter(item => item.status === 'pass').length;
      categoryScores[category] = categoryItems.length > 0 ? Math.round((passed / categoryItems.length) * 100) : 0;
    });

    const html = `
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web Analysis Report - ${new URL(url).hostname}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .card-hover:hover { transform: translateY(-2px); transition: all 0.3s ease; }
        .status-pass { @apply bg-green-100 text-green-800 border-green-200; }
        .status-fail { @apply bg-red-100 text-red-800 border-red-200; }
        .status-warning { @apply bg-yellow-100 text-yellow-800 border-yellow-200; }
        .status-info { @apply bg-blue-100 text-blue-800 border-blue-200; }
        .status-error { @apply bg-gray-100 text-gray-800 border-gray-200; }
    </style>
</head>
<body class="bg-gray-50 font-sans">
    <!-- Header -->
    <header class="gradient-bg text-white py-8">
        <div class="container mx-auto px-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold mb-2">Web Analysis Report</h1>
                    <p class="text-blue-100">${url}</p>
                </div>
                <div class="text-right">
                    <div class="text-4xl font-bold">${analysis.summary.score}%</div>
                    <div class="text-blue-100">Overall Score</div>
                </div>
            </div>
        </div>
    </header>

    <!-- Summary Cards -->
    <section class="py-8">
        <div class="container mx-auto px-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                ${Object.entries(categoryScores).map(([category, score]) => `
                <div class="bg-white rounded-lg shadow-md p-6 card-hover">
                    <h3 class="text-lg font-semibold text-gray-800 capitalize mb-2">${category}</h3>
                    <div class="text-3xl font-bold ${score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'}">${score}%</div>
                    <div class="text-sm text-gray-600">${analysis.items.filter(item => item.category === category).length} items</div>
                </div>
                `).join('')}
            </div>

            <!-- Performance Metrics -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 class="text-2xl font-bold text-gray-800 mb-4">Performance Metrics</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-blue-600">${performance.loadTime}ms</div>
                        <div class="text-sm text-gray-600">Load Time</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-green-600">${performance.domElements}</div>
                        <div class="text-sm text-gray-600">DOM Elements</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-purple-600">${performance.networkRequests}</div>
                        <div class="text-sm text-gray-600">Network Requests</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-indigo-600">${Math.round(performance.documentSize / 1024)}KB</div>
                        <div class="text-sm text-gray-600">Document Size</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-orange-600">${performance.firstContentfulPaint ? Math.round(performance.firstContentfulPaint) + 'ms' : 'N/A'}</div>
                        <div class="text-sm text-gray-600">First Paint</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-pink-600">${processingTime}ms</div>
                        <div class="text-sm text-gray-600">Analysis Time</div>
                    </div>
                </div>
            </div>

            <!-- Screenshots -->
            ${screenshots.length > 0 ? `
            <div class="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 class="text-2xl font-bold text-gray-800 mb-4">Screenshots</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    ${screenshots.map(screenshot => `
                    <div class="border rounded-lg overflow-hidden">
                        <div class="bg-gray-100 px-4 py-2">
                            <h3 class="font-semibold capitalize">${screenshot.viewport}</h3>
                            <p class="text-sm text-gray-600">${screenshot.width}×${screenshot.height}</p>
                        </div>
                        ${screenshot.gcs_url ? `
                        <div class="aspect-video bg-gray-200 flex items-center justify-center">
                            <p class="text-gray-500 text-sm">Screenshot: ${Math.round(screenshot.size_bytes / 1024)}KB</p>
                        </div>
                        ` : `
                        <div class="aspect-video bg-red-100 flex items-center justify-center">
                            <p class="text-red-600 text-sm">Screenshot failed</p>
                        </div>
                        `}
                    </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Detailed Results -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-2xl font-bold text-gray-800 mb-6">Detailed Analysis Results</h2>
                
                ${Object.entries(categoryScores).map(([category, score]) => `
                <div class="mb-8">
                    <h3 class="text-xl font-semibold text-gray-800 capitalize mb-4 flex items-center">
                        <span class="w-4 h-4 rounded-full mr-3 ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}"></span>
                        ${category} (${score}%)
                    </h3>
                    <div class="space-y-3">
                        ${analysis.items.filter(item => item.category === category).map(item => `
                        <div class="border rounded-lg p-4 ${
                            item.status === 'pass' ? 'bg-green-50 border-green-200' :
                            item.status === 'fail' ? 'bg-red-50 border-red-200' :
                            item.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                            item.status === 'info' ? 'bg-blue-50 border-blue-200' :
                            'bg-gray-50 border-gray-200'
                        }">
                            <div class="flex items-start justify-between">
                                <div class="flex-1">
                                    <h4 class="font-semibold text-gray-800">${item.name}</h4>
                                    <p class="text-sm text-gray-600 mt-1">${item.description}</p>
                                    <p class="text-sm mt-2">${item.details}</p>
                                    ${item.recommendations && item.recommendations.length > 0 ? `
                                    <div class="mt-3">
                                        <p class="text-sm font-medium text-gray-700">Recommendations:</p>
                                        <ul class="list-disc list-inside text-sm text-gray-600 mt-1">
                                            ${item.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                                        </ul>
                                    </div>
                                    ` : ''}
                                </div>
                                <span class="ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    item.status === 'pass' ? 'bg-green-100 text-green-800' :
                                    item.status === 'fail' ? 'bg-red-100 text-red-800' :
                                    item.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                    item.status === 'info' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                }">
                                    ${item.status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        `).join('')}
                    </div>
                </div>
                `).join('')}
            </div>

            <!-- Report Footer -->
            <div class="mt-8 text-center text-gray-500 text-sm">
                <p>Report generated on ${new Date(timestamp).toLocaleString()}</p>
                <p>Analysis completed in ${processingTime}ms</p>
                <p class="mt-2">🤖 Generated with <a href="https://claude.ai/code" class="text-blue-600 hover:underline">Claude Code</a></p>
            </div>
        </div>
    </section>

    <!-- Chart Script -->
    <script>
        // Add interactive chart if needed
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Web Analysis Report loaded');
            
            // Add smooth scrolling for any anchor links
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function (e) {
                    e.preventDefault();
                    document.querySelector(this.getAttribute('href')).scrollIntoView({
                        behavior: 'smooth'
                    });
                });
            });
        });
    </script>
</body>
</html>`;

    return html;
  }

  async generateJSONReport(data) {
    // Generate a simplified JSON report for API consumption
    return JSON.stringify({
      metadata: {
        url: data.url,
        timestamp: data.timestamp,
        analysisId: data.analysisId,
        processingTime: data.processingTime,
        generatedBy: 'claude-dify-checker'
      },
      summary: data.analysis.summary,
      performance: data.performance,
      screenshots: data.screenshots.map(s => ({
        viewport: s.viewport,
        dimensions: `${s.width}x${s.height}`,
        url: s.gcs_url,
        size: s.size_bytes
      })),
      results: data.analysis.items,
      recommendations: this.generatePriorityRecommendations(data.analysis.items)
    }, null, 2);
  }

  generatePriorityRecommendations(items) {
    const failed = items.filter(item => item.status === 'fail');
    const critical = failed.filter(item => item.impact === 'critical');
    const major = failed.filter(item => item.impact === 'major');
    
    return {
      critical: critical.map(item => ({
        category: item.category,
        issue: item.name,
        recommendations: item.recommendations
      })),
      major: major.slice(0, 5).map(item => ({
        category: item.category,
        issue: item.name,
        recommendations: item.recommendations
      })),
      summary: `Found ${critical.length} critical and ${major.length} major issues that should be addressed.`
    };
  }
}

const reportService = new ReportService();
module.exports = reportService;