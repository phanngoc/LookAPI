import { Download, FileJson, FileSpreadsheet, FileText, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { PerformanceTestRun, PerformanceTestConfig } from '@/types/performance';
import { useToast } from '@/hooks/use-toast';

interface Props {
  run: PerformanceTestRun;
  config: PerformanceTestConfig;
}

export function ReportExporter({ run, config }: Props) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateJsonReport = () => {
    return JSON.stringify(
      {
        testName: config.name,
        testType: config.testType,
        status: run.status,
        startedAt: new Date(run.startedAt).toISOString(),
        completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
        durationMs: run.durationMs,
        maxVusReached: run.maxVusReached,
        config: {
          vus: config.vus,
          durationSecs: config.durationSecs,
          stages: config.stages,
          thresholds: config.thresholds,
        },
        metrics: run.metrics,
        thresholdResults: run.thresholdResults,
      },
      null,
      2
    );
  };

  const generateCsvReport = () => {
    if (!run.metrics) return '';

    const headers = [
      'Metric',
      'Value',
    ];

    const rows = [
      ['Total Requests', run.metrics.totalRequests.toString()],
      ['Failed Requests', run.metrics.failedRequests.toString()],
      ['Error Rate', (run.metrics.errorRate * 100).toFixed(2) + '%'],
      ['RPS', run.metrics.requestsPerSecond.toFixed(2)],
      ['Duration Min (ms)', run.metrics.durationMin.toString()],
      ['Duration Avg (ms)', run.metrics.durationAvg.toFixed(2)],
      ['Duration Med (ms)', run.metrics.durationMed.toString()],
      ['Duration P90 (ms)', run.metrics.durationP90.toString()],
      ['Duration P95 (ms)', run.metrics.durationP95.toString()],
      ['Duration P99 (ms)', run.metrics.durationP99.toString()],
      ['Duration Max (ms)', run.metrics.durationMax.toString()],
      ['Iterations Completed', run.metrics.iterationsCompleted.toString()],
      ['Total Duration (ms)', run.metrics.totalDurationMs.toString()],
    ];

    // Add step metrics
    if (run.metrics.stepMetrics) {
      rows.push(['', '']);
      rows.push(['Step Metrics', '']);
      Object.entries(run.metrics.stepMetrics).forEach(([stepName, metrics]) => {
        rows.push([`${stepName} - Requests`, metrics.totalRequests.toString()]);
        rows.push([`${stepName} - Failed`, metrics.failedRequests.toString()]);
        rows.push([`${stepName} - Avg (ms)`, metrics.durationAvg.toFixed(2)]);
        rows.push([`${stepName} - P95 (ms)`, metrics.durationP95.toString()]);
        rows.push([`${stepName} - Error Rate`, (metrics.errorRate * 100).toFixed(2) + '%']);
      });
    }

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  };

  const generateHtmlReport = () => {
    const metrics = run.metrics;
    const status = run.status === 'passed' ? 'PASSED' : 'FAILED';
    const statusColor = run.status === 'passed' ? '#10b981' : '#ef4444';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Test Report - ${config.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.5; }
    .container { max-width: 900px; margin: 0 auto; padding: 2rem; }
    .header { background: white; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
    .header h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .header .meta { color: #64748b; font-size: 0.875rem; }
    .status { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: 600; font-size: 0.875rem; color: white; background: ${statusColor}; }
    .card { background: white; padding: 1.5rem; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
    .card h2 { font-size: 1rem; color: #64748b; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; }
    .metric { text-align: center; padding: 1rem; background: #f8fafc; border-radius: 0.5rem; }
    .metric-value { font-size: 1.5rem; font-weight: 700; color: #1e293b; }
    .metric-label { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; }
    .threshold { padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.75rem; }
    .threshold.pass { background: #ecfdf5; }
    .threshold.fail { background: #fef2f2; }
    .threshold-icon { width: 1.25rem; height: 1.25rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { font-size: 0.75rem; color: #64748b; text-transform: uppercase; }
    td { font-size: 0.875rem; }
    .footer { text-align: center; color: #94a3b8; font-size: 0.75rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div>
          <h1>${config.name}</h1>
          <div class="meta">
            Test Type: ${config.testType.toUpperCase()} | 
            Started: ${new Date(run.startedAt).toLocaleString()} |
            Duration: ${run.durationMs ? Math.round(run.durationMs / 1000) + 's' : 'N/A'}
          </div>
        </div>
        <span class="status">${status}</span>
      </div>
    </div>

    ${metrics ? `
    <div class="card">
      <h2>Summary Metrics</h2>
      <div class="metrics-grid">
        <div class="metric">
          <div class="metric-value">${metrics.totalRequests.toLocaleString()}</div>
          <div class="metric-label">Total Requests</div>
        </div>
        <div class="metric">
          <div class="metric-value">${metrics.failedRequests.toLocaleString()}</div>
          <div class="metric-label">Failed Requests</div>
        </div>
        <div class="metric">
          <div class="metric-value">${metrics.requestsPerSecond.toFixed(1)}</div>
          <div class="metric-label">Requests/sec</div>
        </div>
        <div class="metric">
          <div class="metric-value">${(metrics.errorRate * 100).toFixed(2)}%</div>
          <div class="metric-label">Error Rate</div>
        </div>
        <div class="metric">
          <div class="metric-value">${metrics.iterationsCompleted.toLocaleString()}</div>
          <div class="metric-label">Iterations</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Response Time Distribution</h2>
      <div class="metrics-grid">
        <div class="metric">
          <div class="metric-value">${metrics.durationMin}ms</div>
          <div class="metric-label">Min</div>
        </div>
        <div class="metric">
          <div class="metric-value">${metrics.durationAvg.toFixed(0)}ms</div>
          <div class="metric-label">Avg</div>
        </div>
        <div class="metric">
          <div class="metric-value">${metrics.durationMed}ms</div>
          <div class="metric-label">Median (P50)</div>
        </div>
        <div class="metric">
          <div class="metric-value">${metrics.durationP90}ms</div>
          <div class="metric-label">P90</div>
        </div>
        <div class="metric">
          <div class="metric-value">${metrics.durationP95}ms</div>
          <div class="metric-label">P95</div>
        </div>
        <div class="metric">
          <div class="metric-value">${metrics.durationP99}ms</div>
          <div class="metric-label">P99</div>
        </div>
        <div class="metric">
          <div class="metric-value">${metrics.durationMax}ms</div>
          <div class="metric-label">Max</div>
        </div>
      </div>
    </div>
    ` : ''}

    <div class="card">
      <h2>Threshold Results</h2>
      ${run.thresholdResults.map(result => `
        <div class="threshold ${result.passed ? 'pass' : 'fail'}">
          <svg class="threshold-icon" viewBox="0 0 24 24" fill="none" stroke="${result.passed ? '#10b981' : '#ef4444'}" stroke-width="2">
            ${result.passed 
              ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
              : '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'
            }
          </svg>
          <div>
            <strong>${result.threshold.metric}</strong> ${result.threshold.condition}
            <div style="color: #64748b; font-size: 0.875rem;">${result.message}</div>
          </div>
        </div>
      `).join('')}
    </div>

    ${metrics?.stepMetrics && Object.keys(metrics.stepMetrics).length > 0 ? `
    <div class="card">
      <h2>Per-Step Breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>Requests</th>
            <th>Failed</th>
            <th>Avg</th>
            <th>P95</th>
            <th>Error Rate</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(metrics.stepMetrics).map(([name, sm]) => `
            <tr>
              <td><strong>${name}</strong></td>
              <td>${sm.totalRequests.toLocaleString()}</td>
              <td>${sm.failedRequests}</td>
              <td>${sm.durationAvg.toFixed(0)}ms</td>
              <td>${sm.durationP95}ms</td>
              <td>${(sm.errorRate * 100).toFixed(2)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="footer">
      Generated by LookAPI Performance Testing | ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>`;
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Report Downloaded',
      description: `Saved as ${filename}`,
    });
  };

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(generateJsonReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied to Clipboard',
      description: 'JSON report copied to clipboard',
    });
  };

  const timestamp = new Date().toISOString().split('T')[0];
  const baseFilename = `${config.name.replace(/\s+/g, '_')}_${timestamp}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1.5" />
          Download Report
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => downloadFile(generateJsonReport(), `${baseFilename}.json`, 'application/json')}>
          <FileJson className="w-4 h-4 mr-2 text-blue-600" />
          JSON Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadFile(generateCsvReport(), `${baseFilename}.csv`, 'text/csv')}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
          CSV Metrics
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadFile(generateHtmlReport(), `${baseFilename}.html`, 'text/html')}>
          <FileText className="w-4 h-4 mr-2 text-purple-600" />
          HTML Report
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyJson}>
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2 text-emerald-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2 text-slate-600" />
              Copy JSON
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
