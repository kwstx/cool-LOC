import fs from 'fs';
import path from 'path';

class Logger {
    constructor(logFilePath = 'logs/engine.log') {
        this.logFilePath = logFilePath;
        this.ensureLogDir();
    }

    ensureLogDir() {
        const dir = path.dirname(this.logFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
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
