import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import visualizationService from '../services/visualizationService';
import { ChartBarIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import classNames from 'classnames';

const DataChart = ({ data, query, className }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (!data || !query) return;

        try {
            const config = visualizationService.generateChartConfig(data, query);
            const enhancedConfig = visualizationService.enhanceChartWithConfidence(config);

            if (chartInstance.current) {
                chartInstance.current.destroy();
            }

            const ctx = chartRef.current.getContext('2d');
            chartInstance.current = new Chart(ctx, enhancedConfig);

            return () => {
                if (chartInstance.current) {
                    chartInstance.current.destroy();
                }
            };
        } catch (error) {
            console.error('Failed to create chart:', error);
        }
    }, [data, query]);

    const { type, confidence } = visualizationService.detectChartType(query);
    const isLowConfidence = confidence < visualizationService.confidenceThreshold;

    return (
        <div className={classNames('relative', className)}>
            {/* Chart Type Indicator */}
            <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                <div className={classNames(
                    'px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1',
                    isLowConfidence ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                )}>
                    <ChartBarIcon className="w-4 h-4" />
                    <span>{type.charAt(0).toUpperCase() + type.slice(1)} Chart</span>
                    {isLowConfidence && (
                        <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />
                    )}
                </div>
                {isLowConfidence && (
                    <div className="tooltip">
                        <div className="tooltip-content">
                            Low confidence in chart type selection.
                            Consider rephrasing your query to be more specific.
                        </div>
                    </div>
                )}
            </div>

            {/* Confidence Legend */}
            {type === 'line' && (
                <div className="absolute top-2 left-2 bg-white/80 backdrop-blur-sm rounded-lg p-2 text-xs text-gray-600 z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-200 rounded"></div>
                        <span>Confidence Band (±10%)</span>
                    </div>
                </div>
            )}

            {/* Chart Canvas */}
            <canvas ref={chartRef} />

            {/* Chart Controls */}
            <div className="absolute bottom-2 right-2 flex gap-2">
                <button
                    onClick={() => {
                        if (chartInstance.current) {
                            chartInstance.current.resetZoom();
                        }
                    }}
                    className="p-1 rounded bg-white/80 hover:bg-white text-gray-600 text-xs"
                >
                    Reset Zoom
                </button>
            </div>

            <style jsx>{`
                .tooltip {
                    position: relative;
                    display: inline-block;
                }

                .tooltip-content {
                    visibility: hidden;
                    position: absolute;
                    z-index: 1;
                    bottom: 125%;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 200px;
                    background-color: white;
                    color: #4B5563;
                    text-align: center;
                    padding: 0.5rem;
                    border-radius: 0.375rem;
                    font-size: 0.75rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .tooltip:hover .tooltip-content {
                    visibility: visible;
                }
            `}</style>
        </div>
    );
};

export default DataChart; 