import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Container, Row, Col, Card, Badge, 
  ListGroup, Alert, Spinner, 
  ProgressBar, Tabs, Tab
} from 'react-bootstrap';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import ForceGraph2D from 'react-force-graph-2d';
import QueryPatternModal from './QueryPatternModal';

const SelfLearningDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [queryPatterns, setQueryPatterns] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [showPatternModal, setShowPatternModal] = useState(false);
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch all dashboard data in a single request
        const dashboardResponse = await axios.get('/api/dashboard/data');
        const data = dashboardResponse.data;
        
        setDashboardData(data);
        setRelationships(data.relationships || []);
        setQueryPatterns(data.queryPatterns || []);
        setQuestions(data.questions || []);
        
        // Prepare graph data
        if (data.relationships && data.relationships.length > 0) {
          prepareGraphData(data.relationships);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);
  
  // Prepare graph data for visualization
  const prepareGraphData = (relationshipsData) => {
    const nodes = new Map();
    const links = [];
    
    // Add nodes for each collection
    relationshipsData.forEach(rel => {
      if (rel.source && rel.source.collection) {
        if (!nodes.has(rel.source.collection)) {
          nodes.set(rel.source.collection, {
            id: rel.source.collection,
            name: rel.source.collection,
            val: 1
          });
        } else {
          const node = nodes.get(rel.source.collection);
          node.val += 1;
          nodes.set(rel.source.collection, node);
        }
      }
      
      if (rel.target && rel.target.collection) {
        if (!nodes.has(rel.target.collection)) {
          nodes.set(rel.target.collection, {
            id: rel.target.collection,
            name: rel.target.collection,
            val: 1
          });
        } else {
          const node = nodes.get(rel.target.collection);
          node.val += 1;
          nodes.set(rel.target.collection, node);
        }
      }
      
      // Add link
      if (rel.source && rel.source.collection && rel.target && rel.target.collection) {
        links.push({
          source: rel.source.collection,
          target: rel.target.collection,
          label: `${rel.source.field} → ${rel.target.field}`,
          value: rel.confidence || 1
        });
      }
    });
    
    setGraphData({
      nodes: Array.from(nodes.values()),
      links
    });
  };
  
  // Prepare chart data for pattern categories
  const preparePatternCategoryData = () => {
    if (!queryPatterns || queryPatterns.length === 0) return [];
    
    const categories = {};
    
    queryPatterns.forEach(pattern => {
      const category = pattern.category || 'uncategorized';
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  };
  
  // Prepare chart data for pattern complexity
  const preparePatternComplexityData = () => {
    if (!queryPatterns || queryPatterns.length === 0) return [];
    
    const complexities = {};
    
    queryPatterns.forEach(pattern => {
      const complexity = pattern.complexity || 'unknown';
      complexities[complexity] = (complexities[complexity] || 0) + 1;
    });
    
    return Object.entries(complexities).map(([name, value]) => ({ name, value }));
  };
  
  // Prepare chart data for query success rates
  const prepareQuerySuccessData = () => {
    if (!dashboardData || !dashboardData.summary) return [];
    
    const { successfulQueries, failedQueries, timeoutQueries } = dashboardData.summary;
    
    return [
      { name: 'Successful', value: successfulQueries || 0 },
      { name: 'Failed', value: failedQueries || 0 },
      { name: 'Timeout', value: timeoutQueries || 0 }
    ];
  };
  
  // Handle opening the pattern details modal
  const handleViewPatternDetails = (pattern) => {
    setSelectedPattern(pattern);
    setShowPatternModal(true);
  };
  
  // Render loading spinner
  if (loading) {
    return (
      <Container className="mt-4 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-2">Loading dashboard data...</p>
      </Container>
    );
  }
  
  // Render error message
  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
        </Alert>
      </Container>
    );
  }
  
  // If no data is available yet
  if (!dashboardData || !dashboardData.summary) {
    return (
      <Container className="mt-4">
        <Alert variant="info">
          <Alert.Heading>No Data Available</Alert.Heading>
          <p>The self-learning process hasn't generated any data yet. Please run the self-learning process first.</p>
        </Alert>
      </Container>
    );
  }
  
  const { summary } = dashboardData;
  
  return (
    <Container fluid className="mt-4">
      <h2>Self-Learning Dashboard</h2>
      <p className="text-muted">
        Last updated: {new Date(summary.lastUpdated || summary.lastRunTimestamp).toLocaleString()}
      </p>
      
      <Tabs defaultActiveKey="overview" className="mb-3">
        {/* Overview Tab */}
        <Tab eventKey="overview" title="Overview">
          <Row className="mb-4">
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>Collections</Card.Title>
                  <h2>{summary.collections || summary.totalCollections || 0}</h2>
                  <Card.Text>
                    Database collections analyzed
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>Relationships</Card.Title>
                  <h2>{summary.relationships || summary.totalRelationships || 0}</h2>
                  <Card.Text>
                    Discovered between collections
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>Query Patterns</Card.Title>
                  <h2>{summary.queryPatterns || summary.totalQueryPatterns || 0}</h2>
                  <Card.Text>
                    Reusable query templates
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>Questions</Card.Title>
                  <h2>{summary.questions || summary.totalQuestions || 0}</h2>
                  <Card.Text>
                    Sample questions generated
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          
          <Row className="mb-4">
            <Col md={6}>
              <Card className="h-100">
                <Card.Header>Query Success Rate</Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={prepareQuerySuccessData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {prepareQuerySuccessData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} queries`, null]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Card.Body>
                <Card.Footer className="text-muted">
                  Total Queries: {(summary.successfulQueries || 0) + (summary.failedQueries || 0) + (summary.timeoutQueries || 0)}
                </Card.Footer>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="h-100">
                <Card.Header>Query Patterns by Category</Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={preparePatternCategoryData()}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" name="Count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          
          <Row className="mb-4">
            <Col md={6}>
              <Card className="h-100">
                <Card.Header>Query Patterns by Complexity</Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={preparePatternComplexityData()}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" name="Count" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="h-100">
                <Card.Header>Performance Metrics</Card.Header>
                <Card.Body>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between">
                      <span>Query Success Rate</span>
                      <span>
                        {summary.successfulQueries || 0} / {summary.questions || summary.totalQuestions || 0} 
                        ({((summary.successfulQueries || 0) / (summary.questions || summary.totalQuestions || 1) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <ProgressBar 
                      now={((summary.successfulQueries || 0) / (summary.questions || summary.totalQuestions || 1)) * 100} 
                      variant="success" 
                    />
                  </div>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between">
                      <span>Query Optimization Rate</span>
                      <span>
                        {summary.optimizedQueries || 0} / {summary.successfulQueries || 1}
                        ({((summary.optimizedQueries || 0) / (summary.successfulQueries || 1) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <ProgressBar 
                      now={((summary.optimizedQueries || 0) / (summary.successfulQueries || 1)) * 100} 
                      variant="info" 
                    />
                  </div>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between">
                      <span>Query Timeout Rate</span>
                      <span>
                        {summary.timeoutQueries || 0} / {summary.questions || summary.totalQuestions || 1}
                        ({((summary.timeoutQueries || 0) / (summary.questions || summary.totalQuestions || 1) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <ProgressBar 
                      now={((summary.timeoutQueries || 0) / (summary.questions || summary.totalQuestions || 1)) * 100} 
                      variant="warning" 
                    />
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>
        
        {/* Relationships Tab */}
        <Tab eventKey="relationships" title="Relationships">
          <Row className="mb-4">
            <Col md={12}>
              <Card>
                <Card.Header>Collection Relationships</Card.Header>
                <Card.Body style={{ height: '600px' }}>
                  {graphData.nodes.length > 0 ? (
                    <ForceGraph2D
                      graphData={graphData}
                      nodeLabel="name"
                      linkLabel="label"
                      nodeCanvasObject={(node, ctx, globalScale) => {
                        const label = node.name;
                        const fontSize = 16/globalScale;
                        ctx.font = `${fontSize}px Sans-Serif`;
                        const textWidth = ctx.measureText(label).width;
                        const bgDimensions = [textWidth, fontSize].map(n => n + 8);
                        
                        // Draw node circle
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
                        ctx.fillStyle = '#8884d8';
                        ctx.fill();
                        
                        // Draw text background
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                        ctx.fillRect(
                          node.x - bgDimensions[0] / 2,
                          node.y - bgDimensions[1] / 2,
                          bgDimensions[0],
                          bgDimensions[1]
                        );
                        
                        // Draw text
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = '#333';
                        ctx.fillText(label, node.x, node.y);
                      }}
                    />
                  ) : (
                    <div className="d-flex justify-content-center align-items-center h-100">
                      <p>No relationship data available</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
          
          <Row className="mb-4">
            <Col md={12}>
              <Card>
                <Card.Header>Relationship Details</Card.Header>
                <Card.Body style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <ListGroup>
                    {relationships.length > 0 ? (
                      relationships.map((rel, index) => (
                        <ListGroup.Item key={index}>
                          {rel.type === 'multi-level' ? (
                            <div>
                              <Badge bg="primary" className="me-2">Multi-Level</Badge>
                              <strong>
                                {rel.path && rel.path.length >= 2 ? 
                                  `${rel.path[0].source.collection} → ${rel.path[0].target.collection} → ${rel.path[1].target.collection}` : 
                                  'Invalid path'}
                              </strong>
                              <div className="text-muted small mt-1">
                                {rel.description}
                              </div>
                              <div className="mt-1">
                                <Badge bg="info" className="me-1">
                                  {rel.path && rel.path.length >= 1 ? 
                                    `${rel.path[0].source.field} → ${rel.path[0].target.field}` : ''}
                                </Badge>
                                <Badge bg="info">
                                  {rel.path && rel.path.length >= 2 ? 
                                    `${rel.path[1].source.field} → ${rel.path[1].target.field}` : ''}
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <Badge bg="secondary" className="me-2">Direct</Badge>
                              <strong>
                                {rel.source && rel.target ? 
                                  `${rel.source.collection} → ${rel.target.collection}` : 
                                  'Invalid relationship'}
                              </strong>
                              <div className="text-muted small mt-1">
                                {rel.description}
                              </div>
                              <div className="mt-1">
                                <Badge bg="info" className="me-1">
                                  {rel.source && rel.target ? 
                                    `${rel.source.field} → ${rel.target.field}` : ''}
                                </Badge>
                                {rel.confidence && (
                                  <Badge bg="success">
                                    Confidence: {(rel.confidence * 100).toFixed(0)}%
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </ListGroup.Item>
                      ))
                    ) : (
                      <ListGroup.Item>No relationships found</ListGroup.Item>
                    )}
                  </ListGroup>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>
        
        {/* Query Patterns Tab */}
        <Tab eventKey="patterns" title="Query Patterns">
          <Row className="mb-4">
            <Col md={12}>
              <Card>
                <Card.Header>
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Query Patterns</span>
                    <span className="text-muted">Total: {queryPatterns.length}</span>
                  </div>
                </Card.Header>
                <Card.Body style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <ListGroup>
                    {queryPatterns.length > 0 ? (
                      queryPatterns.map((pattern, index) => (
                        <ListGroup.Item key={index}>
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <h5>{pattern.description || 'Unnamed Pattern'}</h5>
                              <div>
                                <Badge bg="primary" className="me-1">
                                  {pattern.type || 'unknown'}
                                </Badge>
                                <Badge bg="secondary" className="me-1">
                                  {pattern.complexity || 'unknown'}
                                </Badge>
                                <Badge bg="info" className="me-1">
                                  {pattern.category || 'uncategorized'}
                                </Badge>
                                {pattern.optimized && (
                                  <Badge bg="success">optimized</Badge>
                                )}
                              </div>
                              <div className="text-muted small mt-2">
                                Collections: {pattern.collections ? pattern.collections.join(', ') : 'N/A'}
                              </div>
                            </div>
                            <div>
                              <button 
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => handleViewPatternDetails(pattern)}
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        </ListGroup.Item>
                      ))
                    ) : (
                      <ListGroup.Item>No query patterns found</ListGroup.Item>
                    )}
                  </ListGroup>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>
        
        {/* Sample Questions Tab */}
        <Tab eventKey="questions" title="Sample Questions">
          <Row className="mb-4">
            <Col md={12}>
              <Card>
                <Card.Header>
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Sample Questions</span>
                    <span className="text-muted">Showing: {questions.length} of {summary.questions || summary.totalQuestions || 0}</span>
                  </div>
                </Card.Header>
                <Card.Body style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <ListGroup>
                    {questions.length > 0 ? (
                      questions.map((question, index) => (
                        <ListGroup.Item key={index}>
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <h5>{question.text}</h5>
                              <div>
                                {question.execution && question.execution.success ? (
                                  <Badge bg="success" className="me-1">Successful</Badge>
                                ) : (
                                  <Badge bg="danger" className="me-1">Failed</Badge>
                                )}
                                {question.collections && (
                                  <Badge bg="info" className="me-1">
                                    {question.collections.join(', ')}
                                  </Badge>
                                )}
                                {question.intent && (
                                  <Badge bg="secondary">
                                    {question.intent}
                                  </Badge>
                                )}
                              </div>
                              {question.execution && (
                                <div className="text-muted small mt-2">
                                  {question.execution.resultCount !== undefined && (
                                    <span className="me-2">Results: {question.execution.resultCount}</span>
                                  )}
                                  {question.execution.executionTime !== undefined && (
                                    <span>Time: {question.execution.executionTime}ms</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div>
                              <button 
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => {
                                  // Find the pattern for this question
                                  const pattern = queryPatterns.find(p => p.id === question.queryPattern);
                                  if (pattern) {
                                    handleViewPatternDetails(pattern);
                                  } else {
                                    alert(`Question: ${question.text}\n\nPattern: ${question.queryPattern || 'No pattern'}`);
                                  }
                                }}
                              >
                                Run Query
                              </button>
                            </div>
                          </div>
                        </ListGroup.Item>
                      ))
                    ) : (
                      <ListGroup.Item>No sample questions found</ListGroup.Item>
                    )}
                  </ListGroup>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>
      </Tabs>
      
      {/* Query Pattern Modal */}
      <QueryPatternModal 
        show={showPatternModal} 
        onHide={() => setShowPatternModal(false)} 
        pattern={selectedPattern} 
      />
    </Container>
  );
};

export default SelfLearningDashboard;
