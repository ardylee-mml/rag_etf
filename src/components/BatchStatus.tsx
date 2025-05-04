import React from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface BatchStatusProps {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  operation: string;
  error?: Error;
  onRetry?: () => void;
}

const BatchStatus: React.FC<BatchStatusProps> = ({
  jobId,
  status,
  progress,
  operation,
  error,
  onRetry
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'processing':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5" />;
      case 'failed':
        return <ExclamationCircleIcon className="w-5 h-5" />;
      case 'processing':
        return <ArrowPathIcon className="w-5 h-5 animate-spin" />;
      default:
        return <ClockIcon className="w-5 h-5" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={getStatusColor()}>{getStatusIcon()}</span>
          <h3 className="text-lg font-medium">
            {operation} - {status}
          </h3>
        </div>
        {status === 'failed' && onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
          >
            Retry
          </button>
        )}
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
        <div
          className={`h-2.5 rounded-full ${
            status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="flex justify-between text-sm text-gray-500">
        <span>Job ID: {jobId}</span>
        <span>{progress.toFixed(1)}%</span>
      </div>

      {error && (
        <div className="mt-2 p-2 bg-red-50 text-red-700 text-sm rounded">
          {error.message}
        </div>
      )}
    </div>
  );
};

export default BatchStatus; 