import { Chart } from 'chart.js/auto';

class VisualizationService {
    constructor() {
        this.confidenceThreshold = 0.7;
        this.chartTypeKeywords = {
            line: ['trend', 'over time', 'progression', 'growth', 'change'],
            bar: ['compare', 'comparison', 'distribution', 'frequency', 'count'],
            pie: ['proportion', 'percentage', 'share', 'composition', 'breakdown'],
            scatter: ['correlation', 'relationship', 'distribution', 'spread'],
            doughnut: ['composition', 'parts', 'segments', 'division'],
        };
    }

    detectChartType(query) {
        query = query.toLowerCase();
        let bestMatch = { type: 'bar', confidence: 0.5 }; // Default to bar chart

        Object.entries(this.chartTypeKeywords).forEach(([type, keywords]) => {
            const matchCount = keywords.filter(keyword => query.includes(keyword)).length;
            const confidence = matchCount / keywords.length;
            
            if (confidence > bestMatch.confidence) {
                bestMatch = { type, confidence };
            }
        });

        return bestMatch;
    }

    generateChartConfig(data, query) {
        const { type } = this.detectChartType(query);
        
        // Extract labels and datasets from the data
        const labels = this.extractLabels(data);
        const datasets = this.extractDatasets(data, type);

        const config = {
            type,
            data: {
                labels,
                datasets
            },
            options: this.getChartOptions(type)
        };

        return config;
    }

    extractLabels(data) {
        if (Array.isArray(data)) {
            // If data is an array of objects, use the first key as labels
            if (typeof data[0] === 'object') {
                const keys = Object.keys(data[0]);
                return data.map(item => item[keys[0]]);
            }
            // If data is a simple array, use indices as labels
            return data.map((_, index) => `Item ${index + 1}`);
        }
        return [];
    }

    extractDatasets(data, chartType) {
        if (!Array.isArray(data)) return [];

        if (typeof data[0] === 'object') {
            const keys = Object.keys(data[0]).filter(key => typeof data[0][key] === 'number');
            return keys.map(key => ({
                label: this.formatLabel(key),
                data: data.map(item => item[key]),
                backgroundColor: this.generateColors(data.length),
                borderColor: chartType === 'line' ? this.generateColors(1)[0] : undefined,
                fill: false
            }));
        }

        // If data is a simple array of numbers
        return [{
            data,
            backgroundColor: this.generateColors(data.length),
            borderColor: chartType === 'line' ? this.generateColors(1)[0] : undefined,
            fill: false
        }];
    }

    formatLabel(key) {
        return key
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    generateColors(count) {
        const baseColors = [
            '#3B82F6', // blue-500
            '#EF4444', // red-500
            '#10B981', // emerald-500
            '#F59E0B', // amber-500
            '#8B5CF6', // violet-500
            '#EC4899', // pink-500
            '#14B8A6', // teal-500
            '#F97316', // orange-500
        ];

        if (count <= baseColors.length) {
            return baseColors.slice(0, count);
        }

        // Generate additional colors if needed
        const colors = [...baseColors];
        while (colors.length < count) {
            colors.push(this.generateRandomColor());
        }
        return colors;
    }

    generateRandomColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 70%, 50%)`;
    }

    getChartOptions(type) {
        const baseOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                },
            },
            animation: {
                duration: 750,
                easing: 'easeInOutQuart',
            },
        };

        // Add type-specific options
        switch (type) {
            case 'line':
                return {
                    ...baseOptions,
                    scales: {
                        y: {
                            beginAtZero: true,
                        },
                    },
                    elements: {
                        line: {
                            tension: 0.4,
                        },
                    },
                };
            case 'bar':
                return {
                    ...baseOptions,
                    scales: {
                        y: {
                            beginAtZero: true,
                        },
                    },
                };
            case 'pie':
            case 'doughnut':
                return {
                    ...baseOptions,
                    plugins: {
                        ...baseOptions.plugins,
                        legend: {
                            position: 'right',
                        },
                    },
                };
            case 'scatter':
                return {
                    ...baseOptions,
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                        },
                        y: {
                            beginAtZero: true,
                        },
                    },
                };
            default:
                return baseOptions;
        }
    }

    enhanceChartWithConfidence(config) {
        if (config.type === 'line') {
            // Add confidence bands for line charts
            const datasets = config.data.datasets.map(dataset => {
                const upperBound = {
                    ...dataset,
                    data: dataset.data.map(value => value * 1.1), // +10%
                    borderColor: 'transparent',
                    backgroundColor: this.adjustAlpha(dataset.borderColor, 0.1),
                    pointRadius: 0,
                    fill: '+1',
                };

                const lowerBound = {
                    ...dataset,
                    data: dataset.data.map(value => value * 0.9), // -10%
                    borderColor: 'transparent',
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    fill: false,
                };

                return [lowerBound, dataset, upperBound];
            }).flat();

            return {
                ...config,
                data: {
                    ...config.data,
                    datasets,
                },
            };
        }

        return config;
    }

    adjustAlpha(color, alpha) {
        if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        if (color.startsWith('rgb')) {
            return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
        }
        return color;
    }
}

export default new VisualizationService(); 