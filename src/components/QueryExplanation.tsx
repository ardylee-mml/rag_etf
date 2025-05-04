import React from 'react';
import { ChartBarIcon, ClockIcon, LightBulbIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface QueryExplanationProps {
  explanation: {
    interpretation: {
      intent: string;
      entities: Array<{
        name: string;
        value: string;
        type: string;
      }>;
      conditions: string[];
      confidence: number;
    };
    execution: {
      usedIndexes: Array<{
        name: string;
        field: string;
        type: string;
        efficiency: number;
      }>;
      estimatedComplexity: {
        timeComplexity: string;
        documentsExamined: number;
        indexesUsed: number;
      };
    };
    suggestions: {
      alternativePhrasing: string[];
      optimizationTips: string[];
      recommendedIndexes: Array<{
        fields: string[];
        reason: string;
      }>;
    };
  };
}

const QueryExplanation: React.FC<QueryExplanationProps> = ({ explanation }) => {
  const { interpretation, execution, suggestions } = explanation;

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-6">
      {/* Interpretation Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-blue-600">
          <MagnifyingGlassIcon className="w-5 h-5" />
          <h3 className="font-semibold">Query Interpretation</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-3 rounded-md">
            <p className="text-sm font-medium text-blue-800">Intent</p>
            <p className="text-sm text-blue-600">{interpretation.intent}</p>
            <div className="mt-2">
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 rounded-full h-2" 
                  style={{ width: `${interpretation.confidence * 100}%` }}
                />
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Confidence: {Math.round(interpretation.confidence * 100)}%
              </p>
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-md">
            <p className="text-sm font-medium text-blue-800">Identified Entities</p>
            <div className="space-y-1">
              {interpretation.entities.map((entity, index) => (
                <div key={index} className="text-sm text-blue-600">
                  <span className="font-medium">{entity.name}:</span> {entity.value}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Execution Analysis Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <ChartBarIcon className="w-5 h-5" />
          <h3 className="font-semibold">Execution Analysis</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 p-3 rounded-md">
            <p className="text-sm font-medium text-green-800">Used Indexes</p>
            <div className="space-y-2">
              {execution.usedIndexes.map((index, i) => (
                <div key={i} className="text-sm">
                  <p className="text-green-700 font-medium">{index.name}</p>
                  <p className="text-green-600">
                    Field: {index.field}
                    <span className="ml-2 text-xs bg-green-100 px-2 py-0.5 rounded-full">
                      {index.type}
                    </span>
                  </p>
                  <div className="w-full bg-green-200 rounded-full h-1.5 mt-1">
                    <div 
                      className="bg-green-600 rounded-full h-1.5" 
                      style={{ width: `${index.efficiency * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-green-50 p-3 rounded-md">
            <p className="text-sm font-medium text-green-800">Complexity Analysis</p>
            <div className="space-y-2">
              <p className="text-sm text-green-600">
                Time Complexity: <span className="font-mono">{execution.estimatedComplexity.timeComplexity}</span>
              </p>
              <p className="text-sm text-green-600">
                Documents Examined: {execution.estimatedComplexity.documentsExamined.toLocaleString()}
              </p>
              <p className="text-sm text-green-600">
                Indexes Used: {execution.estimatedComplexity.indexesUsed}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Suggestions Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-amber-600">
          <LightBulbIcon className="w-5 h-5" />
          <h3 className="font-semibold">Suggestions</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-amber-50 p-3 rounded-md">
            <p className="text-sm font-medium text-amber-800">Alternative Phrasings</p>
            <ul className="list-disc list-inside space-y-1">
              {suggestions.alternativePhrasing.map((phrase, index) => (
                <li key={index} className="text-sm text-amber-600">{phrase}</li>
              ))}
            </ul>
          </div>

          <div className="bg-amber-50 p-3 rounded-md">
            <p className="text-sm font-medium text-amber-800">Optimization Tips</p>
            <ul className="list-disc list-inside space-y-1">
              {suggestions.optimizationTips.map((tip, index) => (
                <li key={index} className="text-sm text-amber-600">{tip}</li>
              ))}
            </ul>
            {suggestions.recommendedIndexes.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-amber-800">Recommended Indexes</p>
                {suggestions.recommendedIndexes.map((index, i) => (
                  <div key={i} className="text-sm text-amber-600 mt-1">
                    <p className="font-mono">{`{ ${index.fields.join(', ')} }`}</p>
                    <p className="text-xs italic">{index.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueryExplanation; 