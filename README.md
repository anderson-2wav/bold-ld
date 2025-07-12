# LD

The LD module provides utilities to simplify JSON-LD document processing within JavaScript/TypeScript applications. It normalizes JSON-LD documents so applications don't need to handle complex variations like array properties, @value fields, and internationalization strings.

LD is a component of the BOLD stack (Bridge Ontology Linked Data). One of LD's primary functions in BOLD is
to **compact** JSON-LD documents into BOLD _resources_. BOLD resources are valid JSON-LD, fully OWL compatible, and suitable for persistence in MongoDB. To that end:
* **@id** is converted to **_id_** and used as MongoDB _id strings (not ObjectId).
* **@type** is always a @list array, typically sorted from most to least specific, according to the application.
* **rdf:type** is converted to @type in the compaction process.
* JSON-LD properties and all RDF predicates are compacted to QNames and used as keys in MongoDB documents.
  Since MongoDB document keys cannot contain ".", LD ensures that all keys are compacted, or else error behavior
  is effected (or unsafe keys may be simply dropped).
* The array-ness of properties may be determined by an optional **isArrayPropertyFn** callback, as well as by
  @container attributes in the JSON-LD. In BOLD, property array-ness may be determined by RDF containers or from custom ontology properties. 

LD can produce proxy objects (LD~Proxy) which help smooth over some of the inconsistencies that are 
troublesome for practical programming with open-world data. 
* _Undeclared Arrays are treated as single values._ 
  Dereferencing a property which is not declared to be an array will return the value if it is a single value 
  or else return the first element if it is an array. Consider an application that generally expects a name property
  to be a single string value. Ontology reasoning may infer new name values from open-world data. Ld~Proxy will continue 
  to return a single string value, but the full array is still accessible if desired. 
* _@value and @id objects are automatically flattened._ Consider a JSON-LD document with the property:
```json
  "example:names": [
    {
      "@value": "John Doe"
    },
    {
      "@value": "Johnny"
    }
  ],
```
  * `document["example:names"]` will return `["John Doe", "Johnny"]`, hiding the complex object underneath.
* _Automatic i18n string selection._ Consider a document with several i18n options for `rdfs:label`:
```json
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
```
  * `document["rdfs:label"]` will return the correct string for the current selected language.
* LD~Proxy properties are also settable and iterable.

Other packages in the BOLD stack will become available in the future, to help with many other issues common to using 
ontology data in web applications:
* importing JSON-LD documents into BOLD MongoDB collections
* traversing class hierarchies to determine specificity order
* distinguishing TBox and Abox resources
* generating a global @context from all resources and ontologies in the application
* accessing the complete ontology definition of a class or property
* many user interface helpers
  * find a suitable display name for any resource
  * generate suitable display value for a resource+property
  * converting xsd literals into native JS values
  * getting colors and icons for a resource by type
* _reification_ meta-data about any resource+property+value assertion in the db
* OWL-DL ontology reasoning with inferences automatically applied to the db, with meta-data. 

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

Create proxy objects that normalize complex JSON-LD structures:

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

Handle multilingual content with automatic language selection:

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
```

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

