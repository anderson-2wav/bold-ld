/**
 * LD Module - Local Development Utilities (CommonJS wrapper)
 * 
 * This is a CommonJS wrapper around the ES module implementation.
 */

// Import the LD class from the ES module
import LD from './ld.js';

// Export the LD class for CommonJS consumers
module.exports = LD;
module.exports.LD = LD; 