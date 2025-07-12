# LD Module Usage Examples

## In Vue Components

```javascript
// In a Vue component
import LD from 'ld';

export default {
  name: 'MyComponent',
  data() {
    return {
      message: '',
      ld: null
    };
  },
  async mounted() {
    // Create an LD instance with custom options
    this.ld = new LD({
      flatten: false,
      i18n: true,
      lang: 'en'
    });
    
    // Use the ld module
    this.message = this.ld.processMessage('Component loaded');
    console.log('LD Version:', this.ld.getVersion());
    
    // Async usage
    const result = await this.ld.delay(1000);
    console.log(result);
  }
};
```

## In Meteor Server Code

```javascript
// In server/main.js or any server file
import LD from 'ld';

Meteor.startup(() => {
  const ld = new LD();
  console.log(ld.processMessage('Server started'));
  console.log('LD Version:', ld.getVersion());
});
```

## In Client Code

```javascript
// In client/main.js or any client file
import LD from 'ld';

const ld = new LD();
console.log(ld.processMessage('Client initialized'));
```

## In Test Files

```javascript
// In test files
import LD from 'ld';

describe('LD Module', () => {
  let ld;

  beforeEach(() => {
    ld = new LD();
  });

  it('should process messages correctly', () => {
    const result = ld.processMessage('test');
    expect(result).to.equal('[LD] test');
  });
  
  it('should return version', () => {
    expect(ld.getVersion()).to.equal('1.0.0');
  });
});
```

## Extending the Module

You can extend the LD class with your own functionality:

```javascript
// In modules/ld/src/ld.js
class LD {
  // ... existing methods ...
  
  /**
   * Your custom method
   */
  customMethod() {
    return 'Custom functionality';
  }
}
```

Then use it in your project:

```javascript
import LD from 'ld';
const ld = new LD();
console.log(ld.customMethod()); // 'Custom functionality'
``` 