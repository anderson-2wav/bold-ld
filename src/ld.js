/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2026 2wav, Inc.
 */

import _ from "lodash";
import jsonld from "jsonld";
import { assert } from "chai";
import jsonPath from "./lib/jsonpath.js";
import { check, Match } from "./lib/check.js";

// Darn. this can't work on the client. Causes a white-screen-of-death
// import { readFileSync } from "fs";
// import { dirname, join } from "path";
// import { fileURLToPath } from "url";
// // Get the directory of the current module and read package.json
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);
// const packageJsonPath = join(__dirname, "..", "package.json");
// const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

/**
 * A JSON-LD smart proxy object, which returns values normalized
 * to help programmers with surprise array properties,
 * embedded @value fields, and i18n strings.
 *
 * Constructed by {@link Ld~proxy}
 *
 * The original unaltered JSON-LD object can always be accessed through the
 * special **__raw** member.
 *
 * Otherwise, the proxy alters access to document properties to make complex
 * JSON-LD structures appear like simple JSON objects.
 *
 * Behavior of array values is determined by {@link Ld~isArrayProperty}.
 * Properties that are thus intended to be treated as arrays, will in general
 * behave as arrays. Properties that are ambiguous will in general act as
 * single values with special behavior applied.
 *
 * ### Field Getter
 * The rules, for a regular field accessor like object.property
 * * if it is not an array, it will return the _flattened_ field value
 * * if it is an array and Ld.isArrayProperty is false,
 *   then return the first _flattened_ array value.
 * * if it is an array and the Ld.isArrayProperty is true,
 *   then returns an array of _flattened_ values.
 * * the property is accessed with an array index [n],
 *   then return the nth array element _flattened_ value.
 * * the property is accessed with "[]" appended to the key,
 *   then return an array of _flattened_ values.
 * * the property is access through the special _raw_ member, return the original value.
 *
 * Consider a JSON-LD object below.
 ```
 const doc = {
   "@id": "ctl:AC-1",
   "@type": "ctl:control",
   "plain": "FortyTwo",
   "plains": ["Hello","World"],
   "onesy": [
     {
       "@value": "one"
     }
   ],
   "knownArrayProperty": [
     {
       "@value": 1
     },
     {
       "@value": 2
     }
   ],
   "unknownArrayProperty": [
     {
       "@value": 3
     },
     {
       "@value": 1
     },
     {
       "@value": 2
     }
   ]
 }

 const proxy = Ld(doc);
 console.log( proxy.plain );                      // "FortyTwo"
 console.log( proxy.plains );                     // "Hello"
 console.log( proxy["plains[]"] );                // [ "Hello", "World" ]
 console.log( proxy["plains[]"][1] );             // "World"
 console.log( proxy.onesy );                      // "one"
 console.log( proxy.knownArrayProperty );            // [ 1, 2]
 console.log( proxy.unknownArrayProperty );         // 1
 console.log( proxy.unknownArrayProperty[1] );      // 2
 console.log( proxy["unknownArrayProperty[]"] );    // [ 1, 2]
 console.log( proxy.__raw.unknownArrayProperty );     // [{ "@value": 1},{"@value": 2}]

 ```
 *
 * ### Field Setters
 *
 * Setting a plain value on any property with a plain value will set the property normally.
 *
 * Setting a plain value on a property that has currently has a @value object,
 * will wrap the value in {@value:v}.
 * Setting a value on an array property will depend on Ld.isArrayProperty:
 * * if property is known as an array, then the value is _prepended_ to the array
 * * If array-ness is unknown but the array contains > 1 members, then value
 *   is prepended to the array
 * * If array-ness is unknown and the array contains <= 1 members,
 *   then the value replaces the existing value.
 *
 ```
 // set a plain property
 p.plain = "World.";
 assert.equal(p.__raw.plain,"World.");
 // set a plain property that doesn't exit
 p.plan = "9";
 assert.equal(p.__raw.plan,"9");
 // set a plain property on a plain array
 p.plains = "Before";
 assert.deepEqual(p.__raw.plains,["Before","Hello","World"]);
 // set a plain value on an ontology property
 p.onesy = "two"
 assert.deepEqual(p.__raw.onesy,[{"@value":"two"}]);
 // set a plain value on a known array property
 p.knownArrayProperty = 3;
 assert.deepEqual(p.__raw.knownArrayProperty,[{"@value":3},{"@value":1},{"@value":2}]);
 // set a plain value on a unknown array
 p.unknownCardinality = 3;
 assert.deepEqual(p.__raw.bar,[{"@value":3},{"@value":1},{"@value":2}]);
 ```
 *
 * The _flattening_ of JSON-LD value objects can be disabled with {@link Ld~opts.flatten} = false.
 * If your application dependably {@link Ld.compact}s all resources and is
 * sufficiently aware of {@link Ld.isArrayProperty}, then you might not need the
 * flattening behaviour. In which case, it will be more efficient to disable
 * this behavior.
 * Flattening values, especially for arrays, creates a lot of complexity in Ld~Proxy.
 *
 * ### I18N
 * I18N behavior is enabled by {@link Ld~opts.i18n}.
 * For properties that multiple string values but are not {@link Ld.isArrayProperty}s,
 * the first string with an i18n key matching {@link Ld~opts.lang} will be returned.
 *
 * The i18n key may be an RDF Literal with a language tag
 * e.g. `"Rappresenta una collezione"^^it`,
 * or a JSON-LD value object with a @language key e.g.
 ```
 { @value: "Rappresenta una collezione", @language: "it" }
 ```
 * If no string matches, then the first value is returned as normal for {@link Ld~Proxy}.
 *
 * @typedef {object} Ld~Proxy
 */

/**
 * LD - Utility to simplify use of JSON-LD within JS/TS applications.
 *
 * LD helps normalize JSON-LD documents so that JS/TS applications
 * don't have to worry about many possible variations.
 *
 *
 * @class
 */
class LD {
  /**
   * Create a new LD instance with optional configuration.
   *
   * @constructor
   * @param {object} [opts] - Configuration options for the LD instance
   * @param {object} [opts.context={}] - Default JSON-LD context to use for operations
   * @param {boolean} [opts.proxy=true] - Whether to return proxy objects by default from operations
   * @param {boolean} [opts.proxyFlatten=true] - Whether proxy objects should flatten @value and @id objects
   * @param {boolean} [opts.i18n=true] - Whether to enable internationalization support for language-tagged values
   * @param {string} [opts.lang="en"] - Default language code for i18n operations
   * @param {boolean} [opts.debug=false] - Enable debug logging for operations
   * @param {string} [opts.typeUri="rdf:type"] - URI property to use for type information
   * @param {function} [opts.sortTypesFn] - Function to sort @type arrays, receives (types, context) parameters.
   * @param {function} [opts.cleanupResourceFn] - Function to clean up resources after processing, receives (resource) parameter
   * @param {function} [opts.isArrayPropertyFn] - Function to determine if a property should be treated as an array, receives (property, opts) parameters
   *
   * @example
   * // Create LD instance with default options
   * const ld = new LD();
   *
   * @example
   * // Create LD instance with custom context and options
   * const ld = new LD({
   *   context: {
   *     "@vocab": "http://example.org/",
   *     "foaf": "http://xmlns.com/foaf/0.1/"
   *   },
   *   proxy: false,
   *   lang: "es",
   *   debug: true
   * });
   *
   * @example
   * // Create LD instance with custom functions
   * const ld = new LD({
   *   isArrayPropertyFn: (property, opts) => {
   *     return property === "tags" || property === "categories";
   *   },
   *   sortTypesFn: (types, context) => {
   *     // Sort types alphabetically
   *     types.sort((a, b) => a.localeCompare(b));
   *   },
   *   cleanupResourceFn: (resource) => {
   *     // Remove any temporary properties
   *     delete resource._temp;
   *   }
   * });
   */
  constructor(opts) {
    this.version = "0.1.0"; // packageJson.version;
    this.opts = opts ?? {};
    this.opts.context = this.opts.context ?? {};
    this.opts.proxy = this.opts.proxy ?? true;
    this.opts.proxyFlatten = this.opts.proxyFlatten ?? true;
    this.opts.i18n = this.opts.i18n ?? true;
    this.opts.lang = this.opts.lang ?? "en";
    this.opts.debug = this.opts.debug ?? false;
    this.opts.typeUri = this.opts.typeUri ?? "rdf:type";
    this.opts.sortTypesFn = this.opts.sortTypesFn ?? null; // ((types, context) => types.sort());
    this.opts.cleanupResourceFn = this.opts.cleanupResourceFn ?? (() => {});
    this.opts.isArrayPropertyFn = this.opts.isArrayPropertyFn ?? this._defaultIsArrayProperty.bind(this);
  }

  /**
   * Construct an {@link Ld~Proxy} for the JSON-LD object.
   * @param {object} obj object to proxy
   * @param {object} [realTarget]
   * @param {object} [context]
   * @returns {Ld~Proxy}
   */
  proxy(doc,realTarget, context) {
    check(doc,Match.Any);
    // don't proxy a proxy
    if (this.isProxy(doc)) {
      return doc;
    }

    // illegal to proxy non-objects
    if (typeof doc !== "object") {
      return doc;
    }
    // not for a jsonld value object { @value: xxx }
    if (doc["@value"] !== undefined) {
      return doc;
    }
    let __context;
    if (context) {
      __context = context;
    }
    // Undecided on "node objects" which might be little more than
    // URI expansions { @id: <...> }. Proxy doesn't do much for these.
    // NOTE: all @ properties recognized in node objects jsonld 1.1:
    // @id, @context, @included, @graph, @nest, @type, @reverse, @index
    // considered only proxying things that have a type,
    // if (doc["@id"] && !doc["@type"]) {
    //   return doc;
    // }

    const _realTarget = realTarget;

    if (this.opts.debugRealTarget && realTarget) {
      console.log("create proxy on doc", doc, "with realTarget", realTarget);
      if (realTarget) {
        console.log((new Error).stack);
      }
    }

    const proxy = new Proxy(doc,{
      /**
       * @function
       * @memberOf {Ld~Proxy}
       */
      get: (target, property, receiver) => {
        const flatten = (v) => {
          if (this.opts.proxyFlatten === false) {
            return v;
          }
          if (this.isProxy(v)) {
            return v;
          }
          const typ = typeof v;
          switch (typ) {
            case "number":
            case "string":
            case "undefined":
              return v;
            default:
          }
          if (v === null) {
            return v;
          }
          if (_.isArray(v)) {
            return v;
          }
          if (v["@value"]) {
            return v["@value"];
          }
          // maybe a more complicated impl for @id
          // if all the keys are @something, then assume
          // it is a jsonld "value object" not an
          // embedded doc.
          if (v["@id"] && !Object.keys(v).some(k => k[0] !== "@")) {
            return v["@id"];
          }
          return v;
        };
        // if this proxy delegates to a realTarget, use it.
        if (_realTarget) {
          target = _realTarget;
        }
        // BEGIN HANDLING SPECIAL PROPERTIES
        // detect get of symbols.
        if (typeof property === "symbol") {
          // console.log(`accessing symbol ${property.toString()}`);
          if (property === Symbol.hasInstance) {
            // does not get here. instanceof won't work.
          }
          else if (property === Symbol.toStringTag) {
            // the caller wants the toString() function of this proxy object.
            // this result will make this proxy look like a plain object to meteor check.
            // is that a good thing?
            return function() {
              const flat = flatten(target);
              if (typeof flat === "object") {
                return "[object Object]";
              }
              return flat;
            };
          }
          else if (property === Symbol.toPrimitive) {
            /*
            https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toPrimitive
            All type coercion algorithms look up this symbol on objects for the method that accepts a preferred type and returns a primitive representation of the object, before falling back to using the object's valueOf() and toString() methods.
             */
            // sometimes target is like {
            //   "@id": "2wav:thing"
            // }
            if (typeof target === "object") {
              const flat = flatten(target);
              const toPFn = Reflect.get(flat,property);
              return toPFn;
            }
            return Reflect.get(...arguments);
          }

          const _val = Reflect.get(target,property,receiver);
          // console.log(`Symbol ${property.toString()} default _val`, _val);
          return _val;
        }
        // console.log(`proxy get ${property}`);
        // console.log(`Proxy get ${property} on`,target,`with arguments`,...arguments, "and receiver", receiver);

        if (property === "__raw") {
          // I'm unclear whether this is desirable.
          if (this.opts.rawEmbedded) {
            const paths = jsonPath(target,"$..__isProxy",{resultType:"PATH"});
            if (paths) {
              const _paths = paths.map((p) => {
                const _p = p.substring(1,p.length-"['__isProxy']".length);
                return _p;
              });
              for (const _path of _paths) {
                // _.get doesn't like ""
                if (!_path) continue;
                const _proxy = _.get(target, _path);
                if (this.isProxy(_proxy)) {
                  const __raw = _proxy.__raw;
                  _.set(target,_path,__raw);
                }
              }
            }
          }
          return target;
        }
        // now defined as an own property on object
        if (property === "__isProxy") {
          return true;
        }
        if (property === "hasOwnProperty") {
          // a fn that makes our fake properties findable by jsonPath
          return function(prop) {
            switch (prop) {
              case "__isProxy":
              case "__raw":
                return true;
              default:
            }
            return Object.prototype.hasOwnProperty.call(target, prop);
          };
        }
        if (property === "_realTarget") {
          return _realTarget;
        }

        // END HANDLING SPECIAL PROPERTIES

        let asArray = false;
        if (property.substr(-2) === "[]") {
          property = property.substring(0,property.length-2);
          asArray = true;
        }
        if (this.isArrayProperty(property,__context)) {
          asArray = true;
        }

        // otherwise asking for a property, but in json-ld that _might_ be in an array
        if (Array.isArray(target[property])) {
          if (asArray) {
            if (this.opts.proxyFlatten === false) {
              return target[property];
            }
            let __raw;
            if (this.isProxy(target[property])) {
              if (target[property]._realTarget) {
                return target[property];
              }
              __raw = target[property].__raw;
            }
            else {
              __raw = target[property];
            }

            // Enhanced i18n support for array access
            if (this.opts.i18n && this.opts.lang) {
              const hasI18nContent = __raw.some(value => {
                if (typeof value === "string") {
                  return value.match(/^"(.+)"\^\^(.+)$/);
                }
                else if (typeof value === "object" && value !== null) {
                  return value["@value"] !== undefined && value["@language"];
                }
                return false;
              });

              if (hasI18nContent) {
                const i18nProcessed = this._processI18nArray(__raw, this.opts.lang);
                // Don't proxy the i18n processed array to preserve RDF literal strings
                target[property] = i18nProcessed;
                return i18nProcessed;
              }
            }

            // how can we return a thing that looks flattened,
            // but when mutated affects the original object?
            const flattened = __raw.map(_v => flatten(_v));
            // change the actual target[property] to a proxy to flattened,
            // which itself delegates to real target.
            // this is so flatProxy.push() will change the real target
            const flatProxy = this.proxy(flattened,target[property]);
            target[property] = flatProxy;
            return flatProxy;
          }
          if (target[property].length) {
            // not an this.isArrayProperty,
            // normally return the 0th value,
            // but if i18n is enabled, check for that first
            if (this.opts.i18n && this.opts.lang) {
              // look for an internationalized string
              const re = new RegExp(`"(.*)"\\^\\^${this.opts.lang}$`);
              let i18nString;
              if (target[property].some((v) => {
                if (typeof v === "string") {
                  const rr = v.match(re);
                  if (rr) {
                    i18nString = rr[1];
                    return true;
                  }
                }
                else if (typeof v === "object" && v["@language"] === this.opts.lang) {
                  i18nString = v["@value"];
                  return typeof i18nString === "string";
                }
                return false;
              })) {
                return i18nString;
              }
            }
            // else return 0th
            const first = target[property][0];
            return flatten(first);
          }
          return undefined;
        }
        // real property is not an array.
        // eslint-disable-next-line prefer-rest-params
        // let value = Reflect.get(...arguments);
        let value = Reflect.get(target,property,receiver);
        value = flatten(value);
        // if caller asked for an array, give it
        if (typeof value !== "undefined" && asArray) {
          value = [value];
        }

        return value;
      },
      /**
       * @function
       * @memberOf {Ld~Proxy}
       */
      set: (target, property, value, receiver) => {
        // if this proxy delegates to a realTarget, then what?
        // seems like we need to mutate the fake target, and the real-target
        // so they stay in sync without upsetting the reference to this proxy
        const targets = [target];
        if (_realTarget) {
          targets.push(_realTarget);
        }

        const returnVals= targets.map((_target) => {
          // console.log(`proxy set ${property} proposed => ${JSON.stringify(value)}`);
          if (this.isArrayProperty(property,__context)) {
            // if set on an array property, assume callers knows best
            return Reflect.set(_target,property,value);
          }
          let targetValue = _target[property];
          if (targetValue) {
            const rawTargetValue = this.isProxy(targetValue) ? targetValue = targetValue.__raw : targetValue;

            const ttyp = typeof targetValue;
            const vtyp = typeof value;

            // setting a value onto an array that is NOT an ontology array
            // Unfortunately, Array.isArray thinks that the Array.prototype is
            // an array, which is weird and untrue from what I can tell.
            if (property !== "__proto__" && Array.isArray(targetValue)) {
              // see if it is JSON-LD values or plain values
              let _v = value;
              let atyp = "plain";
              if (this.opts.proxyFlatten !== false) {
                if (_.get(rawTargetValue,"[0].@value")) {
                  atyp = "@value";
                  _v = { "@value": value };
                }
                else if (_.get(rawTargetValue,"[0].@id")) {
                  atyp = "@id";
                  _v = { "@id": value };
                }
                else {
                  // current value is a plain array.
                }
              }

              // Handle i18n behavior when setting values
              if (this.opts.i18n && this.opts.lang && typeof value === "string") {
                // Check if the existing array contains i18n content
                const hasI18nContent = rawTargetValue.some(item => {
                  if (typeof item === "string") {
                    return item.match(/^"(.+)"\^\^(.+)$/);
                  }
 else if (typeof item === "object" && item !== null) {
                    return item["@value"] !== undefined && item["@language"];
                  }
                  return false;
                });

                if (hasI18nContent) {
                  // Determine the format to use based on existing content
                  // Prefer RDF literal format if any are present, otherwise use JSON-LD format
                  const hasRdfLiterals = rawTargetValue.some(item =>
                    typeof item === "string" && item.match(/^"(.+)"\^\^(.+)$/)
                  );

                  if (hasRdfLiterals) {
                    // Use RDF literal format for consistency
                    _v = `"${value}"^^${this.opts.lang}`;
                  }
 else {
                    // Use JSON-LD format for consistency
                    _v = { "@value": value, "@language": this.opts.lang };
                  }

                  // Look for existing value in current language and replace it
                  const currentLangPattern = new RegExp(`^"(.*)"\\^\\^${this.opts.lang}$`);
                  let replacedExisting = false;

                  for (let i = 0; i < targetValue.length; i++) {
                    const item = targetValue[i];
                    if (typeof item === "string" && item.match(currentLangPattern)) {
                      // Replace existing RDF literal in current language
                      targetValue[i] = _v;
                      replacedExisting = true;
                      break;
                    }
 else if (typeof item === "object" && item !== null &&
                               item["@language"] === this.opts.lang) {
                      // Replace existing JSON-LD value object in current language
                      targetValue[i] = _v;
                      replacedExisting = true;
                      break;
                    }
                  }

                  if (!replacedExisting) {
                    // Prepend new value for current language
                    targetValue.unshift(_v);
                  }
                  return true;
                }
              }
              // target property is an array length 1, replace it unless isArrayProperty
              if (targetValue.length === 1) {
                // return Reflect.set(_target,property,[_v]);
                // targetValue may be a proxy, which should do the right thing.
                targetValue[0] = _v;
                return true;
              }
              let key;
              _.keys(_v).some((k) => {
                if (k === "@value" || k === "@id") {
                  key = k;
                  return true;
                }
                return false;
              });

              // look for an identical entry...
              if (targetValue.some((el,i) => {
                // if new value is already in the values, leave it, but move existing to front
                if ((key && el[key] === _v[key]) || (el === _v)) {
                  // const newArray = _.cloneDeep(targetValue);
                  const moved = targetValue.splice(i,1);
                  targetValue.unshift(moved);
                  return true;
                  // return Reflect.set(_target,property,newArray);
                }
                return false;
              })) {
                return true;
              }
              // else prepend to the existing array
              targetValue.unshift(_v);
              return true;
            }
            return Reflect.set(_target,property,value);
          }
          // else just make the set.
          // eslint-disable-next-line prefer-rest-params
          const _returnVal = Reflect.set(_target,property,value);
          return _returnVal;
        });
        return !returnVals.some(rv => rv === false);
      }
    });
    return proxy;
  }

  /**
   * Is it a {@link Ld~Proxy}?
   * @param {*} obj
   * @returns {boolean}
   */
  isProxy(obj) {
    if (typeof obj === "object") {
      return !!obj?.__isProxy;
    }
    return false;
  }

  /**
   * Turn a proxy and any embedded proxies back into original objects.
   * @param {object|object[]} obj
   * @returns {object}
   */
  unproxy(obj) {
    assert.ok(typeof obj === "object"); // may also be array
    const proxyPaths = jsonPath(obj,"$..['__isProxy']",{resultType:"PATH"});
    if (proxyPaths) {
      for (const path of proxyPaths) {
        const proxyPath = path.substring(0, path.length - "['__isProxy']".length);
        const found = jsonPath(obj, `${proxyPath}.__raw`);
        if (found) {
          const raw = found[0];
          const setPath = proxyPath.substring(1);
          if (setPath === "") {
            obj = raw;
          }
          else {
            _.set(obj, setPath, raw);
          }
        }
      }
    }
    return obj;
  }

  /**
   * The default isArrayPropertyFn impl.
   * @param property
   * @param {object} [context]
   * @return {boolean}
   * @private
   */
  _defaultIsArrayProperty(property, context) {
    switch (property) {
      case "@type":
        return true;
      default:
    }

    // Check if property has @container: @set or @list in context
    context = context ?? this.opts.context;
    if (context && context[property] && typeof context[property] === "object") {
      const container = context[property]["@container"];
      // container may be either a string or an array like ["@set","@language"]
      if (container && (container.includes("@set") || container.includes("@list"))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Should **property** be treated as an array for purposes
   * of {@link Ld.compact} and {@link Ld~Proxy}?
   * @param {string} property
   * @param {object} [context]
   * @return {boolean}
   */
 isArrayProperty(property, context) {
   context = context ?? this.opts.context;
   if (this.opts.isArrayPropertyFn) {
     return this.opts.isArrayPropertyFn(property, context);
   }
 }

  /**
   * _.cloneDeep on an object that might be a proxy.
   * If it is a proxy, a cloned proxy is returned.
   * @param obj
   * @return {object}
   */
  clone(obj) {
    if (typeof obj === "object") {
      const isProxy = this.isProxy(obj);
      const source = isProxy ? obj.__raw : obj;
      const clone = _.cloneDeep(source);
      return isProxy ? this.proxy(clone) : clone;
    }
    return obj;
  }

  /**
   * Expand a resource, using a provided context or with opts.context.
   * jsonld doesn't like to expand resources without context, hence this function.
   *
   * Never returns a {@link Ld~Proxy}, because expanded form doesn't work well with proxy.
   *
   * @param {object|Array} resource
   * @param {Context} [context]
   * @param {object} [opts]
   * @param {boolean} [opts.flatten] flatten the res before expanding, rarely needed
   * @return {Promise<Resource[]>} always returns an array even if input is a single resource
   */
  async expand(resource, context, opts={}) {
    check(resource,Match.OneOf(Object,Array));
    check(context, Match.Optional(Object));
    check(opts,Object);
    context = context ?? this.opts.context;

    // Handle single resource or array of resources
    let inputForExpansion;
    if (Array.isArray(resource)) {
      inputForExpansion = resource;
    }
 else {
      // Single resource - could be a @graph document or individual resource
      inputForExpansion = resource;
    }

    let _input = _.cloneDeep(this.unproxy(inputForExpansion));

    // If it's an array, process each resource
    if (Array.isArray(_input)) {
      for (const _resource of _input) {
        if (_resource._id && _resource["@id"]) {
          // cant have both, it confuses jsonld
          delete _resource["@id"];
        }
        if (_resource["@context"]) {
          _.merge(context,_resource["@context"]);
        }
        _resource["@context"] = context;
      }
    }
 else {
      // Single resource/document
      if (_input._id && _input["@id"]) {
        delete _input["@id"];
      }
      if (_input["@context"]) {
        _.merge(context, _input["@context"]);
      }
      _input["@context"] = context;
    }

    if (opts.flatten) {
      _input = await jsonld.flatten(_input);
    }

    const expanded = await jsonld.expand(_input);

    // jsonld.expand returns the correct format - an array of expanded resources
    // No need to wrap or unwrap - just return what jsonld gives us
    return expanded;
  }

  /**
   * This is a wrapper around jsonld.compact, to ensure that all compacted resources
   * are consistent with the BOLD stack usage and safe for persistence in MongoDB.
   *
   * This includes some protections against inconsistent behavior found in jsonld.compact
   * as of the original writing, which used jsonld v5. These inconsistencies may have been
   * corrected in more recent versions.
   *
   * jsonld.compact requires a @context in the compacted document, but
   * BOLD resources do not typically have an embedded @context, so
   * LD~compact inserts a context provided as an argument, or using
   * opts.context of the LD instance.
   *
   * jsonld does (did) unpredictable things when you compact a non-expanded resource,
   * so the default behavior is to expand all resources before compacting.
   * You can suppress that with an option.
   *
   * Properties which are expected to be arrays, according to contxt[key]["@container]
   * (@set or @list) are always expressed in arrays, even if length 1. jsonld.compact()
   * _should_ do this but the results were undependable, so **opts.ensureArrayProps**
   * enforces that with extra logic.
   *
   * If opts.flatten, then any embedded documents within the JSON-LD resources will be
   * flattened into independent entities.
   *
   * Any rdf:type properties found in resources will be converted to @type.
   *
   * If input resource is an Array of multiple resources, then this will return a JSON-LD
   * Graph Object {@link https://w3c.github.io/json-ld-syntax/#dfn-graph-object},
   * which will have a @graph property containing the compacted resources.
   *
   * Returns {@link Ld~Proxy} if **opts.proxy**, normal default comes from {@link Ld.opts.proxy}.
   *
   * @param {object|Array} resource
   * @param {Context} [context]
   * @param {object} [opts]
   * @param {boolean} [opts.firstExpand=true] do expand the res before compacting (slower but more consistent result)
   * @param {boolean} [opts.flatten] flatten the res before compacting, rarely needed
   * @param {boolean} [opts.showContext=true] include @context in result
   * @param {boolean} [opts.ensureArrayProps=true] enforces @container behavior
   * @param {boolean} [opts.ensureSafeKeys=true] prevent un-compacted keys or bad characters like "."
   * @param {function} [opts.sortTypesFn] sort @type properties
   * @param {boolean} [opts.normalizeI18N=true] {@link Ld.normalizeI18N}
   * @param {boolean} [opts.normalizeLists=true] {@link Ld.normalizeLists}
   * @param {boolean} [opts.normalizeJSON] UNIMPLEMENTED JUST YET {@link Ld.normalizeJSON}
   * @param {boolean} [opts.proxy] return {@link Ld~Proxy} instead of a plain object
   *
   * @return {Promise<Resource>}
   */
  async compact(resource, context, opts) {
    check(resource,Match.OneOf(Object,Array));
    check(context, Match.Optional(Object));
    check(opts, Match.Optional(Object));
    opts = opts || {};
    opts.firstExpand = opts.firstExpand !== false;
    opts.showContext = opts.showContext !== false;
    if (opts.proxy === undefined) {
      opts.proxy = this.opts.proxy;
    }
    opts.ensureArrayProps = opts.ensureArrayProps !== false;
    opts.ensureSafeKeys = opts.ensureSafeKeys !== false;
    opts.sortTypesFn = opts.sortTypesFn ?? this.opts.sortTypesFn;
    opts.cleanupResourceFn = opts.cleanupResourceFn ?? this.opts.cleanupResourceFn;
    let usingDefaultContext = false;
    if (!context) {
      context = this.opts.context;
      usingDefaultContext = true;
    }

    const expandedTypeUri = this.expandQName(this.opts.typeUri,context);
    let isProxy = false;
    if (resource.__isProxy) {
      isProxy = true;
      resource = resource.__raw;
    }
    // resources should be an array of actual resources, not a @graph object
    // eslint-disable-next-line no-nested-ternary
    const resources = resource["@graph"] ? resource["@graph"] : (_.isArray(resource) ? resource : [resource]);
    let _resources = _.cloneDeep(resources);
    for (const _resource of _resources) {
      if (_resource._id && _resource["@id"]) {
        // cant have both, it confuses jsonld
        delete _resource["@id"];
      }
      if (_resource["@context"]) {
        delete _resource["@context"];
      }
      _resource["@context"] = context;
      if (_resource._id === "@context") {
        // this can't be compacted
        return resource;
      }
      if (!_resource["@type"] && _resource[this.opts.typeUri]) {
        _resource["@type"] = _resource[this.opts.typeUri];
        delete resource[this.opts.typeUri];
      }
      if (!_resource["@type"] && _resource[expandedTypeUri]) {
        _resource["@type"] = _resource[expandedTypeUri];
        delete _resource[expandedTypeUri];
      }
    }
    if (opts.flatten) {
      _resources = await jsonld.flatten(_resources);
    }

    _resources = this.compactKeys(_resources,context);
    if (opts.firstExpand) {
      _resources = await this.expand(_resources,context);
    }

    let compacted = await jsonld.compact(_resources,context);

    const reKeyed = this.compactKeys(compacted,context, {recursive:true});
    // Ld.compactKeys always returns an array, but maybe not what is wanted.
    if (_.isArray(compacted)) {
      compacted = reKeyed;
    }
    else {
      compacted = reKeyed.length ? reKeyed[0] : compacted;
    }

    // compacted may be a JSON-LD Graph { @context: {}, @graph: [] }
    // or an array [...resources]
    // or just an object
    let allCompacted;
    if (compacted["@graph"]) {
      allCompacted = compacted["@graph"];
    }
    else if (Array.isArray(compacted)) {
      allCompacted = compacted;
    }
    else {
      allCompacted = [compacted];
    }

    for (let i=0; i < allCompacted.length; i++) {
      const _compacted = allCompacted[i];
      if (!opts.showContext) {
        delete _compacted["@context"];
      }

      if (opts.normalizeI18N !== false) {
        this.normalizeI18N(_compacted, this.opts.lang, context);
      }

      // EXPERIMENTAL: jsonld compact handles this as indicated
      // by @context @container.
      // This makes sure that all properties which should be arrays,
      if (opts.ensureArrayProps) {
        // ARF! the old way doesn't find keys in embedded documents.
        // maybe we can cleverly use _.mergeWith
        const mergeArrifyFn = function(objValue, srcValue, key, object, source, stack) {
          if (["_id", "@context"].indexOf(key) !== -1) {
            // returning value here will cause merge to quit recursing.
            // what we want with @context
            return srcValue;
          }
          // unfortunately @type isn't in the context, so we have to hardcode it.
          // @container may be either a string or an array like ["@set","@language"]
          if (key === "@type" || (context[key]?.["@container"] && context[key]["@container"].includes("@set"))
            || (context[key]?.["@container"] && context[key]["@container"].includes("@list"))) {
            if (!_.isArray(srcValue)) {
              // Important not to recursively merge strings,
              // because _.mergeWith will merge char by char and come out with
              // a bizarro [String: 'abcdef'] object instead of a primitive string.
              if (typeof srcValue === "object") {
                // this should include arrays or {} objects
                return [_.mergeWith(objValue,srcValue,mergeArrifyFn)];
              }
              return [srcValue];
            }
          }
          // lodash says default behavior will be used if customizer returns undefined.
          return undefined;
        };
        _.mergeWith(_compacted,_.cloneDeep(_compacted), mergeArrifyFn);
      }
      // make sure that no uncompacted or bad keys made it past jsonld.compact
      if (opts.ensureSafeKeys) {
        // this only see top-level keys. Is that good enough?
        // NOPE! uncompacted keys can sneak into @context too
        _.keys(_compacted).forEach((k) => {
          if (k.substring(0,4) === "http" || k.indexOf(".") !== -1) {
            // try to fix it
            const compactKey = this.compactUri(k, context);
            if (compactKey !== k) {
              // found a better key
              if (this.opts.debug) {
                console.log(`replacing unsafe key ${k} with ${compactKey}`);
              }
              _compacted[compactKey] = _compacted[k];
            }
            else {
              if (this.opts.debug) {
                console.log(`remove unsafe key ${k} no replacement found.`);
              }
            }
            delete _compacted[k];
          }
        });
        // forgive a little duplication
        // if @context is an array, too much trouble just leave it
        if (_compacted["@context"] && !Array.isArray(_compacted["@context"])) {
          _.keys(_compacted["@context"]).forEach((k) => {
            if (k.substring(0,4) === "http" || k.indexOf(".") !== -1) {
              // try to fix it
              const compactKey = this.compactUri(k, context);
              if (compactKey !== k) {
                // found a better key
                if (this.opts.debug) {
                  console.log(`replacing unsafe key ${k} with ${compactKey}`);
                }
                _compacted["@context"][compactKey] = _compacted["@context"][k];
              }
              else {
                if (this.opts.debug) {
                  console.log(`remove unsafe key ${k} from context no replacement found.`);
                }
              }
              delete _compacted["@context"][k];
            }
          });
        }
      }

      if (opts.sortTypesFn) {
        const paths = jsonPath(_compacted,"$..['@type']",{resultType:"PATH"});
        for (let j=0; j<paths.length; j++) {
          const path = paths[j];
          if (path.indexOf("@context") > -1) {
            continue;
          }
          const $ = _compacted;
          // eslint-disable-next-line no-eval
          const types = eval(`${path}`);
          if (Array.isArray(types) && types.length > 1) {
            const sortedTypes = await opts.sortTypesFn(types,context);
            // console.log("orig types",types);
            // console.log("sortedTypes",sortedTypes);
            const _path = path.substring(1); // cut off the $
            _.set($,_path,sortedTypes);
          }
        }
      }
      if (opts.cleanupResourceFn) {
        opts.cleanupResourceFn(_compacted);
      }
      if (opts.normalizeLists !== false) {
        this.normalizeLists(_compacted);
      }
    }
    if (opts.proxy) {
      // I'm not sure if compacted is ever an array these days.
      if (Array.isArray(compacted)) {
        for (const i in compacted) {
          compacted[i] = this.proxy(compacted[i], undefined, usingDefaultContext ? undefined : context);
        }
      }
      else if (compacted["@graph"]) {
        for (const i in compacted["@graph"]) {
          compacted["@graph"][i] = this.proxy(compacted["@graph"][i], undefined, usingDefaultContext ? undefined : context);
        }
      }
      else {
        compacted = this.proxy(compacted, undefined, usingDefaultContext ? undefined : context);
      }
    }
    return compacted;
  }

  /**
   * This is an internal helper to {@link Ld.compact}, because it otherwise won't compact values
   * of uncompacted keys, because the ontology entries for those properties are in prefix form.
   * @param {object|Array} resource
   * @param {Context} context
   * @param {object} [opts]
   * @param {boolean} [opts.recursive] recursively compact nested objects
   * @param {boolean} [opts.cleanUnsafeKeys] clean unsafe keys
   * @param {Array} [opts.nsList] namespace list
   * @return {Array}
   */
  compactKeys(resource, context, opts) {
    check(resource,Match.OneOf(Object,Array));
    check(context,Object);
    check(opts, Match.Optional(Object));
    opts = opts || {};
    opts.cleanUnsafeKeys = opts.cleanUnsafeKeys !== false;
    const resources = _.isArray(resource) ? resource : [resource];
    const nsList = opts.nsList || [];
    if (nsList.length === 0) {
      _.keys(context).forEach((k) => {
        switch (k) {
          case "_id":
          case "@id":
          case "@type":
          case "@context":
            return;
          default:
            break;
        }
        if (typeof context[k] === "string") {
          const re = new RegExp("^"+context[k]+"(.+)");
          nsList.push({
            re: re,
            prefix: k
          });
        }
      });
    }

    // eslint-disable-next-line no-shadow
    const compactedResources = resources.map((resource) => {
      if (typeof resource !== "object") {
        return resource;
      }
      let compactedResource = {};
      if (_.isArray(resource)) {
        compactedResource = this.compactKeys(resource, context, {
          recursive:true,
          nsList: nsList
        });
      }
      else {
        _.keys(resource).forEach((k) => {
          let resKey = k;
          nsList.some((nsi) => {
            const rr = nsi.re.exec(k);
            if (rr) {
              resKey = nsi.prefix === "@vocab" ? rr[1] : nsi.prefix+":"+rr[1];
              return true;
            }
            return false;
          });
          if (opts.cleanUnsafeKeys) {
            if (resKey.substring(0, 4) === "http" || resKey.indexOf(".") !== -1) {
              // try to fix it
              const compactKey = this.compactUri(resKey, context);
              if (compactKey !== resKey) {
                // found a better key
                if (this.opts.debug) {
                  console.log(`replacing unsafe key ${resKey} with ${compactKey}`);
                }
                resKey = compactKey;
              }
              else {
                if (this.opts.debug) {
                  console.log(`remove unsafe key ${resKey} no replacement found.`);
                }
                return;
              }
            }
          }
          compactedResource[resKey] = resource[k];
          // Some things we should not recursive compact, particularly @context
          switch (k) {
            case "_id":
            case "@id":
            case "@type":
            case "@context":
              return;
            default:
              break;
          }

          if (opts.recursive !== false) {
            // we can recurse only plain objects and arrays,
            const _val = compactedResource[resKey];
            if (_.isPlainObject(_val) || _.isArray(_val)) {
              const isArray = _.isArray(compactedResource[resKey]);
              try {
                const subCompact = this.compactKeys(compactedResource[resKey], context, {
                  recursive:true,
                  nsList: nsList
                });
                if (isArray) {
                  compactedResource[resKey] = subCompact;
                }
                else {
                  compactedResource[resKey] = subCompact[0];
                }
              }
              catch (e) {
                // unconventional choice to eat this error.
                if (this.opts.debug) {
                  console.log(`Ld.compactKeys threw on key=${resKey} for ${JSON.stringify(compactedResource, null, 2)} ${e.stack}`);
                }
              }
            }
            else if (typeof compactedResource[resKey] === "object") {
              if (this.opts.debug) {
                console.log(`Ld.compactKeys skipped weird object on key=${resKey} for ${JSON.stringify(compactedResource, null, 2)}`);
              }
            }
          }
        });
      }
      return compactedResource;
    });
    return compactedResources;
  }

  /**
   * Return {@link QName} for URI according to prefixes in context.
   * @param {string} uri
   * @param {Context} context
   * @returns {string}
   */
  compactUri(uri, context) {
    check(uri,String);
    check(context, Object);

    let qname;
    _.keys(context).some((k) => {
      switch (k) {
        case "_id":
        case "@id":
        case "@type":
          return false;
        default:
          break;
      }
      if (typeof context[k] === "string") {
        const re = new RegExp("^"+context[k]+"(.+)");
        const rr = re.exec(uri);
        if (rr) {
          if (k === "@vocab") {
            qname = rr[1];
          }
          else {
            qname = k+":"+rr[1];
          }
          return true;
        }
      }
      return false;
    });
    return qname || uri;
  }

  /**
   * Return URI for {@link QName} according to prefixes in context.
   * @param {string} qname
   * @param {Context} context
   * @returns {string}
   */
  expandQName(qname, context) {
    check(qname,String);
    check(context, Object);

    let uri;
    _.keys(context).some((k) => {
      // skip property keys, which will always have : (qname or uri)
      if (k.includes(":")) {
        return false;
      }
      switch (k) {
        case "_id":
        case "@id":
        case "@type":
          return false;
        default:
          break;
      }
      if (typeof context[k] === "string") {
        if (k === "@vocab") {
          // @vocab should be substituted for qnames with no :
          if (!qname.includes(":")) {
            uri = context[k]+qname;
            return true;
          }
          return false;
        }
        // this will match http: and https:,
        // but since there is no ns mapping that's ok
        const re = new RegExp(`${k}:(.+)`);
        const rr = re.exec(qname);
        if (rr && context[k]) {
          uri = context[k]+rr[1];
          return true;
        }
      }
      return false;
    });
    return uri || qname;
  }

  /**
   * Normalize i18n strings in a resource.
   * @param {object} resource
   * @param {string} [defaultLang]
   * @param {object} [context] - JSON-LD context to check for language map containers
   */
  normalizeI18N(resource, defaultLang, context) {
    check(resource,Object);
    check(defaultLang,Match.Optional(String));
    check(context,Match.Optional(Object));
    defaultLang = defaultLang ?? this.opts.lang;
    context = context ?? this.opts.context;

    // Handle language maps (@container: ["@language", "@set"])
    if (context) {
      this._processLanguageMaps(resource, context, defaultLang);
    }

    const paths = jsonPath(resource, "$..['@language']", {resultType:"PATH"});
    if (paths) {
      const i18nPaths = [];
      for (const path of paths) {
        i18nPaths.push(path.substring(0,path.length-("['@languange']".length-1)));
      }
      const predPaths = {};
      for (const path of i18nPaths) {
        const found = jsonPath(resource,path);
        if (found) {
          const obj = found[0];
          const lang = obj["@language"];
          const val = obj["@value"];
          let i18nString;
          if (lang && val) {
            if (lang === defaultLang) {
              i18nString = val;
            }
            else {
              i18nString = `"${obj["@value"]}"^^${obj["@language"]}`;
            }
          }
          else {
            // what if we get some broken obj that doesn't have @value?
            // seems unlikely but any case don't let an obj escape
            i18nString = JSON.stringify(obj);
          }

          // find path to replace
          // it helps here that jsonPath is consistent.
          const rr = path.match(/(.*)\['?([^']+)'?]$/);
          if (rr) {
            predPaths[rr[1]] = 1;
            // replace the obj with string, without eval!
            jsonPath(resource,rr[1])[0][rr[2]] = i18nString;
          }
        }
      }
      // eslint-disable-next-line no-inner-declarations
      function sortFn(a,b) {
        const aw = a.match(/\^\^..$/) ? 1 : 0;
        const bw = b.match(/\^\^..$/) ? 1 : 0;
        return aw - bw;
      }
      const $ = resource;
      for (const predPath in predPaths) {
        // eslint-disable-next-line no-eval
        const av = jsonPath(resource,predPath)?.[0];
        if (Array.isArray(av)) {
          av.sort(sortFn);
        }
      }
    }
  }

  /**
   * Process language maps with @container: ["@language", "@set"] or similar
   * @param {object} resource
   * @param {object} context
   * @param {string} defaultLang
   * @private
   */
  _processLanguageMaps(resource, context, defaultLang) {
    for (const [key, value] of Object.entries(resource)) {
      if (key.startsWith("@")) continue; // Skip JSON-LD keywords

      // Check if this property has a language map container
      const contextDef = context[key];
      if (contextDef && typeof contextDef === "object" && contextDef["@container"]) {
        const container = contextDef["@container"];
        const hasLanguageContainer = Array.isArray(container) ?
          container.includes("@language") :
          container === "@language";

        if (hasLanguageContainer && value && typeof value === "object" && !Array.isArray(value)) {
          // This is a language map - flatten it to i18n strings
          const i18nStrings = [];

          for (const [lang, langValues] of Object.entries(value)) {
            if (lang.startsWith("@")) continue; // Skip JSON-LD keywords

            const values = Array.isArray(langValues) ? langValues : [langValues];
            for (const val of values) {
              if (lang === defaultLang) {
                i18nStrings.push(val);
              }
              else {
                i18nStrings.push(`"${val}"^^${lang}`);
              }
            }
          }

          // Replace the language map with the flattened i18n strings
          resource[key] = i18nStrings;
        }
      }

      // Recursively process nested objects
      if (typeof value === "object" && value !== null) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === "object" && item !== null) {
              this._processLanguageMaps(item, context, defaultLang);
            }
          }
        }
        else {
          this._processLanguageMaps(value, context, defaultLang);
        }
      }
    }
  }

  /**
   * Process an array of values for enhanced i18n support with language prioritization.
   * Current language values appear first as plain strings, other language values
   * appear as RDF i18n literals ("value"^^lang). Supports both input formats:
   * RDF literals and JSON-LD @value/@language objects.
   *
   * @param {Array} values - Array of values that may include i18n content
   * @param {string} currentLang - Current language code (e.g., "en", "it")
   * @returns {Array} - Processed array with current language first, others as RDF literals
   * @private
   */
  _processI18nArray(values, currentLang) {
    check(values, Array);
    check(currentLang, String);

    if (!values || values.length === 0) {
      return [];
    }

    const currentLangValues = [];
    const otherLangValues = [];
    const nonI18nValues = [];

    for (const value of values) {
      if (typeof value === "string") {
        // Check if it's an RDF i18n literal format: "value"^^lang
        const rdfMatch = value.match(/^"(.+)"\^\^(.+)$/);
        if (rdfMatch) {
          const [, literalValue, lang] = rdfMatch;
          if (lang === currentLang) {
            // Current language - add as plain string
            currentLangValues.push(literalValue);
          }
 else {
            // Other language - keep as RDF literal
            otherLangValues.push(value);
          }
        }
 else {
          // Plain string - assume current language or language-neutral
          currentLangValues.push(value);
        }
      }
 else if (typeof value === "object" && value !== null) {
        // Check if it's a JSON-LD @value/@language object
        if (value["@value"] !== undefined && value["@language"]) {
          if (value["@language"] === currentLang) {
            // Current language - add as plain string
            currentLangValues.push(value["@value"]);
          }
 else {
            // Other language - convert to RDF literal format
            otherLangValues.push(`"${value["@value"]}"^^${value["@language"]}`);
          }
        }
 else {
          // Non-i18n object - keep as is
          nonI18nValues.push(value);
        }
      }
 else {
        // Non-string, non-object value - keep as is
        nonI18nValues.push(value);
      }
    }

    // Return with current language first, then other languages, then non-i18n
    return [...currentLangValues, ...otherLangValues, ...nonI18nValues];
  }

  /**
   * Flatten @list and @set objects into just an array.
   * @param {Resource} resource
   * @param {object} [opts]
   */
  normalizeLists(resource, opts = {}) {
    check(resource,Object);
    check(opts, Match.Optional(Object));
    for (const listOrSet of ["@list","@set"]) {
      const listPaths = jsonPath(resource, `$..['${listOrSet}']`, {resultType:"PATH"});
      if (listPaths) {
        for (const path of listPaths) {
          // get the value which should be an array
          const found = jsonPath(resource,path);
          if (found) {
            const list = found[0];
            const re = new RegExp(`([$].*)\\['?(.*?)'?]\\['${listOrSet}']`);
            const rr = re.exec(path);
            if (rr) {
              const _found = jsonPath(resource,rr[1]);
              if (_found) {
                _found[0][rr[2]] = list;
              }
            }
          }
        }
      }
    }
  }

  /**
   * Convert a string to kebab-case (dash-separated lowercase)
   * @param {string} str - The string to convert
   * @returns {string} The kebab-case string
   */
  kebabCase(str) {
    check(str, String);
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2") // Add dash between camelCase words
      .replace(/[\s_]+/g, "-") // Replace spaces and underscores with dashes
      .replace(/[^\w-]/g, "") // Remove non-word characters except dashes
      .toLowerCase(); // Convert to lowercase
  }

  /**
   * Get module version
   * @returns {string} The module version
   */
  getVersion() {
    return this.version;
  }

  /**
   * Convert MongoDB document(s) _id to valid JSON-LD @id.
   *
   * BOLD stores @id as _id in MongoDB.
   *
   * When the JSON-LD context includes `"_id": "@id"`, compaction converts ALL @id to _id,
   * including nested node references. This method reverses that conversion for export.
   *
   * @param {object|Array} input - Document or array of documents to convert
   * @param {object} [opts] - Options
   * @param {boolean} [opts.deep=true] - Recursively process nested objects
   * @returns {object|Array} Converted document(s) with @id instead of _id
   *
   * @example
   * // Convert a single resource
   * const jsonld = LD.mongoToJsonld({
   *   _id: "foaf:Person",
   *   "rdfs:isDefinedBy": { _id: "http://xmlns.com/foaf/0.1/" }
   * });
   * // Result: { "@id": "foaf:Person", "rdfs:isDefinedBy": { "@id": "http://xmlns.com/foaf/0.1/" } }
   */
  static mongoToJsonld(input, opts = {}) {
    const deep = opts.deep !== false;

    function convertObject(obj) {
      if (obj === null || typeof obj !== "object") {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(item => convertObject(item));
      }

      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        // Convert _id to @id
        const newKey = key === "_id" ? "@id" : key;

        // Recursively process nested objects if deep=true
        if (deep && value !== null && typeof value === "object") {
          result[newKey] = convertObject(value);
        }
        else {
          result[newKey] = value;
        }
      }
      return result;
    }

    return convertObject(input);
  }

  /**
   * Convert JSON-LD document(s) to MongoDB-safe format by recursively converting @id to _id.
   *
   * This is the inverse of mongoToJsonld(). Use this before storing JSON-LD in MongoDB.
   *
   * @param {object|Array} input - Document or array of documents to convert
   * @param {object} [opts] - Options
   * @param {boolean} [opts.deep=true] - Recursively process nested objects
   * @returns {object|Array} Converted document(s) with _id instead of @id
   */
  static jsonldToMongo(input, opts = {}) {
    const deep = opts.deep !== false;

    function convertObject(obj) {
      if (obj === null || typeof obj !== "object") {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(item => convertObject(item));
      }

      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        // Convert @id to _id
        const newKey = key === "@id" ? "_id" : key;

        // Recursively process nested objects if deep=true
        if (deep && value !== null && typeof value === "object") {
          result[newKey] = convertObject(value);
        }
        else {
          result[newKey] = value;
        }
      }
      return result;
    }

    return convertObject(input);
  }

}

// Export the class as the default export
export { LD };
export default LD;
