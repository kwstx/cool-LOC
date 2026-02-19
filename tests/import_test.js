import CoreEngine from '../src/engine/CoreEngine.js';
const engine = new CoreEngine();
console.log('Engine initialized');
console.log('MetaReflection:', !!engine.metaReflection);
process.exit(0);
