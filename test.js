// Test file for the ld module
import ld from './index.js';

console.log('Testing LD module...');
console.log('Version:', ld.getVersion());
console.log('Processed message:', ld.processMessage('Test message'));

// Test async functionality
ld.delay(100).then(result => {
  console.log('Async result:', result);
  console.log('All tests passed!');
}).catch(error => {
  console.error('Test failed:', error);
}); 