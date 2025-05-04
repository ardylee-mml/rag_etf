const chrono = require('chrono-node');
const stringSimilarity = require('string-similarity');

class QueryBuilder {
    constructor() {
        this.comparisonKeywords = {
            'greater than': '$gt',
            'more than': '$gt',
            'bigger than': '$gt',
            'higher than': '$gt',
            'less than': '$lt',
            'lower than': '$lt',
            'smaller than': '$lt',
            'at least': '$gte',
            'at most': '$lte',
            'equal to': '$eq',
            'equals': '$eq'
        };

        this.sortKeywords = {
            'sort by': true,
            'order by': true,
            'ascending': 1,
            'descending': -1,
            'asc': 1,
            'desc': -1
        };

        this.timeKeywords = {
            'today': 0,
            'yesterday': 1,
            'last week': 7,
            'last month': 30,
            'last year': 365
        };
    }

    parseDateFilter(query) {
        // Use chrono-node to parse natural dates
        const parsed = chrono.parse(query);
        if (parsed.length > 0) {
            const date = parsed[0].start.date();
            return { $gte: date };
        }

        // Check for relative time keywords
        for (const [keyword, days] of Object.entries(this.timeKeywords)) {
            if (query.toLowerCase().includes(keyword)) {
                const date = new Date();
                date.setDate(date.getDate() - days);
                return { $gte: date };
            }
        }

        return null;
    }

    parseComparisonOperators(query) {
        for (const [keyword, operator] of Object.entries(this.comparisonKeywords)) {
            if (query.toLowerCase().includes(keyword)) {
                const value = this.extractNumericValue(query);
                if (value !== null) {
                    return { [operator]: value };
                }
            }
        }
        return null;
    }

    extractNumericValue(query) {
        const matches = query.match(/\d+(\.\d+)?/);
        return matches ? parseFloat(matches[0]) : null;
    }

    parseSortPreference(query) {
        const sort = {};
        const words = query.toLowerCase().split(' ');

        // Check for sort indicators
        for (let i = 0; i < words.length; i++) {
            if (this.sortKeywords[words[i]]) {
                if (words[i + 1]) {
                    // Check the next word for field name
                    const direction = words[i + 2] === 'descending' || words[i + 2] === 'desc' ? -1 : 1;
                    sort[words[i + 1]] = direction;
                    break;
                }
            }
        }

        return Object.keys(sort).length > 0 ? sort : null;
    }

    buildTextSearch(query, fields) {
        // Remove common keywords and operators from the query
        const cleanQuery = query.toLowerCase()
            .replace(/sort by|order by|ascending|descending|asc|desc|greater than|less than|more than|less than|last week|last month|last year/g, '')
            .trim();

        // Check for region mentions
        if (cleanQuery.includes('region') || cleanQuery.includes('from')) {
            // Look for region codes
            if (cleanQuery.includes('ca') || cleanQuery.includes('canada')) {
                return { region: 'CA' };
            } else if (cleanQuery.includes('us') || cleanQuery.includes('united states')) {
                return { region: 'US' };
            }
        }

        // Check for name mentions
        if (cleanQuery.includes('name')) {
            // Extract potential name from query
            const nameMatch = cleanQuery.match(/name\s+([\w\s]+)/i);
            if (nameMatch && nameMatch[1]) {
                const name = nameMatch[1].trim();
                return { name: new RegExp(name, 'i') };
            }
        }

        // Default to a simple limit query if no specific filters can be applied
        return {};
    }

    buildAggregationPipeline(query, collection) {
        const pipeline = [];
        const dateFilter = this.parseDateFilter(query);
        const comparisonFilter = this.parseComparisonOperators(query);
        const sortPreference = this.parseSortPreference(query);

        // Match stage for date filtering
        if (dateFilter) {
            pipeline.push({
                $match: {
                    createdAt: dateFilter
                }
            });
        }

        // Match stage for comparison operators
        if (comparisonFilter) {
            pipeline.push({
                $match: comparisonFilter
            });
        }

        // Text search stage
        const textSearch = this.buildTextSearch(query, ['name', 'description', 'content']);
        if (textSearch) {
            pipeline.push({
                $match: textSearch
            });
        }

        // Sort stage
        if (sortPreference) {
            pipeline.push({
                $sort: sortPreference
            });
        }

        // If no specific stages were added, return a limited number of documents
        if (pipeline.length === 0) {
            pipeline.push({
                $match: {} // Match all documents
            });
            pipeline.push({
                $limit: 10 // Limit to 10 documents
            });
        }

        return pipeline;
    }
}

module.exports = new QueryBuilder();