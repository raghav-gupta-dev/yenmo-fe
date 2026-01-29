import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnecting...');
  const [filterLevel, setFilterLevel] = useState('ALL');
  const wsRef = useRef(null);
  const logsEndRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const logCounterRef = useRef(0);

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
        console.log('Raw WebSocket message:', event.data);
        
        try {
          const data = JSON.parse(event.data);
          console.log('Parsed WebSocket data:', data);
          
          // Handle history logs (last 10 lines)
          if (data.type === 'HISTORY') {
            let historyLogs = [];
            
            if (Array.isArray(data.data)) {
              historyLogs = data.data;
            } else if (typeof data.data === 'string') {
              // If data is a string, split by newlines and parse each line
              historyLogs = data.data
                .split('\n')
                .filter(line => line.trim())
                .map(line => ({
                  timestamp: new Date().toLocaleTimeString(),
                  level: 'INFO',
                  message: line,
                  isStructured: false
                }));
            }
            
            const processedHistory = historyLogs.map((log, index) => {
              logCounterRef.current++;
              return {
                id: `history-${Date.now()}-${index}`,
                lineNumber: logCounterRef.current,
                timestamp: log.timestamp || new Date().toLocaleTimeString(),
                level: log.level || 'INFO',
                message: log.message || log,
                isStructured: log.isStructured !== undefined ? log.isStructured : true,
                isHistory: true
              };
            });
            
            console.log('Setting history logs:', processedHistory);
            setLogs(processedHistory);
          }
          // Handle structured log object (with timestamp, level, message)
          else if (data.timestamp && data.level && data.message) {
            logCounterRef.current++;
            const newLog = {
              id: `log-${Date.now()}-${Math.random()}`,
              lineNumber: logCounterRef.current,
              timestamp: data.timestamp,
              level: data.level,
              message: data.message,
              isStructured: data.isStructured !== undefined ? data.isStructured : true,
              isHistory: false
            };
            
            console.log('Adding structured log:', newLog);
            setLogs((prevLogs) => {
              const updated = [...prevLogs, newLog];
              console.log('Updated logs count:', updated.length);
              return updated;
            });
          }
          // Handle new real-time logs with type: 'log'
          else if (data.type === 'log') {
            logCounterRef.current++;
            const newLog = {
              id: `log-${Date.now()}-${Math.random()}`,
              lineNumber: logCounterRef.current,
              timestamp: data.timestamp || new Date().toLocaleTimeString(),
              level: data.level || 'INFO',
              message: data.message || JSON.stringify(data),
              isStructured: data.isStructured !== undefined ? data.isStructured : true,
              isHistory: false
            };
            
            console.log('Adding new log:', newLog);
            setLogs((prevLogs) => [...prevLogs, newLog]);
          }
          // Fallback: if it has a message field
          else if (data.message) {
            logCounterRef.current++;
            const newLog = {
              id: `log-${Date.now()}-${Math.random()}`,
              lineNumber: logCounterRef.current,
              timestamp: data.timestamp || new Date().toLocaleTimeString(),
              level: data.level || 'INFO',
              message: data.message,
              isStructured: data.isStructured !== undefined ? data.isStructured : true,
              isHistory: false
            };
            
            console.log('Adding fallback log:', newLog);
            setLogs((prevLogs) => [...prevLogs, newLog]);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error, event.data);
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
  }, []);

  const clearLogs = () => {
    setLogs([]);
    logCounterRef.current = 0; // Reset counter when clearing logs
  };

  // Get log level color
  const getLevelColor = (level) => {
    switch (level?.toUpperCase()) {
      case 'INFO':
        return '#00d9ff';
      case 'ERROR':
        return '#ff4444';
      case 'WARN':
      case 'WARNING':
        return '#ffaa00';
      case 'DEBUG':
        return '#9d4edd';
      case 'SUCCESS':
        return '#00ff00';
      default:
        return '#888888';
    }
  };

  // Filter logs based on level
  const filteredLogs = filterLevel === 'ALL' 
    ? logs 
    : logs.filter(log => log.level?.toUpperCase() === filterLevel);

  // Get unique log levels for filter
  const logLevels = ['ALL', ...new Set(logs.map(log => log.level?.toUpperCase()).filter(Boolean))];

  return (
    <div className="app">
      <header className="header">
        <h1>Real-Time Log Viewer</h1>
        <div className="status-bar">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            ●
          </span>
          <span className="status-text">{connectionStatus}</span>
          
          <div className="filter-container">
            <label htmlFor="level-filter">Filter:</label>
            <select 
              id="level-filter"
              value={filterLevel} 
              onChange={(e) => setFilterLevel(e.target.value)}
              className="filter-select"
            >
              {logLevels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          <button onClick={clearLogs} className="clear-btn">Clear Logs</button>
        </div>
      </header>

      <main className="logs-container">
        {filteredLogs.length === 0 ? (
          <div className="no-logs">
            <p>
              {logs.length === 0 
                ? 'Waiting for logs...' 
                : `No ${filterLevel} logs found`}
            </p>
            <p className="hint">
              {logs.length === 0 
                ? 'Logs will appear here in real-time' 
                : 'Try changing the filter'}
            </p>
          </div>
        ) : (
          <div className="logs-list">
            {filteredLogs.map((log) => (
              <div 
                key={log.id} 
                className={`log-entry ${log.isHistory ? 'log-history' : ''}`}
                style={{
                  borderLeftColor: getLevelColor(log.level)
                }}
              >
                <span className="log-line-number">#{log.lineNumber}</span>
                <span className="log-timestamp">[{log.timestamp}]</span>
                <span 
                  className="log-level"
                  style={{ color: getLevelColor(log.level) }}
                >
                  {log.level}
                </span>
                <span className="log-message">{log.message}</span>
                {log.isHistory && <span className="history-badge">History</span>}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="stats">
          <span>Total Logs: {logs.length}</span>
          <span>Displayed: {filteredLogs.length}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;