import React, { useState, useEffect } from 'react';
import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import classNames from 'classnames';

const SchemaExplorer = ({ selectedCollection, onCollectionSelect }) => {
    const [collections, setCollections] = useState([]);
    const [expandedCollections, setExpandedCollections] = useState({});
    const [schemas, setSchemas] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchCollections();
    }, []);

    const fetchCollections = async () => {
        try {
            const response = await fetch('/api/collections');
            const data = await response.json();
            setCollections(data);
            setLoading(false);
        } catch (error) {
            setError('Failed to load collections');
            setLoading(false);
        }
    };

    const fetchSchema = async (collectionName) => {
        if (schemas[collectionName]) return;

        try {
            const response = await fetch(`/api/schema/${collectionName}`);
            const data = await response.json();
            setSchemas(prev => ({
                ...prev,
                [collectionName]: data
            }));
        } catch (error) {
            console.error(`Failed to load schema for ${collectionName}:`, error);
        }
    };

    const toggleCollection = async (collectionName) => {
        setExpandedCollections(prev => ({
            ...prev,
            [collectionName]: !prev[collectionName]
        }));

        if (!schemas[collectionName]) {
            await fetchSchema(collectionName);
        }
    };

    const renderField = (field) => {
        const isRequired = field.required;
        const isSensitive = field.name.toLowerCase().includes('password') || 
                           field.name.toLowerCase().includes('secret') ||
                           field.name.toLowerCase().includes('token');

        return (
            <div 
                key={field.name}
                className="pl-8 py-1 text-sm flex items-center gap-2"
            >
                <span className={classNames(
                    'w-2 h-2 rounded-full',
                    {
                        'bg-blue-500': isRequired,
                        'bg-gray-300': !isRequired,
                        'bg-red-500': isSensitive
                    }
                )} />
                <span className="text-gray-700">{field.name}</span>
                <span className="text-gray-400 text-xs">
                    ({field.types.join(' | ')})
                </span>
                {isRequired && (
                    <span className="text-blue-500 text-xs">required</span>
                )}
                {isSensitive && (
                    <span className="text-red-500 text-xs">sensitive</span>
                )}
            </div>
        );
    };

    const renderRelationship = (relationship) => (
        <div 
            key={relationship.field}
            className="pl-8 py-1 text-sm flex items-center gap-2"
        >
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-gray-700">{relationship.field}</span>
            <span className="text-purple-500 text-xs">
                {relationship.type}
            </span>
        </div>
    );

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-red-500">
                {error}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="mb-4">
                <h2 className="text-lg font-medium text-gray-900">Collections</h2>
                <p className="text-sm text-gray-500">
                    Select a collection to query
                </p>
            </div>

            <div className="flex-1 overflow-y-auto">
                {collections.map(collection => (
                    <div key={collection} className="mb-2">
                        <button
                            onClick={() => toggleCollection(collection)}
                            className={classNames(
                                'w-full px-3 py-2 text-left rounded-lg flex items-center gap-2',
                                {
                                    'bg-blue-50': selectedCollection === collection,
                                    'hover:bg-gray-50': selectedCollection !== collection
                                }
                            )}
                        >
                            {expandedCollections[collection] ? (
                                <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                            ) : (
                                <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                            )}
                            <span 
                                className={classNames(
                                    'text-sm font-medium',
                                    selectedCollection === collection ? 'text-blue-700' : 'text-gray-700'
                                )}
                            >
                                {collection}
                            </span>
                        </button>

                        {expandedCollections[collection] && schemas[collection] && (
                            <div className="mt-1 mb-3">
                                {schemas[collection].fields.map(renderField)}
                                {schemas[collection].relationships.map(renderRelationship)}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs text-gray-600">Required Field</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs text-gray-600">Sensitive Field</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-xs text-gray-600">Relationship</span>
                </div>
            </div>
        </div>
    );
};

export default SchemaExplorer; 