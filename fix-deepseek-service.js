// This is a specialized handler for item queries with context.action filtering
// to be added to the extractMongoDBPipeline method in DeepseekService

// Add this code to the extractMongoDBPipeline method in DeepseekService.js
// around line 666 (before the try-catch block)

// Special case for item queries with context.action filtering
if (lowerQuery.includes('item') && 
    (lowerQuery.includes('pickup') || lowerQuery.includes('action')) && 
    collectionName === 'events') {
    
    console.log('Detected item query with action filtering');
    
    // Extract limit from query (default to 5 if not specified)
    let limit = 5;
    const limitMatch = lowerQuery.match(/top\s+(\d+)/);
    if (limitMatch) {
        limit = parseInt(limitMatch[1]);
    }
    console.log(`Using limit: ${limit}`);
    
    // Determine the action type
    let action = null;
    if (lowerQuery.includes('pickup')) action = 'pickup';
    else if (lowerQuery.includes('drop')) action = 'drop';
    else if (lowerQuery.includes('use')) action = 'use';
    
    // Build the match condition
    const matchCondition = { type: 'item' };
    if (action) {
        matchCondition['context.action'] = action;
    }
    
    // Build the pipeline
    return [
        { $match: matchCondition },
        { $group: {
            _id: '$context.itemId',
            count: { $sum: 1 }
        }},
        { $lookup: {
            from: 'items',
            localField: '_id',
            foreignField: '_id',
            as: 'itemDetails'
        }},
        { $unwind: { path: '$itemDetails', preserveNullAndEmptyArrays: true } },
        { $project: {
            itemId: '$_id',
            itemName: '$itemDetails.name',
            count: 1,
            _id: 0
        }},
        { $sort: { count: -1 } },
        { $limit: limit }
    ];
}
