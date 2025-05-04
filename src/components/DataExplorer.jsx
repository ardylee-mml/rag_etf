import { useState, useEffect } from 'react';
import axios from 'axios';

function DataExplorer({ token, collections }) {
  const [selectedCollection, setSelectedCollection] = useState('players');
  const [sampleData, setSampleData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [collectionStats, setCollectionStats] = useState({});

  useEffect(() => {
    if (token) {
      fetchSampleData();
    }
  }, [selectedCollection, token]);

  // No mock data handler - we always use the real API

  const fetchSampleData = async () => {
    try {
      setLoading(true);
      setError('');

      // Always use real API
      const response = await axios.post('/api/query', {
        query: `Show me a sample of ${selectedCollection}`,
        collection: selectedCollection,
        schemaInfo: {
          // Provide correct field mappings based on collection relationships
          players: { idField: 'playerId' },
          events: {
            playerIdField: 'playerId',
            itemIdField: 'context.itemId',
            zoneIdField: 'context.zoneId',
            questionIdField: 'context.questionId'
          },
          items: { idField: '_id' },
          zones: { idField: '_id' },
          questions: { idField: '_id' },
          leaderboards: { playerIdField: 'playerId' }
        }
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const results = response.data.results || [];

      setSampleData(results);

      // Calculate basic stats
      if (results && results.length > 0) {
        const stats = calculateStats(results);
        setCollectionStats(stats);
      }
    } catch (err) {
      setError('Failed to fetch data: ' + (err.response?.data?.message || err.message));
      setSampleData([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    const stats = {
      count: data.length,
      fields: Object.keys(data[0]).length,
      fieldTypes: {}
    };

    // Analyze field types
    if (data.length > 0) {
      const sample = data[0];
      for (const [key, value] of Object.entries(sample)) {
        stats.fieldTypes[key] = typeof value;
      }
    }

    return stats;
  };

  const getCollectionDescription = (collectionId) => {
    const descriptions = {
      players: "Player profiles with information like name, region, language preferences",
      events: "Records of all player activities in the game (item interactions, zone movements, etc.)",
      zones: "Key areas within the game that players can navigate through",
      items: "Collectible or interactive objects in the game",
      questions: "Questions presented to players during gameplay",
      leaderboards: "Player rankings and scores organized by stages",
      campaigns: "Game campaigns with objectives and targets",
      checkpoints: "Progress tracking points in the game"
    };

    return descriptions[collectionId] || "No description available";
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Data Explorer</h2>
      </div>

      <div className="card-content">
        {error && <div className="error">{error}</div>}

        <div className="form-group">
          <label htmlFor="collection-select">Select Collection:</label>
          <select
            id="collection-select"
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className="select-input"
          >
            {collections.map(col => (
              <option key={col.id} value={col.id}>{col.name} ({col.count.toLocaleString()} documents)</option>
            ))}
          </select>
        </div>

        <div className="section">
          <h3 className="section-title">Collection: {selectedCollection}</h3>
          <p className="section-description">{getCollectionDescription(selectedCollection)}</p>

          {Object.keys(collectionStats).length > 0 && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-title">Document Count</div>
                <div className="stat-value">{collectionStats.count}</div>
                <div className="stat-description">Sample size</div>
              </div>

              <div className="stat-card">
                <div className="stat-title">Fields</div>
                <div className="stat-value">{collectionStats.fields}</div>
                <div className="stat-description">Properties per document</div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="loading-indicator">Loading...</div>
        ) : sampleData.length > 0 ? (
          <div className="results-container">
            <h3 className="section-title">Sample Data</h3>
            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    {Object.keys(sampleData[0]).map(key => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleData.slice(0, 5).map((item, index) => (
                    <tr key={index}>
                      {Object.values(item).map((value, i) => (
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
          <div className="no-results">No data available</div>
        )}
      </div>
    </div>
  );
}

export default DataExplorer;
