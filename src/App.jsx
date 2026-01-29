import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnecting...');
  const wsRef = useRef(null);
  const logsEndRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Auto-scroll to bottom when new logs arrive
  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  useEffect(() => {
    // Prevent double connection in React StrictMode
    let isCleanedUp = false;

    // Connect to WebSocket server
    const connectWebSocket = () => {
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }

      if (isCleanedUp) return;

      const ws = new WebSocket('ws://localhost:3000');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('Connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle history logs (last 10 lines)
          if (data.type === 'HISTORY' && data.data) {
            const historyLines = data.data
              .split('\n')
              .filter(line => line.trim()) // Remove empty lines
              .map((line, index) => ({
                id: `history-${Date.now()}-${index}`,
                message: line,
                timestamp: new Date().toLocaleTimeString(),
                isHistory: true
              }));

            setLogs(historyLines);
          }
          // Handle new real-time logs
          else if (data.type === 'log' && data.message) {
            setLogs((prevLogs) => [...prevLogs, {
              id: Date.now() + Math.random(),
              message: data.message,
              timestamp: new Date().toLocaleTimeString(),
              isHistory: false
            }]);
          }
        } catch (error) {
          // If it's not JSON, treat it as a plain log message
          setLogs((prevLogs) => [...prevLogs, {
            id: Date.now() + Math.random(),
            message: event.data,
            timestamp: new Date().toLocaleTimeString(),
            isHistory: false
          }]);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Error');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setConnectionStatus('Disconnected');

        // Only reconnect if not cleaned up
        if (!isCleanedUp) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setConnectionStatus('Reconnecting...');
            connectWebSocket();
          }, 3000);
        }
      };
    };

    connectWebSocket();

    // Cleanup on component unmount
    return () => {
      isCleanedUp = true;
      
      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Real-Time Log Viewer</h1>
        <div className="status-bar">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            ●
          </span>
          <span className="status-text">{connectionStatus}</span>
          <button onClick={clearLogs} className="clear-btn">Clear Logs</button>
        </div>
      </header>

      <main className="logs-container">
        {logs.length === 0 ? (
          <div className="no-logs">
            <p>Waiting for logs...</p>
            <p className="hint">Logs will appear here in real-time</p>
          </div>
        ) : (
          <div className="logs-list">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`log-entry ${log.isHistory ? 'log-history' : ''}`}
              >
                <span className="log-timestamp">[{log.timestamp}]</span>
                <span className="log-message">{log.message}</span>
                {log.isHistory && <span className="history-badge">History</span>}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;