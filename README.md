# LD

The LD module is a core component of the BOLD stack (Bridge Ontology Linked Data). LD simplifies JSON-LD document processing within JavaScript/TypeScript applications. It normalizes JSON-LD documents so applications don't need to handle complex variations like array properties, @value fields, and internationalization.

LD is based on [jsonld.js](https://github.com/digitalbazaar/jsonld.js).

## License

LD is licensed under the **Mozilla Public License 2.0 (MPL-2.0)**.

This means:
- If you modify Ontologize source files, share those changes
- Your application code that uses Ontologize can remain proprietary
- See [LICENSE](./LICENSE) for full terms

## Overview

One of LD's primary functions is to **compact** JSON-LD documents into normalized _resources_ suitable for persistence and practical javascript/typescript programming in BOLD. To that end:
* **@id** is converted to **_id_** and used as MongoDB _id strings (BOLD does not use MongoDB's ObjectId type).
* **@type** is always a @set array, typically sorted from most to least specific, according to the application.
* **rdf:type** is converted to @type in the compaction process.
* JSON-LD properties and all RDF predicates are compacted to QNames and used as property keys in MongoDB documents. Since MongoDB document keys cannot contain ".", LD ensures that all keys are compacted and MongoDB compatible.
* The array-ness of properties is enforced, by @container attributes in the JSON-LD context, and also by an optional **isArrayPropertyFn** callback. This callback is used in BOLD to indicate property array-ness from custom ontology properties. 

LD also provides proxy objects (LD~Proxy) which hide troublesome complexities that can arise in JSON-LD documents: 
* _Undeclared arrays appear as single values by default._ (All values can be accessed if explicitly requested.)  
  Dereferencing a property which is not declared to be an array will return the value if it is a single value 
  or else return the first element if it is an array. Consider an application that generally expects a name property to be a single string value. Ontology reasoning may infer new name values from open-world data. Ld~Proxy will continue to return a single string value, but the full array is still accessible if desired. 
* _@value and @id objects appear flattened._ 
  * Consider a JSON-LD document with the property:
```js
const documentProxu = ld.proxy({
  "example:names": [
      {
        "@value": "John Doe"
      },
      {
        "@value": "Johnny"
      }
    ]
  });
console.log(documentProxu["example:names"]); // ["John Doe", "Johnny"]
```
* _Automatic i18n string selection._ Consider a document with several i18n options for `rdfs:label`:
```js
const documentProxy = ld.proxy({
  "rdfs:label": [
    {
      "@language": "fr",
      "@value": "Organisation"
    },
    {
      "@language": "en",
      "@value": "Organization"
    },
    {
      "@language": "it",
      "@value": "Organizzazione"
    },
    {
      "@language": "es",
      "@value": "organización"
    }
  ]
});
ld.opts.lang = "it";
console.log(document["rdfs:label"]); // "Organizzazione" 
```
* LD~Proxy properties are also settable and iterable.

## Usage

### Basic Setup

```javascript
// ES Module import
import LD from 'ld';

// Create an instance with default options
const ld = new LD();

// Create an instance with custom configuration
const ld = new LD({
  context: {
    "@vocab": "http://example.org/",
    "foaf": "http://xmlns.com/foaf/0.1/"
  },
  proxy: true,
  lang: "es",
  debug: true
});
```

### JSON-LD Compaction

The primary function for processing JSON-LD documents. Ensures consistent behavior and MongoDB-safe output:

```javascript
const resource = {
  "@id": "http://example.org/resource1",
  "http://example.org/name": "Test Resource",
  "http://xmlns.com/foaf/0.1/name": ["John Doe", "Johnny"]
};

const context = {
  "@vocab": "http://example.org/",
  "foaf": "http://xmlns.com/foaf/0.1/"
};

const compacted = await ld.compact(resource, context, {
  firstExpand: true,
  showContext: true,
  ensureArrayProps: true,
  normalizeI18N: true,
  proxy: true
});
```

### JSON-LD Expansion

Expands compact JSON-LD to full URI form:

```javascript
const compact = {
  "@id": "person1", 
  "name": "John Doe",
  "age": 30
};

const context = {
  "@vocab": "http://example.org/",
  "name": "http://xmlns.com/foaf/0.1/name"
};

const expanded = await ld.expand(compact, context);
// Returns array of expanded resources with full URIs
```

### Smart Proxy Objects

LD Proxies normalize complex JSON-LD structures:

```javascript
const doc = {
  "@id": "ctl:AC-1",
  "@type": "ctl:control", 
  "plain": "FortyTwo",
  "plains": ["Hello", "World"],
  "onesy": [{ "@value": "one" }],
  "knownArrayProperty": [
    { "@value": 1 },
    { "@value": 2 }
  ]
};

const proxy = ld.proxy(doc);

console.log(proxy.plain);                    // "FortyTwo"
console.log(proxy.plains);                   // "Hello" (first value)
console.log(proxy["plains[]"]);              // ["Hello", "World"] (force array)
console.log(proxy.onesy);                    // "one" (flattened @value)
console.log(proxy.knownArrayProperty);       // [1, 2] (if isArrayProperty true)
console.log(proxy.__raw.onesy);              // [{ "@value": "one" }] (original)
```

### Internationalization Support

LD provides comprehensive i18n support for both reading and writing multilingual content. i18n functionality is enabled by default with `opts.i18n = true` and can handle both JSON-LD value objects and RDF literal formats.

#### Reading i18n Content

LD automatically selects the appropriate language when accessing properties:

```javascript
const resource = {
  "@id": "http://www.w3.org/ns/org#Organization",
  "rdfs:label": [
    { "@language": "en", "@value": "Organization" },
    { "@language": "fr", "@value": "Organisation" },
    { "@language": "es", "@value": "organización" }
  ]
};

// Set language preference
ld.opts.lang = "fr";

const proxy = ld.proxy(resource);
console.log(proxy["rdfs:label"]);  // "Organisation" (French version)

// Change language dynamically
ld.opts.lang = "es"; 
console.log(proxy["rdfs:label"]);  // "organización" (Spanish version)

// Access all languages as array
console.log(proxy["rdfs:label[]"]);  
// ["organización", '"Organisation"^^fr', '"Organization"^^en']
// Note: Current language appears first as plain string, others as RDF literals
```

#### RDF Literal Format Support

LD works with RDF i18n literals (`"value"^^lang`):

```javascript
const resource = {
  "@id": "http://www.w3.org/ns/org#Organization",
  "rdfs:label": [
    '"Organisation"^^fr',
    '"Organization"^^en', 
    '"Organizzazione"^^it',
    '"organización"^^es'
  ]
};

ld.opts.lang = "it";
const proxy = ld.proxy(resource);

console.log(proxy["rdfs:label"]);   // "Organizzazione"
console.log(proxy["rdfs:label[]"]); 
// ["Organizzazione", '"Organisation"^^fr', '"Organization"^^en', '"organización"^^es']
```

#### Setting i18n Values

When setting values on i18n properties, LD intelligently handles language management:

```javascript
const resource = {
  "@id": "http://www.w3.org/ns/org#Organization",
  "rdfs:label": [
    '"Organisation"^^fr',
    '"Organization"^^en',
    '"Organizzazione"^^it',
    '"organización"^^es'
  ]
};

ld.opts.lang = "it";
const proxy = ld.proxy(resource);

// Setting a new value replaces the existing value in current language
proxy["rdfs:label"] = "Un'altra organizzazione";

console.log(proxy["rdfs:label"]);   // "Un'altra organizzazione"
console.log(proxy.__raw["rdfs:label"]);
// ['"Un\'altra organizzazione"^^it', '"Organisation"^^fr', '"Organization"^^en', '"organización"^^es']
// Note: Old Italian value was replaced, others preserved
```

#### Format Consistency

LD maintains format consistency when setting values:

```javascript
// With JSON-LD format input
const jsonldResource = {
  "rdfs:label": [
    { "@language": "en", "@value": "Organization" },
    { "@language": "fr", "@value": "Organisation" }
  ]
};

ld.opts.lang = "it";
const proxy1 = ld.proxy(jsonldResource);
proxy1["rdfs:label"] = "Organizzazione";

// Result uses JSON-LD format for consistency
console.log(proxy1.__raw["rdfs:label"]);
// [{ "@language": "it", "@value": "Organizzazione" }, { "@language": "en", "@value": "Organization" }, ...]

// i18n inputs convert to i18n literal format  
const rdfResource = {
  "rdfs:label": ['"Organization"^^en', '"Organisation"^^fr']
};
const proxy2 = ld.proxy(rdfResource);
ld.opts.lang = "it";
proxy2["rdfs:label"] = "Organizzazione";
// Result uses RDF literal format for consistency
console.log(proxy2.__raw["rdfs:label"]);
// ['"Organizzazione"^^it', '"Organization"^^en', '"Organisation"^^fr']
```

#### Mixed Format Handling

When arrays contain mixed formats, LD prefers RDF literal format:

```javascript
const mixedResource = {
  "rdfs:label": [
    '"Organisation"^^fr',           // RDF literal
    { "@language": "en", "@value": "Organization" }, // JSON-LD object
    '"Organizzazione"^^it'          // RDF literal
  ]
};

ld.opts.lang = "es";
const proxy = ld.proxy(mixedResource);
proxy["rdfs:label"] = "organización";

// Uses RDF literal format since some literals are present
console.log(proxy.__raw["rdfs:label"]);
// ['"organización"^^es', '"Organisation"^^fr', { "@language": "en", "@value": "Organization" }, '"Organizzazione"^^it']
```

#### Language Priority and Ordering

- **Current language first**: Values in the current language always appear first in array access
- **Plain strings for current language**: Current language values are returned as plain strings
- **RDF literals for other languages**: Non-current language values appear as RDF literals for clarity
- **Replacement semantics**: Setting a value replaces any existing value in that language
- **Preservation**: Values in other languages are preserved unchanged

### Language Maps

Handle JSON-LD 1.1 language maps with @container: ["@language", "@set"]:

```javascript
const resource = {
  "@context": {
    "@version": 1.1,
    "label": {
      "@id": "vocab:label",
      "@container": ["@language", "@set"]
    }
  },
  "@id": "http://example.com/queen",
  "label": {
    "en": ["The Queen"],
    "de": ["Die Königin", "Ihre Majestät"]
  }
};

const compacted = await ld.compact(resource, resource["@context"], {
  normalizeI18N: true
});

// Language map flattened to i18n strings:
// ld.opts.lang = "en";
// compacted.label = ["The Queen", "\"Die Königin\"^^de", "\"Ihre Majestät\"^^de"]
```

### URI and QName Conversion

Convert between full URIs and compact QNames:

```javascript
const context = {
  "@vocab": "http://example.org/",
  "foaf": "http://xmlns.com/foaf/0.1/"
};

// Compact URI to QName
const qname = ld.compactUri("http://xmlns.com/foaf/0.1/name", context);
console.log(qname); // "foaf:name"

// Expand QName to URI  
const uri = ld.expandQName("foaf:name", context);
console.log(uri); // "http://xmlns.com/foaf/0.1/name"
```

### Custom Array Properties

Define which properties should be treated as arrays:

```javascript
const ld = new LD({
  isArrayPropertyFn: (property, context) => {
    // Custom logic for determining array properties
    if (property === "tags" || property === "categories") {
      return true;
    }
    
    // Check @container in context
    if (context?.[property]?.["@container"]) {
      const container = context[property]["@container"];
      return container.includes("@set") || container.includes("@list");
    }
    
    return false;
  }
});
```

### TypeScript Usage

```typescript
import LD, { ILD } from 'ld';

const ld: ILD = new LD({
  context: {
    "@vocab": "http://example.org/",
    "foaf": "http://xmlns.com/foaf/0.1/"
  },
  proxy: true,
  i18n: true,
  lang: "en"
});

// All methods are fully typed
const compacted: Promise<object> = ld.compact(resource, context);
const expanded: Promise<object[]> = ld.expand(resource, context);
const proxy: object = ld.proxy(document);
const isProxy: boolean = ld.isProxy(obj);
```

## API

### Constructor
```typescript
new LD(options?: {
  context?: object;
  proxy?: boolean;
  flatten?: boolean;
  i18n?: boolean;
  lang?: string;
  debug?: boolean;
  typeUri?: string;
  sortTypesFn?: (types: string[], context: object) => void;
  cleanupResourceFn?: (resource: object) => void;
  isArrayPropertyFn?: (property: string, opts: any) => boolean;
})
```

### `proxy(doc: object, realTarget?: object): Proxy`
Creates a proxy for JSON-LD objects with custom behavior.

### `isProxy(obj: any): boolean`
Checks if an object is an LD proxy.

### `isArrayProperty(property: string, opts?: any): boolean`
Determines if a property should be treated as an array.

### `unproxy(obj: object|object[]): object`
Turns a proxy and any embedded proxies back into original objects.

### `clone(obj: any): any`
Performs a deep clone on an object that might be a proxy.

### `expand(resource: object|object[], context?: object, opts?: object): Promise<object[]>`
Expands a resource using a provided context.

### `compact(resource: object|object[], context?: object, opts?: object): Promise<object>`
Compacts a resource or resources using a provided context. This is the main JSON-LD compaction function.

### `compactKeys(resource: object|object[], context: object, opts?: object): object[]`
Compacts keys in a resource according to context.

### `compactUri(uri: string, context: object): string`
Returns a QName for URI according to prefixes in context.

### `expandQName(qname: string, context: object): string`
Returns a URI for QName according to prefixes in context.

### `normalizeI18N(resource: object, defaultLang?: string): void`
Normalizes i18n strings in a resource.

### `normalizeLists(resource: object, opts?: object): void`
Flattens @list and @set objects into just an array.

## TypeScript Support

The module includes comprehensive TypeScript declarations:

- **`ILD`** - Interface for LD instances
- **`LD`** - Class constructor (default export)

## Development

This module is configured for local development and can be imported directly in the main project using:

```javascript
import ld from 'ld';
```

The module supports both ES modules and CommonJS for maximum compatibility, with full TypeScript support. 

