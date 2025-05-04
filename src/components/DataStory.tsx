import React from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import { 
  DocumentTextIcon, 
  ChartBarIcon, 
  LightBulbIcon, 
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface DataStoryProps {
  story: {
    title: string;
    analysis: {
      summary: string;
      keyFindings: string[];
      trends: Array<{
        description: string;
        significance: number;
        direction: string;
        dataPoints: number[];
      }>;
      anomalies: Array<{
        description: string;
        severity: number;
        location: string;
        value: any;
      }>;
      correlations: Array<{
        variables: string[];
        strength: number;
        description: string;
      }>;
    };
    visualizations: Array<{
      type: string;
      title: string;
      description: string;
      config: any;
      data: any;
    }>;
    metadata: {
      author: string;
      tags: string[];
      timeRange: {
        start: Date;
        end: Date;
      };
    };
  };
  source: 'cache' | 'fresh';
  onExport: (format: 'pdf' | 'markdown') => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

const DataStory: React.FC<DataStoryProps> = ({ story, source, onExport, onRefresh, isLoading = false }) => {
  const { title, analysis, visualizations, metadata } = story;

  const renderVisualization = (viz: any) => {
    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: viz.title,
        },
      },
    };

    switch (viz.type) {
      case 'line':
        return (
          <Line
            data={{
              labels: Array.from({ length: viz.data.length }, (_, i) => i + 1),
              datasets: [{
                label: viz.title,
                data: viz.data,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
              }]
            }}
            options={commonOptions}
          />
        );
      case 'scatter':
        return (
          <Scatter
            data={{
              datasets: [{
                label: viz.title,
                data: viz.data,
                backgroundColor: 'rgb(75, 192, 192)'
              }]
            }}
            options={{
              ...commonOptions,
              scales: {
                x: {
                  title: {
                    display: true,
                    text: viz.config.xAxis.name
                  }
                },
                y: {
                  title: {
                    display: true,
                    text: viz.config.yAxis.name
                  }
                }
              }
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {source === 'cache' && (
            <div className="flex items-center gap-1 text-gray-500 text-sm">
              <ClockIcon className="w-4 h-4" />
              <span>Cached</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={`flex items-center gap-2 px-3 py-2 rounded-md ${
              isLoading
                ? 'bg-gray-100 text-gray-400'
                : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
            }`}
          >
            <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => onExport('pdf')}
            className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Export PDF
          </button>
          <button
            onClick={() => onExport('markdown')}
            className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-md hover:bg-green-100"
          >
            <DocumentTextIcon className="w-5 h-5" />
            Export Markdown
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-gray-900 mb-3">
          <DocumentTextIcon className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Summary</h2>
        </div>
        <p className="text-gray-600">{analysis.summary}</p>
      </div>

      {/* Key Findings */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-gray-900 mb-3">
          <LightBulbIcon className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Key Findings</h2>
        </div>
        <ul className="list-disc list-inside space-y-2">
          {analysis.keyFindings.map((finding, index) => (
            <li key={index} className="text-gray-600">{finding}</li>
          ))}
        </ul>
      </div>

      {/* Visualizations */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-gray-900 mb-3">
          <ChartBarIcon className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Visualizations</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visualizations.map((viz, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-2">{viz.title}</h3>
              <p className="text-sm text-gray-600 mb-4">{viz.description}</p>
              <div className="h-64">
                {renderVisualization(viz)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trends */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-gray-900 mb-3">
          <ChartBarIcon className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Trends</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analysis.trends.map((trend, index) => (
            <div key={index} className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-blue-900">{trend.description}</h3>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-blue-700">
                  Significance: {(trend.significance * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-blue-700">
                  Direction: {trend.direction}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Anomalies */}
      {analysis.anomalies.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 text-gray-900 mb-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-semibold">Anomalies</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.anomalies.map((anomaly, index) => (
              <div key={index} className="bg-amber-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-amber-900">
                  {anomaly.description}
                </h3>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-amber-700">
                    Severity: {(anomaly.severity * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-amber-700">
                    Location: {anomaly.location}
                  </p>
                  <p className="text-sm text-amber-700">
                    Value: {anomaly.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-sm text-gray-500">
          <div>
            <span className="font-medium">Author:</span> {metadata.author}
          </div>
          <div>
            <span className="font-medium">Time Range:</span>{' '}
            {metadata.timeRange.start.toLocaleDateString()} -{' '}
            {metadata.timeRange.end.toLocaleDateString()}
          </div>
          <div>
            <span className="font-medium">Tags:</span> {metadata.tags.join(', ')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataStory; 