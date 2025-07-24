export interface AnalyzeRequest {
  url: string;
  options?: {
    timeout?: number;
    waitFor?: string;
    viewport?: {
      width: number;
      height: number;
    };
    screenshot?: boolean;
  };
}

export interface AnalyzeResponse {
  success: boolean;
  url: string;
  timestamp: string;
  data: {
    title: string;
    loadTime: number;
    screenshot?: string;
    metrics: {
      domElements: number;
      networkRequests: number;
      pageSize: number;
    };
    accessibility: {
      score: number;
      issues: Array<{
        type: string;
        message: string;
        severity: 'error' | 'warning' | 'info';
      }>;
    };
  };
  processingTime: number;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}