/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2026 2wav, Inc.
 */

import { assert } from "chai";
import _ from "lodash";
import LD from "../src/ld.js";
import jsonPath from "../src/lib/jsonpath.js";

describe("LD.compact", function () {
  let ld;
  this.timeout(0);

  before(function() {
    ld = new LD({
      context: DEFAULT_CONTEXT
    });
  });

  it("ld expand", async function() {
    const res = {
      "@id": "2wav:thing1",
      width: 10,
      where: "2wav:livingRoom"
    };
    const expanded = await ld.expand(res);
    assert.ok(!ld.isProxy(expanded[0]), "Ld.expand never returns a proxy");
    // debugLogger(`expanded: ${JSON.stringify(expanded,null,2)}`);
    assert.equal(_.get(expanded, "[0][\"https://ontology.2wav.com#width\"][0][\"@value\"]"),10);
  });

  it("should compact a resource with context", async function() {
    const testContext = {
      "@vocab": "http://example.org/",
      "name": "http://example.org/name",
      "type": "http://example.org/type"
    };

    const resource = {
      "@id": "http://example.org/resource1",
      "http://example.org/name": "Test Resource",
      "http://example.org/type": "TestType"
    };

    const compacted = await ld.compact(resource, testContext, {
      firstExpand: true,
      showContext: true,
      ensureSafeKeys: true
    });

    assert.property(compacted, "@context", "should include @context");
    assert.property(compacted, "@id", "should include @id");
    assert.property(compacted, "name", "should have compacted name property");
    assert.property(compacted, "type", "should have compacted type property");
    assert.equal(compacted.name, "Test Resource", "should preserve name value");
    assert.equal(compacted.type, "TestType", "should preserve type value");
    assert.equal(compacted["@id"], "http://example.org/resource1", "should preserve @id");
  });

  it("should compact URIs to QNames", function() {

    const testContext = {
      "@vocab": "http://example.org/",
      "foaf" : "http://xmlns.com/foaf/0.1/"
    };

    const uri = "http://example.org/test";
    const compactedUri = ld.compactUri(uri, testContext);
    assert.equal(compactedUri, "test", "should compact URI to QName using @vocab");

    const nameUri = "http://xmlns.com/foaf/0.1/name";
    const compactedNameUri = ld.compactUri(nameUri, testContext);
    assert.equal(compactedNameUri, "foaf:name", "should compact URI to prefixed QName");
  });

  it("should expand QNames to URIs", function() {
    const testContext = {
      "@vocab": "http://example.org/",
      "foaf" : "http://xmlns.com/foaf/0.1/"
    };

    const qname = "test";
    const expandedQName = ld.expandQName(qname, testContext);
    assert.equal(expandedQName, "http://example.org/test", "should expand QName using @vocab");

    const prefixedQname = "foaf:name";
    const expandedPrefixedQname = ld.expandQName(prefixedQname, testContext);
    assert.equal(expandedPrefixedQname, "http://xmlns.com/foaf/0.1/name", "should expand prefixed QName");
  });

  it("should handle compact with proxy option", async function() {

    const testContext = {
      "@vocab": "http://example.org/",
      "foaf" : "http://xmlns.com/foaf/0.1/"
    };

    const resource = {
      "@id": "http://example.org/resource1",
      "http://xmlns.com/foaf/0.1/name": ["Test Resource"]
    };

    const compacted = await ld.compact(resource, testContext, {
      firstExpand: true,
      proxy: true
    });
    assert.isTrue(ld.isProxy(compacted), "should return a proxy when proxy option is true");
    assert.isObject(compacted.__raw, "proxy should have __raw property");
    assert.equal(compacted["foaf:name"], "Test Resource", "proxy should provide flattened access");
  });

  it("should handle compact without proxy option", async function() {
    // ld.opts.isArrayPropertyFn = function(property) {
    //   if (property.includes("name")) {
    //     return true;
    //   }
    //   return false;
    // };

    const testContext = {
      "@vocab": "http://example.org/",
      "foaf" : "http://xmlns.com/foaf/0.1/"
    };
    // compacting an array with just one element will also flatten it
    const resource = {
      "@id": "http://example.org/resource1",
      "http://xmlns.com/foaf/0.1/name": ["Test Resource","Also Test Resource"]
    };

    const compacted = await ld.compact(resource, testContext, {
      firstExpand: false, // true will flatten name, surprise there
      proxy: false
    });

    assert.isFalse(ld.isProxy(compacted), "should not return a proxy when proxy option is false");
    assert.property(compacted, "foaf:name", "should have compacted properties");
    assert.isArray(compacted["foaf:name"], "should not flatten array");
  });

  it("should handle compact with ensureSafeKeys", async function() {
    const testContext = {
      "@vocab": "http://example.org/"
    };

    const resource = {
      "@id": "http://example.org/resource1",
      "http://example.org/name": "Test Resource",
      "http://example.org/unsafe.key": "Unsafe Value"
    };

    const compacted = await ld.compact(resource, testContext, {
      firstExpand: true,
      ensureSafeKeys: true
    });


    assert.property(compacted, "name", "should have safe compacted property");
    assert.notProperty(compacted, "http://example.org/unsafe.key", "should remove unsafe keys");
    assert.equal(compacted.name, "Test Resource", "should preserve safe values");
  });

  it("should handle compact with showContext false", async function() {
    const testContext = {
      "@vocab": "http://example.org/",
      "foaf" : "http://xmlns.com/foaf/0.1/"
    };

    const resource = {
      "@id": "http://example.org/resource1",
      "http://xmlns.com/foaf/0.1/name": ["Test Resource"]
    };

    const compacted = await ld.compact(resource, testContext, {
      firstExpand: true,
      showContext: false
    });

    assert.notProperty(compacted, "@context", "should not include @context when showContext is false");
    assert.property(compacted, "foaf:name", "should still have compacted properties");
  });

  it("should handle compact with firstExpand false", async function() {
    const testContext = {
      "@vocab": "http://example.org/",
      "foaf" : "http://xmlns.com/foaf/0.1/"
    };

    const resource = {
      "@id": "http://example.org/resource1",
      "http://xmlns.com/foaf/0.1/name": ["Test Resource"]
    };

    const compacted = await ld.compact(resource, testContext, {
      firstExpand: false,
      showContext: true
    });

    assert.property(compacted, "@context", "should include @context");
    assert.property(compacted, "foaf:name", "should have compacted properties");
    assert.equal(compacted["foaf:name"], "Test Resource", "should preserve values");
  });

  it("should handle compact with custom sortTypesFn", async function() {
    ld.opts.isArrayPropertyFn = function(property) {
      if (property === "@type") {
        return true;
      }
      return false;
    };

    const testContext = {
      "@vocab": "http://example.org/",
      "foaf" : "http://xmlns.com/foaf/0.1/"
    };

    const resource = {
      "@id": "http://example.org/resource1",
      "@type": ["TypeB", "TypeA", "TypeC"],
      "http://example.org/name": "Test Resource"
    };

    let sortCalled = false;
    const customSortFn = (types, context) => {
      sortCalled = true;
      return types.sort();
    };


    const compacted = await ld.compact(resource, testContext, {
      firstExpand: true,
      sortTypesFn: customSortFn
    });

    assert.isTrue(sortCalled, "should call custom sortTypesFn");
    assert.property(compacted, "@type", "should have @type property");
    assert.isArray(compacted["@type"], "should have array of types");
  });

  it("should handle compact with normalizeI18N", async function() {
    ld.opts.isArrayPropertyFn = function(property) {
      if (property === "name") {
        return true;
      }
      return false;
    };

    const testContext = {
      "@vocab": "http://example.org/"
    };

    const resource = {
      "@id": "http://example.org/resource1",
      "http://example.org/name": [
        { "@value": "English Name", "@language": "en" },
        { "@value": "Spanish Name", "@language": "es" }
      ]
    };

    const compacted = await ld.compact(resource, testContext, {
      firstExpand: true,
      normalizeI18N: true
    });

    assert.property(compacted, "name", "should have compacted name property");
    assert.isArray(compacted.name, "should have array of i18n values");
    assert.include(compacted.name, "English Name", "should include English value");
    assert.include(compacted.name, "\"Spanish Name\"@es", "should include Spanish value with language tag");
  });

  it("should handle compact with normalizeLists", async function() {
    ld.opts.isArrayPropertyFn = function(property) {
      if (property.includes("name")) {
        return true;
      }
      return false;
    };
    const testContext = {
      "@vocab": "http://example.org/"
    };
    const resource = {
      "@id": "http://example.org/resource1",
      "http://example.org/name": {
        "@list": ["Item1", "Item2", "Item3"]
      }
    };

    const compacted = await ld.compact(resource, testContext, {
      firstExpand: true,
      normalizeLists: true
    });

    assert.property(compacted, "name", "should have compacted name property");
    const name = compacted.name;
    assert.isArray(compacted.name, "should have flattened list");
    assert.deepEqual(compacted.name, ["Item1", "Item2", "Item3"], "should preserve list items");
    ld.opts.isArrayPropertyFn = null;
  });

  it("should handle @container: [@language, @set] - flatten to i18n strings", async function() {
    const testContext = {
      "@version": 1.1,
      "vocab": "http://example.com/vocab/",
      "label": {
        "@id": "vocab:label",
        "@container": ["@language", "@set"]
      }
    };

    const resource = {
      "@context": {
        "@version": 1.1,
        "vocab": "http://example.com/vocab/",
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

    const compacted = await ld.compact(resource, testContext, {
      firstExpand: true,
      showContext: true,
      ensureArrayProps: true,
      normalizeI18N: true,
      proxy: false
    });

    assert.property(compacted, "label", "should have compacted label property");
    assert.isArray(compacted.label, "should flatten language map to array of i18n strings");
    assert.include(compacted.label, "The Queen", "should include English label as plain string");
    assert.include(compacted.label, "\"Die Königin\"@de", "should include first German label with language tag");
    assert.include(compacted.label, "\"Ihre Majestät\"@de", "should include second German label with language tag");
    assert.lengthOf(compacted.label, 3, "should have three total label values");
  });

});

/**
 * A default JSON-LD @context.
 * @see https://www.w3.org/TR/json-ld11/#the-context
 * The default context avoids a chicken-and-egg problem
 * during bootstrap, by defining the properties needed
 * for proper Ld.compact.
 *
 * @type {object}
 */
const DEFAULT_CONTEXT = {
  "@vocab" : "https://ontology.2wav.com#",
  "rdf" : "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  "rdfs" : "http://www.w3.org/2000/01/rdf-schema#",
  "owl" : "http://www.w3.org/2002/07/owl#",
  "xsd" : "http://www.w3.org/2001/XMLSchema#",
  "foaf" : "http://xmlns.com/foaf/0.1/",
  "dc" : "http://purl.org/dc/elements/1.1/",
  "dcterms": "http://purl.org/dc/terms/",
  "org" : "http://www.w3.org/ns/org#",
  "uo" : "http://purl.obolibrary.org/obo/uo.owl",
  "obo" : "http://purl.obolibrary.org/obo/",
  "ctb" : "https://ontology.2wav.com/bridge#",
  "ctl" : "https://ontology.2wav.com/800-53#",
  "ctl5" : "https://ontology.2wav.com/800-53/rev5#",
  "nice" : "https://ontology.2wav.com/nice#",
  "acrt" : "https://privatealpha.com/ontology/certification/1#",
  "time" : "http://www.w3.org/2006/time#",
  "skos" : "http://www.w3.org/2004/02/skos/core#",
  "wot" : "http://xmlns.com/wot/0.1/",
  "vs" : "http://www.w3.org/2003/06/sw-vocab-status/ns#",
  "brick": "https://brickschema.org/schema/Brick#",
  "csvw": "http://www.w3.org/ns/csvw#",
  "dcam": "http://purl.org/dc/dcam/",
  "dcat": "http://www.w3.org/ns/dcat#",
  "dcmitype": "http://purl.org/dc/dcmitype/",
  "doap": "http://usefulinc.com/ns/doap#",
  "odrl": "http://www.w3.org/ns/odrl/2/",
  "prof": "http://www.w3.org/ns/dx/prof/",
  "prov": "http://www.w3.org/ns/prov#",
  "qb": "http://purl.org/linked-data/cube#",
  "schema": "https://schema.org/",
  "sh": "http://www.w3.org/ns/shacl#",
  "sosa": "http://www.w3.org/ns/sosa/",
  "ssn": "http://www.w3.org/ns/ssn/",
  "vann": "http://purl.org/vocab/vann/",
  "void": "http://rdfs.org/ns/void#",
  "_id" : "@id",
  "rdfs:range" : {
    "@type" : "@id"
  },
  "rdfs:domain" : {
    "@type" : "@id"
  },
  "rdfs:comment" : {
    "@type" : "http://www.w3.org/2001/XMLSchema#string"
  },
  "org:memberDuring" : {
    "@type" : "@id"
  },
  "org:memberOf" : {
    "@type" : "@id"
  },
  "org:organization" : {
    "@type" : "@id"
  },
  "org:role" : {
    "@type" : "@id"
  },
  "rdfs:subClassOf" : {
    "@type" : "@id"
  },
  "dc:description" : {
    "@type" : "http://www.w3.org/2001/XMLSchema#string"
  },
  "owl:sameAs" : {
    "@type" : "@id"
  },
  "owl:inverseOf" : {
    "@type": "@id"
  },
  "owl:cardinality": {
    "@type": "http://www.w3.org/2001/XMLSchema#integer"
  },
  "owl:maxCardinality": {
    "@type": "http://www.w3.org/2001/XMLSchema#integer"
  },
  "schema:eligibleRegion" : {

  },
  "rdfs:subPropertyOf" : {
    "@type" : "@id"
  },
  "vs:term_status" : {
    "@type" : "@id"
  },
  "wot:assurance" : {
    "@type" : "@id"
  },
  "wot:src_assurance" : {
    "@type" : "@id"
  }
};
