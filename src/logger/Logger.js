import fs from 'fs';
import path from 'path';

class Logger {
    constructor(logFilePath = 'logs/engine.log', executionLogPath = 'logs/executions.json') {
        this.logFilePath = logFilePath;
        this.executionLogPath = executionLogPath;
        this.executionLogs = [];
        this.ensureLogDir();
        this.loadExecutionLogs();
    }

    ensureLogDir() {
        const dir = path.dirname(this.logFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    loadExecutionLogs() {
        if (fs.existsSync(this.executionLogPath)) {
            try {
                const data = fs.readFileSync(this.executionLogPath, 'utf8');
                this.executionLogs = JSON.parse(data);
            } catch (error) {
                console.error('Failed to load execution logs:', error);
                this.executionLogs = [];
            }
        }
    }

    persistExecutionLogs() {
        fs.writeFileSync(this.executionLogPath, JSON.stringify(this.executionLogs, null, 2));
    }

    log(action, metadata = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            action,
            ...metadata
        };
        console.log(JSON.stringify(entry));
        fs.appendFileSync(this.logFilePath, JSON.stringify(entry) + '\n');
    }

    /**
     * Specialized logging for task executions to support analytics and rewards.
     * @param {Object} data Execution details
     */
    execution(data) {
        const entry = {
            timestamp: new Date().toISOString(),
            taskId: data.taskId,
            agentId: data.agentId,
            domain: data.domainLabel || data.domain,
            predictedImpact: data.predictedImpact || 0,
            actualImpact: data.actualImpact || 0,
            confidenceScore: data.confidenceScore || 0,
            executionTime: data.executionTime || 0,
            dependencies: data.dependencies || [],
            collaboration: data.collaboration || {},
            status: data.status || 'completed'
        };

        this.executionLogs.push(entry);
        this.persistExecutionLogs();
        this.log('TASK_EXECUTION_RECORD', entry);
    }

    /**
     * Query execution logs in real-time.
     * @param {Object} filters Key-value pairs to filter logs
     * @returns {Array} Filtered logs
     */
    query(filters = {}) {
        return this.executionLogs.filter(log => {
            return Object.entries(filters).every(([key, value]) => {
                if (Array.isArray(value)) {
                    return value.includes(log[key]);
                }
                return log[key] === value;
            });
        });
    }

    /**
     * Aggregate data from execution logs.
     * @param {string} groupBy Field to group by (e.g., 'agentId', 'domain')
     * @param {string} metric Field to aggregate (e.g., 'actualImpact', 'executionTime')
     * @param {string} type 'sum' | 'avg' | 'count'
     */
    aggregate(groupBy, metric, type = 'sum') {
        const groups = {};

        this.executionLogs.forEach(log => {
            const key = log[groupBy] || 'unknown';
            if (!groups[key]) {
                groups[key] = { value: 0, count: 0 };
            }
            if (metric && log[metric] !== undefined) {
                groups[key].value += log[metric];
            }
            groups[key].count += 1;
        });

        if (type === 'avg') {
            Object.keys(groups).forEach(key => {
                groups[key] = groups[key].count > 0 ? groups[key].value / groups[key].count : 0;
            });
        } else if (type === 'count') {
            Object.keys(groups).forEach(key => {
                groups[key] = groups[key].count;
            });
        } else {
            Object.keys(groups).forEach(key => {
                groups[key] = groups[key].value;
            });
        }

        return groups;
    }

    /**
     * Export logs to a different format.
     * @returns {string} JSON string of logs
     */
    export() {
        return JSON.stringify(this.executionLogs, null, 2);
    }

    info(action, message, metadata = {}) {
        this.log(action, { level: 'INFO', message, ...metadata });
    }

    warn(action, message, metadata = {}) {
        this.log(action, { level: 'WARN', message, ...metadata });
    }

    error(action, message, error, metadata = {}) {
        this.log(action, {
            level: 'ERROR',
            message,
            error: error?.message || error,
            stack: error?.stack,
            ...metadata
        });
    }
}

export default new Logger();

