import React from 'react';
import { Modal, Button, Badge, Card } from 'react-bootstrap';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';

const QueryPatternModal = ({ show, onHide, pattern }) => {
  if (!pattern) return null;

  // Format the MongoDB query as a string
  const formatMongoQuery = (query) => {
    if (!query) return 'No query available';
    
    try {
      return JSON.stringify(query, null, 2);
    } catch (error) {
      return 'Error formatting query';
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Query Pattern Details</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <h4>{pattern.description || 'Unnamed Pattern'}</h4>
        
        <div className="mb-3">
          <Badge bg="primary" className="me-1">{pattern.id || 'No ID'}</Badge>
          <Badge bg="secondary" className="me-1">{pattern.complexity || 'unknown'}</Badge>
          <Badge bg="info" className="me-1">{pattern.category || 'uncategorized'}</Badge>
          {pattern.optimized && <Badge bg="success">optimized</Badge>}
        </div>
        
        <div className="mb-3">
          <strong>Collections:</strong> {pattern.collections ? pattern.collections.join(', ') : 'N/A'}
        </div>
        
        <Card className="mb-3">
          <Card.Header>MongoDB Query</Card.Header>
          <Card.Body>
            <SyntaxHighlighter language="json" style={docco}>
              {formatMongoQuery(pattern.mongoQuery)}
            </SyntaxHighlighter>
          </Card.Body>
        </Card>
        
        {pattern.template && (
          <Card>
            <Card.Header>Template</Card.Header>
            <Card.Body>
              <SyntaxHighlighter language="json" style={docco}>
                {pattern.template}
              </SyntaxHighlighter>
            </Card.Body>
          </Card>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default QueryPatternModal;
