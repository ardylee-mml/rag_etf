/**
 * Schema Analyzer Module
 * 
 * Analyzes the schema of MongoDB collections by examining sample documents
 * and extracting field information, types, and examples.
 */
const mongoose = require('mongoose');

/**
 * Analyzes the schema of specified collections
 * @returns {Object} Schema information for each collection
 */
async function analyzeSchema() {
  const collections = ['players', 'events', 'items', 'zones', 'questions', 'leaderboards'];
  const schemaInfo = {};
  
  console.log('Starting schema analysis...');
  
  for (const collection of collections) {
    console.log(`Analyzing collection: ${collection}`);
    
    try {
      // Get sample documents
      const samples = await mongoose.connection.db.collection(collection).find().limit(20).toArray();
      
      if (samples.length === 0) {
        console.log(`No documents found in collection: ${collection}`);
        schemaInfo[collection] = {
          fields: {},
          sampleData: [],
          count: 0
        };
        continue;
      }
      
      // Extract schema from samples
      const fields = extractFields(samples);
      
      // Get document count
      const count = await mongoose.connection.db.collection(collection).countDocuments();
      
      schemaInfo[collection] = {
        fields,
        sampleData: samples.slice(0, 3),
        count,
        lastUpdated: new Date().toISOString()
      };
      
      console.log(`Analyzed ${count} documents in ${collection}, found ${Object.keys(fields).length} fields`);
    } catch (error) {
      console.error(`Error analyzing collection ${collection}:`, error);
      schemaInfo[collection] = {
        error: error.message,
        lastUpdated: new Date().toISOString()
      };
    }
  }
  
  return schemaInfo;
}

/**
 * Extracts field information from sample documents
 * @param {Array} samples Sample documents from a collection
 * @returns {Object} Field information including types and examples
 */
function extractFields(samples) {
  const fields = {};
  
  samples.forEach(sample => {
    extractFieldsRecursive(sample, '', fields);
  });
  
  return fields;
}

/**
 * Recursively extracts fields from nested documents
 * @param {Object} obj The object to extract fields from
 * @param {String} prefix The prefix for nested fields
 * @param {Object} fields The fields object to populate
 */
function extractFieldsRecursive(obj, prefix, fields) {
  if (!obj) return;
  
  Object.entries(obj).forEach(([key, value]) => {
    const fieldName = prefix ? `${prefix}.${key}` : key;
    
    // Skip MongoDB internal fields like __v
    if (key === '__v') return;
    
    if (!fields[fieldName]) {
      fields[fieldName] = {
        type: getType(value),
        examples: value !== null && value !== undefined ? [value] : [],
        isId: key === '_id' || key.endsWith('Id') || key.endsWith('_id'),
        nullable: value === null,
        path: fieldName
      };
    } else {
      // Update existing field information
      if (value !== null && value !== undefined && 
          fields[fieldName].examples.length < 3 && 
          !fields[fieldName].examples.some(ex => 
            JSON.stringify(ex) === JSON.stringify(value)
          )) {
        fields[fieldName].examples.push(value);
      }
      
      // Update nullable status
      if (value === null) {
        fields[fieldName].nullable = true;
      }
      
      // Check if type is consistent
      const valueType = getType(value);
      if (valueType !== fields[fieldName].type && value !== null) {
        if (!fields[fieldName].alternativeTypes) {
          fields[fieldName].alternativeTypes = [valueType];
        } else if (!fields[fieldName].alternativeTypes.includes(valueType)) {
          fields[fieldName].alternativeTypes.push(valueType);
        }
      }
    }
    
    // Recursively process nested objects
    if (value && typeof value === 'object' && !Array.isArray(value) && 
        !(value instanceof Date) && !value._bsontype) {
      extractFieldsRecursive(value, fieldName, fields);
    }
    
    // Process array items if they are objects
    if (Array.isArray(value) && value.length > 0) {
      fields[fieldName].arrayItemType = getType(value[0]);
      
      // If array contains objects, analyze their structure
      if (value[0] && typeof value[0] === 'object' && !(value[0] instanceof Date) && !value[0]._bsontype) {
        extractFieldsRecursive(value[0], `${fieldName}[]`, fields);
      }
    }
  });
}

/**
 * Determines the type of a value
 * @param {*} value The value to determine the type of
 * @returns {String} The type of the value
 */
function getType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  
  if (typeof value === 'object') {
    if (value._bsontype === 'ObjectID' || value._bsontype === 'ObjectId') return 'objectId';
    if (value._bsontype) return value._bsontype.toLowerCase();
    return 'object';
  }
  
  return typeof value;
}

/**
 * Analyzes a specific collection's schema
 * @param {String} collectionName The name of the collection to analyze
 * @returns {Object} Schema information for the collection
 */
async function analyzeCollectionSchema(collectionName) {
  try {
    // Get sample documents
    const samples = await mongoose.connection.db.collection(collectionName).find().limit(20).toArray();
    
    if (samples.length === 0) {
      console.log(`No documents found in collection: ${collectionName}`);
      return {
        fields: {},
        sampleData: [],
        count: 0,
        lastUpdated: new Date().toISOString()
      };
    }
    
    // Extract schema from samples
    const fields = extractFields(samples);
    
    // Get document count
    const count = await mongoose.connection.db.collection(collectionName).countDocuments();
    
    return {
      fields,
      sampleData: samples.slice(0, 3),
      count,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error analyzing collection ${collectionName}:`, error);
    return {
      error: error.message,
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = { 
  analyzeSchema,
  analyzeCollectionSchema,
  extractFields,
  getType
};
