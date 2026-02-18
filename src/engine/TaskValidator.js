import { VALID_DOMAINS } from '../constants/Domains.js';

/**
 * Validates a task object against the defined schema.
 * @param {Object} task 
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateTask(task) {
    const errors = [];

    // Check required fields
    if (!task.description || typeof task.description !== 'string') {
        errors.push('Missing or invalid "description": must be a string.');
    }

    if (!task.domainLabel || typeof task.domainLabel !== 'string') {
        errors.push('Missing or invalid "domainLabel": must be a string.');
    } else if (!VALID_DOMAINS.includes(task.domainLabel)) {
        errors.push(`Invalid "domainLabel": "${task.domainLabel}". Valid domains are: ${VALID_DOMAINS.join(', ')}.`);
    }

    if (task.complexityScore === undefined || typeof task.complexityScore !== 'number') {
        errors.push('Missing or invalid "complexityScore": must be a number.');
    } else if (task.complexityScore < 1 || task.complexityScore > 10) {
        errors.push('Invalid "complexityScore": must be between 1 and 10.');
    }

    // Optional fields validation
    if (task.priority !== undefined && typeof task.priority !== 'number') {
        errors.push('Invalid "priority": must be a number.');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Task Schema Definition for documentation and potential future use with validation libraries.
 */
export const TaskSchema = {
    type: 'object',
    required: [
        'description',
        'domainLabel',
        'complexityScore'
    ],
    properties: {
        taskID: {
            type: 'string',
            description: 'Unique identifier for the task'
        },
        description: {
            type: 'string',
            description: 'Clear description of the task'
        },
        domainLabel: {
            type: 'string',
            description: 'The domain/topic area of the task',
            enum: VALID_DOMAINS
        },
        complexityScore: {
            type: 'number',
            description: 'Estimated difficulty from 1 to 10',
            minimum: 1,
            maximum: 10
        },
        priority: {
            type: 'number',
            description: 'Optional priority level'
        },
        timestamp: {
            type: 'string',
            description: 'ISO 8601 timestamp of task creation'
        }
    }
};
