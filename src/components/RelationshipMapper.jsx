import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function RelationshipMapper({ token, collections }) {
  // State for selected collections and their fields
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [collectionFields, setCollectionFields] = useState({});
  const [collectionSamples, setCollectionSamples] = useState({});
  const [sampleCounts, setSampleCounts] = useState({});
  const [mappings, setMappings] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState({});
  const [error, setError] = useState('');
  const [queryDebugInfo, setQueryDebugInfo] = useState(null);
  const [savedMappings, setSavedMappings] = useState([]);
  const [activeMappingId, setActiveMappingId] = useState(null);
  const [mappingName, setMappingName] = useState('');
  const [selectedSourceField, setSelectedSourceField] = useState(null);
  const [hoveredField, setHoveredField] = useState(null);

  // Refs for the canvas and drawing
  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const fieldRefsMap = useRef({});

  // Load collection fields and sample data when a collection is selected
  const fetchCollectionFields = async (collectionName) => {
    try {
      setLoading(true);

      // Get fields for the collection
      const fields = getCollectionFields(collectionName);
      setCollectionFields(prev => ({
        ...prev,
        [collectionName]: fields
      }));

      // Fetch sample data from the API
      try {
        const response = await axios.post('/api/query', {
          query: `Find the first 20 documents in ${collectionName}`,
          collection: collectionName,
          limit: 20
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Store the sample data
        if (response.data && response.data.results) {
          const samples = response.data.results.slice(0, 20);
          setCollectionSamples(prev => ({
            ...prev,
            [collectionName]: samples
          }));

          // Initialize sample count
          setSampleCounts(prev => ({
            ...prev,
            [collectionName]: samples.length
          }));
        }
      } catch (sampleError) {
        console.error(`Failed to fetch sample data for ${collectionName}:`, sampleError);
        // Use mock data if API fails
        const mockData = getMockSampleData(collectionName);
        setCollectionSamples(prev => ({
          ...prev,
          [collectionName]: mockData
        }));

        // Initialize sample count for mock data
        setSampleCounts(prev => ({
          ...prev,
          [collectionName]: mockData.length
        }));
      }
    } catch (err) {
      setError(`Failed to fetch fields for ${collectionName}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load more sample data for a collection
  const loadMoreSamples = async (collectionName) => {
    try {
      // Set loading state for this specific collection
      setLoadingMore(prev => ({
        ...prev,
        [collectionName]: true
      }));

      // Calculate how many records we already have
      const currentCount = sampleCounts[collectionName] || 0;
      const nextBatch = 20; // Number of additional records to fetch

      // Fetch more sample data from the API
      const response = await axios.post('/api/query', {
        query: `Find documents in ${collectionName} starting from position ${currentCount}`,
        collection: collectionName,
        skip: currentCount,
        limit: nextBatch
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Add the new samples to the existing ones
      if (response.data && response.data.results && response.data.results.length > 0) {
        const newSamples = response.data.results;

        setCollectionSamples(prev => ({
          ...prev,
          [collectionName]: [...(prev[collectionName] || []), ...newSamples]
        }));

        // Update the sample count
        setSampleCounts(prev => ({
          ...prev,
          [collectionName]: (prev[collectionName] || 0) + newSamples.length
        }));
      } else {
        // No more records to fetch
        setError(`No more records available for ${collectionName}`);
        setTimeout(() => setError(''), 3000); // Clear error after 3 seconds
      }
    } catch (err) {
      setError(`Failed to load more samples for ${collectionName}: ${err.message}`);
    } finally {
      // Clear loading state for this collection
      setLoadingMore(prev => ({
        ...prev,
        [collectionName]: false
      }));
    }
  };

  // Get mock sample data for a collection
  const getMockSampleData = (collectionName) => {
    // Return 5 mock documents based on the collection
    const mockData = [];
    const fields = getCollectionFields(collectionName);

    for (let i = 0; i < 5; i++) {
      const doc = {};
      fields.forEach(field => {
        // Generate mock values based on field name
        if (field.includes('Id') || field === '_id') {
          doc[field] = `${field.replace('Id', '')}_${i+1}`;
        } else if (field.includes('name')) {
          doc[field] = `Sample ${field} ${i+1}`;
        } else if (field.includes('time') || field.includes('date')) {
          doc[field] = new Date().toISOString();
        } else if (field.includes('count') || field.includes('score')) {
          doc[field] = Math.floor(Math.random() * 100);
        } else {
          doc[field] = `Value for ${field} ${i+1}`;
        }
      });
      mockData.push(doc);
    }

    return mockData;
  };

  // Hardcoded fields for each collection
  const getCollectionFields = (collectionName) => {
    const fieldMap = {
      players: ['_id', 'playerId', 'name', 'email', 'createdAt', 'lastLogin'],
      events: ['_id', 'playerId', 'type', 'timestamp', 'context.itemId', 'context.zoneId', 'context.questionId', 'timeTaken', 'correct'],
      zones: ['_id', 'name', 'description', 'type', 'region'],
      items: ['_id', 'name', 'description', 'type', 'value'],
      questions: ['_id', 'text', 'choices', 'difficulty', 'category', 'userId'],
      leaderboards: ['_id', 'playerId', 'score', 'level', 'timestamp'],
      campaigns: ['_id', 'name', 'description', 'startDate', 'endDate'],
      checkpoints: ['_id', 'name', 'description', 'zoneId', 'requirements']
    };

    return fieldMap[collectionName] || [];
  };

  // Add a collection to the mapping interface
  const addCollection = (collectionId) => {
    if (selectedCollections.includes(collectionId)) {
      return; // Already added
    }

    setSelectedCollections(prev => [...prev, collectionId]);
    fetchCollectionFields(collectionId);
  };

  // Remove a collection from the mapping interface
  const removeCollection = (collectionId) => {
    setSelectedCollections(prev => prev.filter(id => id !== collectionId));

    // Remove any mappings involving this collection
    setMappings(prev => prev.filter(mapping =>
      mapping.sourceCollection !== collectionId && mapping.targetCollection !== collectionId
    ));
  };

  // Handle field selection for creating a mapping
  const handleFieldClick = (collectionId, fieldName, element) => {
    // Store the element ref for drawing lines
    const fieldKey = `${collectionId}-${fieldName}`;
    fieldRefsMap.current[fieldKey] = element;

    // If no source field is selected, set this as the source
    if (!selectedSourceField) {
      setSelectedSourceField({
        collectionId,
        fieldName,
        element
      });
      return;
    }

    // If the same field is clicked again, deselect it
    if (selectedSourceField.collectionId === collectionId && selectedSourceField.fieldName === fieldName) {
      setSelectedSourceField(null);
      return;
    }

    // If a different field in the same collection is clicked, update the source
    if (selectedSourceField.collectionId === collectionId) {
      setSelectedSourceField({
        collectionId,
        fieldName,
        element
      });
      return;
    }

    // If a field in a different collection is clicked, create a mapping
    const newMapping = {
      id: `mapping-${Date.now()}`,
      sourceCollection: selectedSourceField.collectionId,
      sourceField: selectedSourceField.fieldName,
      targetCollection: collectionId,
      targetField: fieldName
    };

    setMappings(prev => [...prev, newMapping]);
    setSelectedSourceField(null); // Reset selection after creating mapping

    // Redraw the canvas
    setTimeout(() => drawCanvas(), 50);
  };

  // Handle field hover for visual feedback
  const handleFieldHover = (collectionId, fieldName, element) => {
    setHoveredField({
      collectionId,
      fieldName,
      element
    });
  };

  // Clear hover state when mouse leaves a field
  const handleFieldLeave = () => {
    setHoveredField(null);
  };

  // Draw all mappings on the canvas
  const drawCanvas = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all existing mappings
    mappings.forEach(mapping => {
      drawMappingLine(ctx, mapping, false);
    });

    // Draw the currently selected field highlight
    if (selectedSourceField) {
      const element = selectedSourceField.element;
      if (element) {
        const rect = element.getBoundingClientRect();
        const canvasRect = canvasContainerRef.current.getBoundingClientRect();

        // Calculate position relative to the canvas container
        const x = rect.left + rect.width / 2 - canvasRect.left;
        const y = rect.top + rect.height / 2 - canvasRect.top;

        // Draw a pulsing circle around the selected field
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw a temporary line from selected field to hovered field
        if (hoveredField && hoveredField.collectionId !== selectedSourceField.collectionId) {
          const hoverRect = hoveredField.element.getBoundingClientRect();
          const hoverX = hoverRect.left + hoverRect.width / 2 - canvasRect.left;
          const hoverY = hoverRect.top + hoverRect.height / 2 - canvasRect.top;

          // Draw dashed line
          ctx.beginPath();
          ctx.setLineDash([5, 3]);
          ctx.moveTo(x, y);
          ctx.lineTo(hoverX, hoverY);
          ctx.strokeStyle = '#4CAF50';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  };

  // Draw a single mapping line
  const drawMappingLine = (ctx, mapping, isTemporary = false) => {
    // Get the source and target field elements from our refs map
    const sourceKey = `${mapping.sourceCollection}-${mapping.sourceField}`;
    const targetKey = `${mapping.targetCollection}-${mapping.targetField}`;

    // Find the DOM elements for the source and target fields
    const sourceElement = document.querySelector(`[data-field="${sourceKey}"]`);
    const targetElement = document.querySelector(`[data-field="${targetKey}"]`);

    if (!sourceElement || !targetElement || !canvasContainerRef.current) return;

    const sourceRect = sourceElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const canvasRect = canvasContainerRef.current.getBoundingClientRect();

    // Calculate positions relative to the canvas container
    const startX = sourceRect.left + sourceRect.width / 2 - canvasRect.left;
    const startY = sourceRect.top + sourceRect.height / 2 - canvasRect.top;
    const endX = targetRect.left + targetRect.width / 2 - canvasRect.left;
    const endY = targetRect.top + targetRect.height / 2 - canvasRect.top;

    // Calculate control points for a curved line
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(0.3, 100 / distance); // Adjust curvature based on distance

    // Calculate perpendicular offset for control points
    const perpX = -dy * curvature;
    const perpY = dx * curvature;

    // Control points for the curve
    const cp1x = startX + perpX;
    const cp1y = startY + perpY;
    const cp2x = endX + perpX;
    const cp2y = endY + perpY;

    // Set line style
    if (isTemporary) {
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = 'rgba(76, 175, 80, 0.7)';
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = '#4CAF50';
    }
    ctx.lineWidth = 2;

    // Draw the curved line
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
    ctx.stroke();

    // Reset dash pattern
    ctx.setLineDash([]);

    // Draw small circles at the connection points
    ctx.beginPath();
    ctx.arc(startX, startY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#4CAF50';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(endX, endY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#4CAF50';
    ctx.fill();

    // Draw arrow at the end
    const arrowSize = 8;

    // Calculate the angle at the end of the curve
    // For a bezier curve, we can approximate the tangent at the end point
    const tangentX = endX - cp2x;
    const tangentY = endY - cp2y;
    const angle = Math.atan2(tangentY, tangentX);

    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowSize * Math.cos(angle - Math.PI / 6),
      endY - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      endX - arrowSize * Math.cos(angle + Math.PI / 6),
      endY - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = '#4CAF50';
    ctx.fill();

    // Draw the relationship label in the middle of the curve
    const midX = (startX + endX) / 2 + perpX;
    const midY = (startY + endY) / 2 + perpY;

    ctx.font = '10px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw a small background for the text
    const text = `${mapping.sourceField} → ${mapping.targetField}`;
    const textWidth = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(midX - textWidth/2 - 3, midY - 8, textWidth + 6, 16);

    // Draw the text
    ctx.fillStyle = '#333';
    ctx.fillText(text, midX, midY);
  };

  // Remove a mapping
  const removeMapping = (mappingId) => {
    setMappings(prev => prev.filter(mapping => mapping.id !== mappingId));
  };

  // Save the current mapping configuration
  const saveMapping = () => {
    if (!mappingName.trim()) {
      setError('Please enter a name for this mapping');
      return;
    }

    if (mappings.length === 0) {
      setError('Please create at least one field mapping');
      return;
    }

    const newMapping = {
      id: activeMappingId || `saved-${Date.now()}`,
      name: mappingName,
      collections: selectedCollections,
      mappings: mappings
    };

    if (activeMappingId) {
      // Update existing mapping
      setSavedMappings(prev => prev.map(m => m.id === activeMappingId ? newMapping : m));
    } else {
      // Add new mapping
      setSavedMappings(prev => [...prev, newMapping]);
    }

    // Reset the form
    setActiveMappingId(null);
    setMappingName('');
    setError('');
  };

  // Load a saved mapping
  const loadMapping = (mappingId) => {
    const mapping = savedMappings.find(m => m.id === mappingId);
    if (!mapping) return;

    setSelectedCollections(mapping.collections);
    setMappings(mapping.mappings);
    setMappingName(mapping.name);
    setActiveMappingId(mapping.id);

    // Fetch fields for all collections
    mapping.collections.forEach(collectionId => {
      fetchCollectionFields(collectionId);
    });
  };

  // Delete a saved mapping
  const deleteMapping = (mappingId) => {
    setSavedMappings(prev => prev.filter(m => m.id !== mappingId));

    if (activeMappingId === mappingId) {
      setActiveMappingId(null);
      setMappingName('');
    }
  };

  // Reset the current mapping
  const resetMapping = () => {
    setMappings([]);
    setActiveMappingId(null);
    setMappingName('');
  };

  // Submit the query to the LLM
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    if (mappings.length === 0) {
      setError('Please create at least one field mapping');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Prepare the mapping information for the API
      const mappingInfo = {
        collections: selectedCollections,
        relationships: mappings.map(mapping => ({
          sourceCollection: mapping.sourceCollection,
          sourceField: mapping.sourceField,
          targetCollection: mapping.targetCollection,
          targetField: mapping.targetField
        }))
      };

      // Create debug info object
      const debugInfo = {
        originalQuery: query,
        mappingInfo
      };

      // Set debug info for display
      setQueryDebugInfo(debugInfo);

      // Call the API with the query and mapping information
      const response = await axios.post('/api/query/relationship', {
        query,
        primaryCollection: selectedCollections[0],
        relatedCollection: selectedCollections.slice(1),
        mappingInfo,
        schemaInfo: Object.fromEntries(
          selectedCollections.map(collection => [
            collection,
            { fields: collectionFields[collection] || [] }
          ])
        )
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Update debug info with the API response
      setQueryDebugInfo({
        ...debugInfo,
        processedQuery: response.data.processedQuery,
        mongoDBQuery: response.data.pipeline,
        explanation: response.data.explanation,
        message: response.data.message,
        tokenUsage: response.data.tokenUsage
      });

      const results = response.data.results || [];
      setResults(results);
    } catch (err) {
      setError('Query failed: ' + (err.response?.data?.message || err.message));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Resize the canvas when the window size changes
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && canvasContainerRef.current) {
        canvasRef.current.width = canvasContainerRef.current.offsetWidth;
        canvasRef.current.height = canvasContainerRef.current.offsetHeight;
        drawCanvas();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Redraw the canvas when mappings change
  useEffect(() => {
    drawCanvas();
  }, [mappings, selectedCollections]);

  return (
    <div className="relationship-mapper">
      <div className="card-header">
        <h2 className="card-title">Relationship Mapper</h2>
        <p className="subtitle">Create custom field mappings between collections and query using natural language</p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="mapping-controls">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="mapping-name">Mapping Name:</label>
            <input
              type="text"
              id="mapping-name"
              value={mappingName}
              onChange={(e) => setMappingName(e.target.value)}
              placeholder="Enter a name for this mapping"
              className="text-input"
            />
          </div>

          <div className="button-group">
            <button
              onClick={saveMapping}
              className="button button-primary"
              disabled={!mappingName.trim() || mappings.length === 0}
            >
              {activeMappingId ? 'Update Mapping' : 'Save Mapping'}
            </button>

            <button
              onClick={resetMapping}
              className="button button-secondary"
              disabled={mappings.length === 0}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="saved-mappings">
        <h3>Saved Mappings</h3>
        {savedMappings.length === 0 ? (
          <p className="no-mappings">No saved mappings yet. Create and save a mapping to see it here.</p>
        ) : (
          <div className="mapping-list">
            {savedMappings.map(mapping => (
              <div key={mapping.id} className={`mapping-item ${activeMappingId === mapping.id ? 'active' : ''}`}>
                <div className="mapping-item-name">{mapping.name}</div>
                <div className="mapping-item-info">
                  <span>{mapping.collections.length} collections</span>
                  <span>{mapping.mappings.length} mappings</span>
                </div>
                <div className="mapping-item-actions">
                  <button
                    onClick={() => loadMapping(mapping.id)}
                    className="button button-small"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deleteMapping(mapping.id)}
                    className="button button-small button-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="collection-selector">
        <h3>Select Collections</h3>
        <div className="collection-list">
          {collections.map(collection => (
            <button
              key={collection.id}
              onClick={() => selectedCollections.includes(collection.id)
                ? removeCollection(collection.id)
                : addCollection(collection.id)
              }
              className={`collection-button ${selectedCollections.includes(collection.id) ? 'selected' : ''}`}
              disabled={loading}
            >
              {collection.name}
              {selectedCollections.includes(collection.id) && (
                <span className="remove-icon">×</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedCollections.length > 0 && (
        <div className="mapping-workspace">
          <h3>Field Mapping</h3>
          <p className="mapping-instructions">
            Select fields to create relationships between collections. View sample data in the preview tables to help identify matching fields.
            {selectedSourceField ? (
              <span className="active-selection-note">
                Currently selected: <strong>{selectedSourceField.collectionId}.{selectedSourceField.fieldName}</strong> - Click on a field in another collection to complete the mapping.
              </span>
            ) : (
              <span className="mapping-hint">
                Click on a field in any collection to start creating a relationship.
              </span>
            )}
          </p>

          <div
            className="canvas-container"
            ref={canvasContainerRef}
          >
            <canvas
              ref={canvasRef}
              className="mapping-canvas"
            />

            <div className="mapping-layout-container">
              {selectedCollections.map(collectionId => (
                <div key={collectionId} className="collection-preview-row">
                  {/* Collection Fields Panel */}
                  <div className="collection-panel">
                    <div className="collection-card">
                      <div className="collection-header">
                        <h4>{collections.find(c => c.id === collectionId)?.name || collectionId}</h4>
                        <button
                          onClick={() => removeCollection(collectionId)}
                          className="remove-collection-button"
                        >
                          ×
                        </button>
                      </div>

                      <div className="collection-fields">
                        {loading && !collectionFields[collectionId] ? (
                          <div className="loading-fields">Loading fields...</div>
                        ) : (
                          (collectionFields[collectionId] || []).map(field => (
                            <div
                              key={`${collectionId}-${field}`}
                              className={`field-item ${
                                selectedSourceField &&
                                selectedSourceField.collectionId === collectionId &&
                                selectedSourceField.fieldName === field ? 'selected' : ''
                              } ${
                                hoveredField &&
                                hoveredField.collectionId === collectionId &&
                                hoveredField.fieldName === field ? 'hovered' : ''
                              }`}
                              data-field={`${collectionId}-${field}`}
                              onClick={(e) => handleFieldClick(collectionId, field, e.currentTarget)}
                              onMouseEnter={(e) => handleFieldHover(collectionId, field, e.currentTarget)}
                              onMouseLeave={handleFieldLeave}
                            >
                              {field}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Data Preview Panel */}
                  <div className="preview-panel">
                    <div className="data-preview-card">
                      <div className="preview-header">
                        <h4>Preview: {collections.find(c => c.id === collectionId)?.name || collectionId}</h4>
                        <div className="preview-controls">
                          <span className="record-count">
                            {sampleCounts[collectionId] || 0} records
                          </span>
                          <button
                            onClick={() => loadMoreSamples(collectionId)}
                            className="load-more-button"
                            disabled={loading || loadingMore[collectionId]}
                          >
                            {loadingMore[collectionId] ? 'Loading...' : 'Load More'}
                          </button>
                        </div>
                      </div>

                      <div className="preview-table-container">
                        {loading && !collectionSamples[collectionId] ? (
                          <div className="loading-preview">Loading sample data...</div>
                        ) : collectionSamples[collectionId]?.length > 0 ? (
                          <div className="table-scroll-container">
                            <table className="preview-table">
                              <thead>
                                <tr>
                                  {Object.keys(collectionSamples[collectionId][0] || {}).map(key => (
                                    <th
                                      key={key}
                                      className={`${
                                        selectedSourceField &&
                                        selectedSourceField.collectionId === collectionId &&
                                        selectedSourceField.fieldName === key ? 'selected' : ''
                                      }`}
                                    >
                                      {key}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {collectionSamples[collectionId].map((doc, index) => (
                                  <tr key={index}>
                                    {Object.entries(doc).map(([key, value]) => (
                                      <td
                                        key={`${index}-${key}`}
                                        className={`${
                                          selectedSourceField &&
                                          selectedSourceField.collectionId === collectionId &&
                                          selectedSourceField.fieldName === key ? 'selected' : ''
                                        }`}
                                      >
                                        {typeof value === 'object' ?
                                          JSON.stringify(value).substring(0, 30) + (JSON.stringify(value).length > 30 ? '...' : '') :
                                          String(value).substring(0, 30) + (String(value).length > 30 ? '...' : '')}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="no-preview">No sample data available</div>
                        )}

                        {loadingMore[collectionId] && (
                          <div className="loading-more-indicator">Loading more records...</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {mappings.length > 0 && (
            <div className="mappings-list">
              <h3>Current Mappings</h3>
              <table className="mappings-table">
                <thead>
                  <tr>
                    <th>Source Collection</th>
                    <th>Source Field</th>
                    <th>Target Collection</th>
                    <th>Target Field</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map(mapping => (
                    <tr key={mapping.id}>
                      <td>{collections.find(c => c.id === mapping.sourceCollection)?.name || mapping.sourceCollection}</td>
                      <td>{mapping.sourceField}</td>
                      <td>{collections.find(c => c.id === mapping.targetCollection)?.name || mapping.targetCollection}</td>
                      <td>{mapping.targetField}</td>
                      <td>
                        <button
                          onClick={() => removeMapping(mapping.id)}
                          className="button button-small button-danger"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="query-section">
            <h3>Query Using Defined Relationships</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="relationship-query">Natural Language Query:</label>
                <textarea
                  id="relationship-query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., Find all players who collected items in the Living Room zone"
                  className="textarea-input"
                  rows={3}
                  disabled={loading || mappings.length === 0}
                />
              </div>

              <button
                type="submit"
                className="button button-primary"
                disabled={loading || !token || mappings.length === 0 || !query.trim()}
              >
                {loading ? 'Processing...' : 'Execute Query'}
              </button>
            </form>
          </div>

          {/* Debug Information Panel */}
          {queryDebugInfo && (
            <div className="debug-panel">
              <h3 className="debug-title">
                Query Debug Information
                {queryDebugInfo.tokenUsage && (
                  <span className="llm-badge">Processed by Deepseek LLM</span>
                )}
              </h3>
              <div className="debug-content">
                <div className="debug-section">
                  <h4>Original Query</h4>
                  <pre>{queryDebugInfo.originalQuery}</pre>
                </div>

                <div className="debug-section">
                  <h4>Mapping Information</h4>
                  <pre>{JSON.stringify(queryDebugInfo.mappingInfo, null, 2)}</pre>
                </div>

                {queryDebugInfo.processedQuery && (
                  <div className="debug-section">
                    <h4>Processed Query</h4>
                    <pre>{JSON.stringify(queryDebugInfo.processedQuery, null, 2)}</pre>
                  </div>
                )}

                {queryDebugInfo.mongoDBQuery && (
                  <div className="debug-section">
                    <h4>MongoDB Query</h4>
                    <pre>{JSON.stringify(queryDebugInfo.mongoDBQuery, null, 2)}</pre>
                  </div>
                )}

                {queryDebugInfo.explanation && (
                  <div className="debug-section">
                    <h4>Explanation</h4>
                    <p>{queryDebugInfo.explanation}</p>
                  </div>
                )}

                {queryDebugInfo.message && (
                  <div className="debug-section message-section">
                    <h4>Message</h4>
                    <p className="query-message">{queryDebugInfo.message}</p>
                  </div>
                )}

                {queryDebugInfo.tokenUsage && (
                  <div className="debug-section">
                    <h4>Deepseek Token Usage</h4>
                    <pre>{JSON.stringify(queryDebugInfo.tokenUsage, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {results.length > 0 ? (
            <div className="results-container">
              <div className="results-header">
                <h3>Results ({results.length})</h3>
                {results.length > 10 && (
                  <span className="more-results">Showing 10 of {results.length} results</span>
                )}
              </div>

              <div className="results-table-container">
                <table className="results-table">
                  <thead>
                    <tr>
                      {Object.keys(results[0]).map(key => (
                        <th key={key}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.slice(0, 10).map((result, index) => (
                      <tr key={index}>
                        {Object.values(result).map((value, i) => (
                          <td key={i}>
                            {typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            !loading && queryDebugInfo && (
              <div className="no-results">
                {queryDebugInfo.message || 'No results found for your query'}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default RelationshipMapper;
