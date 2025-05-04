import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, TableCellsIcon, CodeBracketIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import classNames from 'classnames';
import ReactJson from 'react-json-view';
import { useTable } from '@tanstack/react-table';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import SchemaExplorer from './SchemaExplorer';

const ChatInterface = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState('chat'); // chat, json, or table
    const [selectedCollection, setSelectedCollection] = useState('');
    const [conversationId, setConversationId] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || !selectedCollection) return;

        const newMessage = {
            id: Date.now(),
            type: 'user',
            content: input,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, newMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: input,
                    collection: selectedCollection,
                    conversationId
                }),
            });

            const data = await response.json();
            
            if (!conversationId && data.conversationId) {
                setConversationId(data.conversationId);
            }

            const aiMessage = {
                id: Date.now() + 1,
                type: 'assistant',
                content: data.content,
                metadata: {
                    queryType: data.queryType,
                    pipeline: data.pipeline,
                    results: data.results,
                    tokenUsage: data.tokenUsage,
                    safetyCheck: data.safetyCheck
                },
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            const errorMessage = {
                id: Date.now() + 1,
                type: 'error',
                content: 'Failed to process query. Please try again.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const renderMessage = (message) => {
        const isUser = message.type === 'user';
        const isError = message.type === 'error';

        return (
            <div
                key={message.id}
                className={classNames(
                    'mb-4 p-4 rounded-lg max-w-3xl',
                    {
                        'ml-auto bg-blue-100': isUser,
                        'mr-auto bg-gray-100': !isUser && !isError,
                        'mr-auto bg-red-100': isError
                    }
                )}
            >
                <div className="flex items-start gap-2">
                    <div className="flex-grow">
                        <div className="text-sm text-gray-600 mb-1">
                            {isUser ? 'You' : (isError ? 'Error' : 'Assistant')}
                        </div>
                        <div className="text-gray-900">{message.content}</div>
                        
                        {!isUser && !isError && message.metadata && (
                            <div className="mt-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="text-sm text-gray-600">Query Type: {message.metadata.queryType}</div>
                                    {message.metadata.safetyCheck?.safe ? (
                                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <XCircleIcon className="w-5 h-5 text-red-500" />
                                    )}
                                </div>

                                {viewMode === 'json' && (
                                    <div className="mt-2 bg-white p-4 rounded-lg">
                                        <ReactJson 
                                            src={message.metadata.results} 
                                            theme="monokai"
                                            collapsed={2}
                                        />
                                    </div>
                                )}

                                {viewMode === 'table' && message.metadata.results?.length > 0 && (
                                    <div className="mt-2 overflow-x-auto">
                                        <DataTable data={message.metadata.results} />
                                    </div>
                                )}

                                <div className="mt-2">
                                    <div className="text-sm text-gray-600 mb-1">MongoDB Pipeline:</div>
                                    <SyntaxHighlighter 
                                        language="javascript" 
                                        style={docco}
                                        className="rounded-lg text-sm"
                                    >
                                        {JSON.stringify(message.metadata.pipeline, null, 2)}
                                    </SyntaxHighlighter>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Schema Explorer Sidebar */}
            <div className="w-80 border-r bg-white p-4">
                <SchemaExplorer 
                    selectedCollection={selectedCollection}
                    onCollectionSelect={setSelectedCollection}
                />
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* View Mode Toggle */}
                <div className="bg-white border-b p-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setViewMode('chat')}
                            className={classNames(
                                'px-3 py-2 rounded-lg text-sm font-medium',
                                viewMode === 'chat' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
                            )}
                        >
                            Chat View
                        </button>
                        <button
                            onClick={() => setViewMode('json')}
                            className={classNames(
                                'px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2',
                                viewMode === 'json' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
                            )}
                        >
                            <CodeBracketIcon className="w-4 h-4" />
                            JSON View
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={classNames(
                                'px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2',
                                viewMode === 'table' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
                            )}
                        >
                            <TableCellsIcon className="w-4 h-4" />
                            Table View
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4">
                    {messages.map(renderMessage)}
                    {isLoading && (
                        <div className="flex items-center justify-center p-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="bg-white border-t p-4">
                    <form onSubmit={handleSubmit} className="flex gap-4">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Enter your query..."
                            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isLoading || !selectedCollection}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !selectedCollection || !input.trim()}
                            className={classNames(
                                'px-6 py-2 rounded-lg font-medium',
                                isLoading || !selectedCollection || !input.trim()
                                    ? 'bg-gray-200 text-gray-500'
                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                            )}
                        >
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

const DataTable = ({ data }) => {
    const columns = React.useMemo(() => {
        if (!data || data.length === 0) return [];
        const firstRow = data[0];
        return Object.keys(firstRow).map(key => ({
            Header: key,
            accessor: key,
        }));
    }, [data]);

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable({ columns, data });

    return (
        <table {...getTableProps()} className="min-w-full bg-white rounded-lg overflow-hidden">
            <thead>
                {headerGroups.map(headerGroup => (
                    <tr {...headerGroup.getHeaderGroupProps()}>
                        {headerGroup.headers.map(column => (
                            <th
                                {...column.getHeaderProps()}
                                className="px-4 py-2 bg-gray-100 text-left text-sm font-medium text-gray-600"
                            >
                                {column.render('Header')}
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
            <tbody {...getTableBodyProps()}>
                {rows.map(row => {
                    prepareRow(row);
                    return (
                        <tr {...row.getRowProps()}>
                            {row.cells.map(cell => (
                                <td
                                    {...cell.getCellProps()}
                                    className="px-4 py-2 border-t text-sm text-gray-900"
                                >
                                    {cell.render('Cell')}
                                </td>
                            ))}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

export default ChatInterface; 