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
    assert.equal(_.get(expanded, "[0][\"https://ontologize.2wav.com/ontology#width\"][0][\"@value\"]"),10);
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

  // This is a scratch pad to help figure out the weirdnesses with the JSON-LD "@type": "@json"
  // it is inclusive
  it("wats with @type @json", async function() {
    const r1 = {
      "@id": "bold:TrackingReport",
      "@type": [
        "owl:Class"
      ],
      "rdfs:label": [
        "\"Tracking Report\"@en",
        "\"Rapport de suivi\"@fr",
        "\"Rapporto di tracciamento\"@it",
        "\"Informe de seguimiento\"@es",
        "\"Ortungsbericht\"@de"
      ],
      "rdfs:subClassOf": [
        "dwc:Event"
      ],
      "rdfs:comment": [
        "\"A single report from a tracking collar or other tracking technology.\"@en",
        "\"Un rapport individuel provenant d'un collier de suivi ou d'une autre technologie de suivi.\"@fr",
        "\"Un singolo rapporto da un collare di tracciamento o altra tecnologia di tracciamento.\"@it",
        "\"Un informe individual de un collar de rastreo u otra tecnología de seguimiento.\"@es",
        "\"Ein einzelner Bericht von einem Ortungshalsband oder einer anderen Ortungstechnologie.\"@de"
      ],
      "bui:schema": {
        "groups": [
          {
            "label": "Individuals",
            "property": "bold:animal"
          },
          {
            "label": "Species",
            "property": "bold:species"
          }
        ]
      }
    };
    const c1 = {
      "_id": "@id",
      "@vocab": "https://ontologize.2wav.com/ontology#",
      "acrt": "https://privatealpha.com/ontology/certification/1#",
      "bars": {
        "@container": "@set"
      },
      "bfo": "https://ontologize.2wav.com/ontology/bfo#",
      "bold": "https://ontologize.2wav.com/ontology/bold#",
      "brick": "https://brickschema.org/schema/Brick#",
      "bui": "https://ontologize.2wav.com/ontology/bold-ui#",
      "contact": "http://www.w3.org/2000/10/swap/pim/contact#",
      "csvw": "http://www.w3.org/ns/csvw#",
      "ctb": "https://ontologize.2wav.com/ontology/bridge#",
      "ctl": "https://ontologize.2wav.com/ontology/800-53#",
      "ctl5": "https://ontologize.2wav.com/ontology/800-53/rev5#",
      "dc": "http://purl.org/dc/elements/1.1/",
      "dcam": "http://purl.org/dc/dcam/",
      "dcat": "http://www.w3.org/ns/dcat#",
      "dcmitype": "http://purl.org/dc/dcmitype/",
      "dcterms": "http://purl.org/dc/terms/",
      "doap": "http://usefulinc.com/ns/doap#",
      "dwc": "http://rs.tdwg.org/dwc/terms/",
      "dwcbfo": "https://ontologize.2wav.com/ontology/bfodwc#",
      "foaf": "http://xmlns.com/foaf/0.1/",
      "foo": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "geo": "http://www.w3.org/2003/01/geo/wgs84_pos#",
      "nice": "https://ontologize.2wav.com/ontology/nice#",
      "obo": "http://purl.obolibrary.org/obo/",
      "odrl": "http://www.w3.org/ns/odrl/2/",
      "org": "http://www.w3.org/ns/org#",
      "owl": "http://www.w3.org/2002/07/owl#",
      "prof": "http://www.w3.org/ns/dx/prof/",
      "prov": "http://www.w3.org/ns/prov#",
      "qb": "http://purl.org/linked-data/cube#",
      "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
      "schema": "https://schema.org/",
      "sh": "http://www.w3.org/ns/shacl#",
      "skos": "http://www.w3.org/2004/02/skos/core#",
      "sosa": "http://www.w3.org/ns/sosa/",
      "ssn": "http://www.w3.org/ns/ssn/",
      "time": "http://www.w3.org/2006/time#",
      "uo": "http://purl.obolibrary.org/obo/uo.owl",
      "vann": "http://purl.org/vocab/vann/",
      "void": "http://rdfs.org/ns/void#",
      "vs": "http://www.w3.org/2003/06/sw-vocab-status/ns#",
      "wordnet": "http://xmlns.com/wordnet/1.6/",
      "wot": "http://xmlns.com/wot/0.1/",
      "xsd": "http://www.w3.org/2001/XMLSchema#",
      "bfo:bearer-of": {
        "@type": "@id"
      },
      "bfo:concretizes": {
        "@type": "@id"
      },
      "bfo:continuant-part-of": {
        "@type": "@id"
      },
      "bfo:environs": {
        "@type": "@id"
      },
      "bfo:exists-at": {
        "@type": "@id"
      },
      "bfo:first-instant-of": {
        "@type": "@id"
      },
      "bfo:generically-depends-on": {
        "@type": "@id"
      },
      "bfo:has-continuant-part": {
        "@type": "@id"
      },
      "bfo:has-first-instant": {
        "@type": "@id"
      },
      "bfo:has-history": {
        "@type": "@id"
      },
      "bfo:has-last-instant": {
        "@type": "@id"
      },
      "bfo:has-material-basis": {
        "@type": "@id"
      },
      "bfo:has-member-part": {
        "@type": "@id"
      },
      "bfo:has-occurrent-part": {
        "@type": "@id"
      },
      "bfo:has-participant": {
        "@type": "@id"
      },
      "bfo:has-realization": {
        "@type": "@id"
      },
      "bfo:has-temporal-part": {
        "@type": "@id"
      },
      "bfo:history-of": {
        "@type": "@id"
      },
      "bfo:inheres-in": {
        "@type": "@id"
      },
      "bfo:is-carrier-of": {
        "@type": "@id"
      },
      "bfo:is-concretized-by": {
        "@type": "@id"
      },
      "bfo:last-instant-of": {
        "@type": "@id"
      },
      "bfo:located-in": {
        "@type": "@id"
      },
      "bfo:location-of": {
        "@type": "@id"
      },
      "bfo:material-basis-of": {
        "@type": "@id"
      },
      "bfo:member-part-of": {
        "@type": "@id"
      },
      "bfo:occupies-spatial-region": {
        "@type": "@id"
      },
      "bfo:occupies-spatiotemporal-region": {
        "@type": "@id"
      },
      "bfo:occupies-temporal-region": {
        "@type": "@id"
      },
      "bfo:occurrent-part-of": {
        "@type": "@id"
      },
      "bfo:occurs-in": {
        "@type": "@id"
      },
      "bfo:participates-in": {
        "@type": "@id"
      },
      "bfo:preceded-by": {
        "@type": "@id"
      },
      "bfo:precedes": {
        "@type": "@id"
      },
      "bfo:realizes": {
        "@type": "@id"
      },
      "bfo:spatially-projects-onto": {
        "@type": "@id"
      },
      "bfo:specifically-depended-on-by": {
        "@type": "@id"
      },
      "bfo:specifically-depends-on": {
        "@type": "@id"
      },
      "bfo:temporal-part-of": {
        "@type": "@id"
      },
      "bfo:temporally-projects-onto": {
        "@type": "@id"
      },
      "bold:aJsonProperty": {
        "@type": "@json"
      },
      "bold:axiom": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "bold:begin": {
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "bold:boolean": {
        "@type": "http://www.w3.org/2001/XMLSchema#boolean"
      },
      "bold:collection": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "bold:container": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "bold:decimal": {
        "@type": "http://www.w3.org/2001/XMLSchema#decimal"
      },
      "bold:end": {
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "bold:explanation": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "bold:inferredFrom": {
        "@type": "@id",
        "@container": "@set"
      },
      "bold:integer": {
        "@type": "http://www.w3.org/2001/XMLSchema#integer"
      },
      "bold:isJsonProperty": {
        "@type": "http://www.w3.org/2001/XMLSchema#boolean"
      },
      "bold:provenance": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "bold:subjectOfStatement": {
        "@type": "@id",
        "@container": "@set"
      },
      "bold:when": {
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "bui:schema": {
        "@type": "@json"
      },
      "ctb:collection": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "ctb:completedDate": {
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "ctb:confidence": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "ctb:dueDate": {
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "ctb:hasBeginning": {
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "ctb:hasCertification": {
        "@type": "@id"
      },
      "ctb:hasEnd": {
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "ctb:hasKnowledge": {
        "@type": "@id"
      },
      "ctb:hasPosition": {
        "@type": "@id"
      },
      "ctb:hasSkill": {
        "@type": "@id"
      },
      "ctb:hasTask": {
        "@type": "@id"
      },
      "ctb:importance": {
        "@type": "http://www.w3.org/2001/XMLSchema#integer"
      },
      "ctb:jobTitle": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "ctb:projectStatus": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "ctb:severity": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "ctb:startDate": {
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "ctb:when": {
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "ctl:memberOf": {
        "@type": "@id"
      },
      "ctl:related": {
        "@type": "@id"
      },
      "dc:creator": {
        "@type": "@id"
      },
      "dc:description": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "dc:relation": {
        "@container": "@set"
      },
      "dc:source": {
        "@type": "@id"
      },
      "dcterms:description": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "dcterms:isPartOf": {
        "@type": "@id"
      },
      "dcterms:license": {
        "@type": "@id"
      },
      "foaf:mbox": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "foaf:phone": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "nice:abbrev": {},
      "nice:competencyType": {
        "@type": "@id"
      },
      "nice:description": {},
      "nice:inCategory": {
        "@type": "@id"
      },
      "nice:inSpecialtyArea": {
        "@type": "@id"
      },
      "nice:name": {},
      "nice:requiresAbility": {
        "@type": "@id"
      },
      "nice:requiresKnowledge": {
        "@type": "@id"
      },
      "nice:requiresSkill": {
        "@type": "@id"
      },
      "nice:requiresTask": {
        "@type": "@id"
      },
      "nice:title": {},
      "org:holds": {
        "@type": "@id"
      },
      "org:memberDuring": {
        "@type": "@id"
      },
      "org:memberOf": {
        "@type": "@id",
        "@container": "@set"
      },
      "org:organization": {
        "@type": "@id"
      },
      "org:role": {
        "@type": "@id"
      },
      "owl:allValuesFrom": {
        "@type": "@id"
      },
      "owl:cardinality": {
        "@type": "http://www.w3.org/2001/XMLSchema#integer"
      },
      "owl:disjointWith": {
        "@type": "@id"
      },
      "owl:equivalentProperty": {
        "@type": "@id"
      },
      "owl:intersectionOf": {
        "@type": "@id",
        "@container": "@set"
      },
      "owl:inverseOf": {
        "@type": "@id"
      },
      "owl:maxCardinality": {
        "@type": "http://www.w3.org/2001/XMLSchema#integer"
      },
      "owl:members": {
        "@type": "@id"
      },
      "owl:onProperty": {
        "@type": "@id"
      },
      "owl:sameAs": {
        "@type": "@id",
        "@container": "@set"
      },
      "owl:unionOf": {
        "@type": "@id",
        "@container": "@set"
      },
      "owl:versionInfo": {
        "@container": "@set"
      },
      "owl:versionIRI": {
        "@type": "@id"
      },
      "rdf:object": {
        "@type": "@id"
      },
      "rdf:predicate": {
        "@type": "@id"
      },
      "rdf:subject": {
        "@type": "@id"
      },
      "rdf:type": {
        "@type": "@id"
      },
      "rdfs:comment": {
        "@type": "http://www.w3.org/2001/XMLSchema#string"
      },
      "rdfs:domain": {
        "@type": "@id"
      },
      "rdfs:range": {
        "@type": "@id"
      },
      "rdfs:subClassOf": {
        "@type": "@id",
        "@container": "@set"
      },
      "rdfs:subPropertyOf": {
        "@type": "@id",
        "@container": "@set"
      },
      "schema:eligibleRegion": {},
      "time:hasBeginning": {
        "@type": "@id"
      },
      "time:hasEnd": {
        "@type": "@id"
      },
      "time:inXSDDateTime": {
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "vs:term_status": {
        "@type": "@id"
      },
      "wot:assurance": {
        "@type": "@id"
      },
      "wot:src_assurance": {
        "@type": "@id"
      },
      "bold:species": {
        "@type": "@id"
      }
    };
    const testContext = {
      "@vocab": "http://example.com/vocab/",
      "http://example.com/vocab/json": {
        "@type": "@json"
      }
    };
    const testResource = {
      "@id": "queen",
      "http://example.com/vocab/json": {
        a: 1,
        b: 2,
      }
    };
    const expanded = await ld.expand(testResource, testContext);
    console.log(expanded);
    const compacted = await ld.compact(testResource, testContext, {
      firstExpand: true,
      showContext: true,
      ensureArrayProps: true,
      proxy: false
    });
    console.log(compacted);
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
  "@vocab" : "https://ontologize.2wav.com/ontology#",
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
  "ctb" : "https://ontologize.2wav.com/ontology/bridge#",
  "ctl" : "https://ontologize.2wav.com/ontology/800-53#",
  "ctl5" : "https://ontologize.2wav.com/ontology/800-53/rev5#",
  "nice" : "https://ontologize.2wav.com/ontology/nice#",
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
