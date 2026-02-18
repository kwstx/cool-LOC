import { VALID_DOMAINS } from '../constants/Domains.js';

/**
 * Validates agent registration metadata.
 * @param {Object} metadata 
 * @param {Object} existingAgents Mapping of existing agent IDs
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateAgent(metadata, existingAgents = {}) {
    const errors = [];

    // Check ID uniqueness if provided
    if (metadata.id) {
        if (typeof metadata.id !== 'string') {
            errors.push('Invalid "id": must be a string.');
        } else if (existingAgents[metadata.id]) {
            errors.push(`Duplicate "id": An agent with ID "${metadata.id}" is already registered.`);
        }
    }

    // Domain Labels validation
    if (!metadata.domainLabels || !Array.isArray(metadata.domainLabels) || metadata.domainLabels.length === 0) {
        errors.push('Missing or invalid "domainLabels": must be a non-empty array of strings.');
    } else {
        metadata.domainLabels.forEach(label => {
            if (!VALID_DOMAINS.includes(label)) {
                errors.push(`Invalid domain label: "${label}". Valid domains are: ${VALID_DOMAINS.join(', ')}.`);
            }
        });
    }

    // Skill scores / numeric proficiency scores
    if (!metadata.skillScores || typeof metadata.skillScores !== 'object' || Array.isArray(metadata.skillScores)) {
        errors.push('Missing or invalid "skillScores": must be an object containing proficiency scores.');
    }

    // API Endpoint
    if (!metadata.apiEndpoint || typeof metadata.apiEndpoint !== 'string') {
        errors.push('Missing or invalid "apiEndpoint": must be a string.');
    }

    // Performance metrics
    if (!metadata.performanceData || typeof metadata.performanceData !== 'object' || Array.isArray(metadata.performanceData)) {
        errors.push('Missing or invalid "performanceData": must be an object containing historical metrics.');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}
