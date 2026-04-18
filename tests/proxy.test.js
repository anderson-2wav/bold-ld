/**
 * Copyright (c) 2026 2wav, Inc.
 *
 * This file is part of the BOLD libraries, licensed under the GNU Lesser
 * General Public License v3.0 or later. See LICENSE for details, or
 * <https://www.gnu.org/licenses/lgpl-3.0.html>.
 */

import { assert } from "chai";
import _ from "lodash";
import LD from "../src/ld.js";
import jsonPath from "../src/lib/jsonpath.js";
import { check } from "../src/lib/check.js";

// // Simple check function for tests
// function check(value, pattern, message) {
//   if (pattern === Object) {
//     if (typeof value !== "object" || value === null || Array.isArray(value)) {
//       throw new Error(message || `Expected object, got ${typeof value}`);
//     }
//   }
// }

describe("LD~Proxy", function () {
  let ld;
  this.timeout(0);

  before(function() {
    ld = new LD({
      isArrayPropertyFn: function(property) {
        if (property === "bars") {
          return true;
        }
        return false;
      }
    });
  });

  it("Ld~Proxy get", function() {
    const obj = {};
    // bars is an array property by ontology.
    obj.bars = [{"@value":1},{"@value":2},{"@value":3}];
    obj.bar = [{"@id":"2wav:thing"}];
    obj.baz = 42;
    obj.plains = ["Hello","World"];

    const p = ld.proxy(obj);
    assert.ok(ld.isProxy(p));
    assert.ok(!ld.isProxy(p.__raw));
    console.log("wat is p.__raw",p.__raw);

    const pbar = p.bar;
    assert.equal(pbar, "2wav:thing", "p.bar should give one flattened string result.");
    const pbars = p.bars;
    // WARNING! THE DEBUGGER WILL BREAK THIS TEST! ...ominous
    assert.deepEqual(pbars,[1,2,3], "p.bars should return flattened array.");
    assert.equal(p.baz, 42, "p.baz should return plain value.");
    assert.equal(p.plains, "Hello");
    assert.equal(p["plains[]"][1], "World");
  });

  it("Ld~Proxy __raw", function() {
    const obj = {};
    obj.foo = "not-bar";
    obj.bars = [{"@value":1},{"@value":2},{"@value":3}];
    obj.bar = [{"@id":"2wav:thing"}];
    const p = ld.proxy(obj);
    assert.deepEqual(p.__raw.foo,"not-bar", "p.__raw should be original value. a");
    assert.deepEqual(p.__raw.bar, [{ "@id": "2wav:thing" }], "p.__raw should be original value. b");
    assert.deepEqual(p.__raw.bars,[{ "@value": 1 }, { "@value": 2 }, { "@value": 3 }], "p.__raw should be original value. c");
  });

  it("Ld~Proxy []", function() {
    const obj = {};
    obj.baz = "Thing";
    obj.bars = [{"@value":1},{"@value":2},{"@value":3}];
    obj.bar = [{"@id":"2wav:thing"},{"@id":"2wav:otherThing"}];


    const p = ld.proxy(obj);
    assert.equal(p.bar, "2wav:thing", "p.bar should give one flattened string result.");
    let pbars = p.bars;
    // // how unfortunate. No way to flatten without breaking the property
    // assert.deepEqual(pbars,[{"@value":1},{"@value":2},{"@value":3}], "p.bars should return un-flattened array.");
    // how unfortunate. No way to flatten without breaking the property
    assert.deepEqual(pbars,[1,2,3], "p.bars appears as a flattened array.");

    assert.deepEqual(p.bars[1],2, "p.bars[1] should return nth flattened element.");
    assert.deepEqual(p["bar[]"], ["2wav:thing","2wav:otherThing"], "p.bar[] should give flattened array result.");
    // new test... does this work?
    assert.deepEqual(p["baz[]"],["Thing"], "p['baz[]' should return an array even though it's not");

    // next critical test, can we mutate array?
    p.bars.push(4);
    pbars = p.bars;
    assert.deepEqual(pbars,[1,2,3,4], "p.bars appears as a flattened array.");
    assert.deepEqual(p.bars,[1,2,3,4], "p.bars appears as a flattened array.");
    assert.equal(p.bars.length,4);
    assert.equal(p.bars.__raw.length,4);
    console.log(p.bars.__raw);
    assert.deepEqual(p.bars.__raw, [{ "@value": 1 }, { "@value": 2 }, { "@value": 3 }, 4]);
    for (const n of p.bars) {
      assert.isNumber(n);
    }
    // uh oh... more stuff I haven't thought of...
    delete p.bars;
    console.log(p.bars);
    assert.isUndefined(p.bars);
  });

  it("Ld~Proxy set", function() {
    const obj = {};
    obj.plain = "Hello";
    obj.plains = ["Hello","World"];
    obj.onesy = [{"@value":"one"}];
    obj.baz = [{"@value":1},{"@value":2},{"@value":3}];
    obj.bar = [{"@id":"2wav:thing"},{"@id":"2wav:otherThing"}];

    const p = ld.proxy(obj);

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
    p.onesy = "two";
    assert.deepEqual(p.__raw.onesy,[{"@value":"two"}]);

    console.log(p.baz.__raw);
    // set a plain value on an unknown array property
    p.baz = 4;
    console.log(p.__raw.baz);
    console.log(p.baz);

    assert.deepEqual(p.__raw.baz,[{"@value":4},{"@value":1},{"@value":2},{"@value":3}]);
    // set a plain value on a array of unknown cardinality
    p.bar = "2wav:nottaThing";
    assert.deepEqual(p.__raw.bar,[{"@id":"2wav:nottaThing"},{"@id":"2wav:thing"},{"@id":"2wav:otherThing"}]);
  });

  /*
   _.cloneDeep returns a vanilla copy of a proxy.
   Ld.clone returns a proxy copy of a proxy.
   */
  it("Ld~proxy _.cloneDeep", function() {
    const obj = {};
    obj.foo = "not-bar";
    obj.bars = [{"@value":1},{"@value":2},{"@value":3}];
    obj.bar = [{"@id":"2wav:thing"}];
    obj.baz = 42;
    obj.plains = ["Hello","World"];
    const p = ld.proxy(obj);
    assert.doesNotThrow(() => {
      check(p,Object);
    },"check calls proxy a plain Object");
    const c = _.cloneDeep(p);
    assert.doesNotThrow(() => {
      check(c,Object);
    },"check calls clone a plain Object");
    assert.deepEqual(c,p,"clone and proxy are equal");
  });

  it("Ld.clone", function() {
    const obj = {};
    obj.foo = "not-bar";
    obj.bars = [{"@value":1},{"@value":2},{"@value":3}];
    obj.bar = [{"@id":"2wav:thing"}];
    obj.baz = 42;
    obj.plains = ["Hello","World"];

    const p = ld.proxy(obj);
    const string = JSON.stringify(p,null,2);
    assert.ok(string.match(/^\{.*\}$/sm),"proxy objects should stringify");
    assert.ok(p.__isProxy, "p is a Proxy");
    const p2 = ld.clone(p);
    assert.ok(p2.__isProxy, "clone is also a Proxy");
    assert.deepEqual(p2, p, "p and p2 should be clones");

    let paths = jsonPath(p,"$..__isProxy",{resultType:"PATH"});
    console.log("$..__isProxy",paths);
    // weird thing... If you stop in the debugger, the inspector console
    // will cause all the arrays to get proxied. So this might be 12 instead of 2.
    assert.isAtLeast(paths.length,2);
    // optional behavior to unproxy all embedded
    ld.opts.rawEmbedded = true;
    paths = jsonPath(p.__raw,"$..__isProxy",{resultType:"PATH"});
    assert.isFalse(paths);
    ld.opts.rawEmbedded = false;
  });

  it("proxy array", async function () {
    const simpleObj1 = {
      "@context": {
        "foaf" : "http://xmlns.com/foaf/0.1/"
      },
      "foaf:name": "Minnie Mouse"
    };
    const simpleObj2 = {
      "@context": {
        "foaf" : "http://xmlns.com/foaf/0.1/"
      },
      "foaf:name": ["Minnie Mouse", "Donald Duck"]
    };
    const pa = ld.proxy([simpleObj1, simpleObj2]);
    assert.ok(ld.isProxy(pa), "pa is a Proxy");
    assert.ok(Array.isArray(pa), "pa is an Array");
    // clone it
    const pa2 = ld.clone(pa);
    assert.ok(ld.isProxy(pa2), "pa2 is a Proxy");
    assert.ok(Array.isArray(pa2), "pa2 is an Array");

    const proxy1 = ld.proxy(simpleObj1);
    const proxy2 = ld.proxy(simpleObj2);
    assert.equal(proxy1["foaf:name"],"Minnie Mouse");
    assert.equal(proxy2["foaf:name"],"Minnie Mouse");
    assert.deepEqual(proxy2["foaf:name[]"],["Minnie Mouse", "Donald Duck"]);
    assert.deepEqual(proxy2.__raw["foaf:name"],["Minnie Mouse", "Donald Duck"]);

    // A NEW PROBLEM push()
    proxy2["foaf:name[]"].push("Pluto");
    assert.ok(proxy2["foaf:name[]"].includes("Pluto"));
    // A newer problem unshift()
    try {
      proxy2["foaf:name[]"].unshift("Goofy");
      assert.ok(proxy2["foaf:name[]"].includes("Goofy"));
    }
    catch (e) {
      console.error(e);
    }
  });


  it("Ld.proxy i18n ", async function() {
    ld.opts.i18n = true;
    ld.opts.lang = "en";
    // const orgProxy = await ld.compact(_.cloneDeep(ORG_I18N));
    const orgProxy = ld.proxy(ORG_I18N);
    // i18n strings
    assert.equal(orgProxy["rdfs:label"],"Organization");
    assert.equal(orgProxy["owl:hasKey"], "org:identifier");
    ld.opts.i18n = true;
    ld.opts.lang = "it";
    const commentIt = orgProxy["rdfs:comment"];
    console.log(commentIt);
    assert.include(commentIt,"Rappresenta una collezione");
    ld.opts.i18n = false;
    ld.opts.lang = "en";
  });

  describe("Ld.proxy i18n setter behavior", function() {
    let ldIt;

    beforeEach(function() {
      ldIt = new LD({
        i18n: true,
        lang: "it"
      });
    });

    it("should set i18n value with RDF literal format", function() {
      const resource = {
        "@id": "http://www.w3.org/ns/org#Organization",
        "rdfs:label": [
          '"Organisation"@fr',
          '"Organization"@en',
          '"Organizzazione"@it',
          '"organización"@es'
        ]
      };

      const proxy = ldIt.proxy(resource);

      // Setting a new value in current language should replace existing
      proxy["rdfs:label"] = "Un'altra organizzazione";

      // Check that the raw value has the new RDF literal format
      const rawLabels = proxy.__raw["rdfs:label"];
      assert.include(rawLabels, '"Un\'altra organizzazione"@it');
      assert.notInclude(rawLabels, '"Organizzazione"@it');

      // Check that getter returns the plain string for current language
      assert.equal(proxy["rdfs:label"], "Un'altra organizzazione");

      // Check that array access prioritizes current language
      const labelArray = proxy["rdfs:label[]"];
      assert.equal(labelArray[0], "Un'altra organizzazione");
      assert.include(labelArray, '"Organisation"@fr');
      assert.include(labelArray, '"Organization"@en');
      assert.include(labelArray, '"organización"@es');
    });

    it("should set i18n value with JSON-LD format", function() {
      const resource = {
        "@id": "http://www.w3.org/ns/org#Organization",
        "rdfs:label": [{
          "@language": "fr",
          "@value": "Organisation"
        }, {
          "@language": "en",
          "@value": "Organization"
        }, {
          "@language": "it",
          "@value": "Organizzazione"
        }, {
          "@language": "es",
          "@value": "organización"
        }]
      };

      const proxy = ldIt.proxy(resource);

      // Setting a new value in current language should replace existing
      proxy["rdfs:label"] = "Un'altra organizzazione";

      // Check that the raw value has the new JSON-LD format
      const rawLabels = proxy.__raw["rdfs:label"];
      const newItValue = rawLabels.find(item =>
        typeof item === "object" &&
        item["@language"] === "it" &&
        item["@value"] === "Un'altra organizzazione"
      );
      assert.isDefined(newItValue);

      // Original Italian value should be gone
      const oldItValue = rawLabels.find(item =>
        typeof item === "object" &&
        item["@language"] === "it" &&
        item["@value"] === "Organizzazione"
      );
      assert.isUndefined(oldItValue);

      // Check that getter returns the plain string for current language
      assert.equal(proxy["rdfs:label"], "Un'altra organizzazione");

      // Check that array access converts to RDF literals except current language
      const labelArray = proxy["rdfs:label[]"];
      assert.equal(labelArray[0], "Un'altra organizzazione");
      assert.include(labelArray, '"Organisation"@fr');
      assert.include(labelArray, '"Organization"@en');
      assert.include(labelArray, '"organización"@es');
    });

    it("should handle multiple sets on same property", function() {
      const resource = {
        "@id": "http://www.w3.org/ns/org#Organization",
        "rdfs:label": [
          '"Organisation"@fr',
          '"Organization"@en',
          '"Organizzazione"@it',
          '"organización"@es'
        ]
      };

      const proxy = ldIt.proxy(resource);

      // First set
      proxy["rdfs:label"] = "Prima organizzazione";
      assert.equal(proxy["rdfs:label"], "Prima organizzazione");

      // Second set should replace the first
      proxy["rdfs:label"] = "Seconda organizzazione";
      assert.equal(proxy["rdfs:label"], "Seconda organizzazione");

      // Should only have one Italian value in raw
      const rawLabels = proxy.__raw["rdfs:label"];
      const itValues = rawLabels.filter(item =>
        typeof item === "string" && item.includes("@it")
      );
      assert.equal(itValues.length, 1);
      assert.equal(itValues[0], '"Seconda organizzazione"@it');
    });

    it("should add new language when setting non-current language", function() {
      const resource = {
        "@id": "http://www.w3.org/ns/org#Organization",
        "rdfs:label": [
          '"Organisation"@fr',
          '"Organization"@en'
        ]
      };

      const proxy = ldIt.proxy(resource);

      // Setting value should add Italian language
      proxy["rdfs:label"] = "Organizzazione italiana";

      const rawLabels = proxy.__raw["rdfs:label"];
      assert.include(rawLabels, '"Organizzazione italiana"@it');
      assert.include(rawLabels, '"Organisation"@fr');
      assert.include(rawLabels, '"Organization"@en');

      assert.equal(proxy["rdfs:label"], "Organizzazione italiana");
    });

    it("should not interfere with non-i18n arrays", function() {
      const resource = {
        "@id": "http://www.w3.org/ns/org#Organization",
        "rdfs:seeAlso": ["value1", "value2"]
      };

      const proxy = ldIt.proxy(resource);

      // Setting on non-i18n array should work normally
      proxy["rdfs:seeAlso"] = "value3";

      const rawSeeAlso = proxy.__raw["rdfs:seeAlso"];
      assert.deepEqual(rawSeeAlso, ["value3", "value1", "value2"]);
      assert.equal(proxy["rdfs:seeAlso"], "value3");
    });

    it("should handle mixed format arrays gracefully", function() {
      const resource = {
        "@id": "http://www.w3.org/ns/org#Organization",
        "rdfs:label": [
          '"Organisation"@fr',
          {
            "@language": "en",
            "@value": "Organization"
          },
          '"Organizzazione"@it'
        ]
      };

      const proxy = ldIt.proxy(resource);

      // Should detect mixed format and use RDF literal format for consistency
      proxy["rdfs:label"] = "Nuova organizzazione";

      const rawLabels = proxy.__raw["rdfs:label"];
      assert.include(rawLabels, '"Nuova organizzazione"@it');
      assert.notInclude(rawLabels, '"Organizzazione"@it');
    });

    it("should preserve order with current language first", function() {
      const resource = {
        "@id": "http://www.w3.org/ns/org#Organization",
        "rdfs:label": [
          '"Organisation"@fr',
          '"Organization"@en',
          '"organización"@es'
        ]
      };

      const proxy = ldIt.proxy(resource);

      proxy["rdfs:label"] = "Organizzazione italiana";

      // Check array access order
      const labelArray = proxy["rdfs:label[]"];
      assert.equal(labelArray[0], "Organizzazione italiana");
      // Other languages should follow
      assert.include(labelArray.slice(1), '"Organisation"@fr');
      assert.include(labelArray.slice(1), '"Organization"@en');
      assert.include(labelArray.slice(1), '"organización"@es');
    });
  });

  /**
   * Why:
   * A scratchpad for a subtle problem with ld.opts.proxyFlatten.
   * Notes to future self:
   * get()ing a property which is an array value e.g. thingToFlatten.bars,
   * value is replaced with a proxy to the flattened version of the value,
   * and _that_ proxy has realTarget of the original value.
   * complicated and messy.
   * this means that the original __raw object has been mutated by the get.
   * This unexpected side effect seems like an antipattern.
   */
  describe.skip("opts.proxyFlatten", function() {
    const thingToFlatten = {
      "@id": "a-thing-with-unflat-properties",
      "@type": [
        "TypeOne",
        "TypeTwo",
      ],
      "bars": [
        {
          "@value": 1,
        },
        {
          "@value": 2,
        }
      ]
    };

    let ld;

    before(function() {
      ld = new LD({
        isArrayPropertyFn: function(property) {
          if (property === "@type") {
            return true;
          }
          if (property === "bars") {
            return true;
          }
          return false;
        }
      });
    });

    it("proxy with flatten", function() {
      const proxy = ld.proxy(thingToFlatten);
      console.log(proxy);
      console.log(proxy.bars);
      console.log(Object.values(proxy));
      console.log(proxy.__raw["bars"]);
      console.log(ld.unproxy(proxy));
      console.log(proxy);
      proxy.bars.push(3);
      console.log(proxy.bars);
      console.log(ld.unproxy(proxy));
      console.log(proxy.bars.__raw);

    });

  });
  });



// this resource has been modified from the original
// to allow i18n test without compact
const ORG_I18N = {
  "@id": "http://www.w3.org/ns/org#Organization",
  "@type": ["http://www.w3.org/2002/07/owl#Class"],
  "rdfs:comment": [{
    "@language": "es",
    "@value": "Grupo de personas que se organiza en una comunidad u otro tipo de estructura social, comercial o política. Dicho grupo tiene un objetivo o motivo común para su existencia que va más allá del conjunto de personas que lo forman y que puede actuar como “agente”. A menudo las organizaciones se pueden agrupar en estructuras jerárquicas. Se recomienda el uso de etiquetas de SKOS para denominar a cada “organización”. En concreto, `skos:prefLabel` para la denominación principal o recomendada (aquella reconocida legalmente, siempre que sea posible), `skos:altLabel` para denominaciones alternativas (nombre comercial, sigla, denominación por la que se conoce a la organización coloquialmente) y `skos:notation` para referirse al código que identifique a la organización en una lista de códigos. Denominaciones alternativas: _colectivo_ _corporación_ _grupo_"
  }, {
    "@language": "it",
    "@value": "Rappresenta una collezione di persone organizzate all'interno di una communità o di una qualche struttura sociale, commerciale o politica. Il gruppo condivide un obiettivo o una ragione d'essere che va oltre gli stessi membri appartenenti al gruppo e  può agire come un Agent. Le organizzazioni si possono spesso suddividere in strutture gerarchiche. Si raccomanda di usare le label per l'Organization mediante le proprietà di SKOS. In particolare, `skos:prefLabel` per il nome principale (possibilmente un nome legalmente riconosciuto)”, `skos:altLabel` come nome alternativo (denominazione commerciale, denominazione colloquiale) e `skos:notation` per indicare un codice di una lista di codici."
  }, {
    "@language": "en",
    "@value": "Represents a collection of people organized together into a community or other social, commercial or political structure. The group has some common purpose or reason for existence which goes beyond the set of people belonging to it and can act as an Agent. Organizations are often decomposable into hierarchical structures.  It is recommended that SKOS lexical labels should be used to label the Organization. In particular `skos:prefLabel` for the primary (possibly legally recognized name), `skos:altLabel` for alternative names (trading names, colloquial names) and `skos:notation` to denote a code from a code list. Alternative names: _Collective_ _Body_ _Org_ _Group_"
  }, {
    "@language": "fr",
    "@value": "Représente un groupe de personnes organisées en communauté où tout autre forme de structure sociale, commerciale ou politique. Le groupe a un but commun ou une raison d'être qui va au-delà de la somme des personnes qui en font partie et peut agir en tant que \"Agent\". Les organisations sont souvent décomposables en structures hiérarchisées. Il est recommandé que des labels lexicaux SKOS soient utilisés pour nommer l'Organisation. En particulier `skos:prefLabel` pour le nom principal (en général le nom légal), `skos:altLabel` pour les noms alternatifs (marques, sigles, appellations familières) et `skos:notation` pour indiquer un code provenant d'une liste de code."
  }, {
    "@language": "ja",
    "@value": "コミュニティー、その他の社会、商業、政治的な構造に共に編入された人々の集合を表わします。グループには、そこに属する人々を超えた、存在に対するある共通の目的や理由があり、エージェント（代理）を務めることができます。組織は、多くの場合、階層構造に分割できます。"
  }],
  "http://www.w3.org/2000/01/rdf-schema#isDefinedBy": [{
    "@id": "http://www.w3.org/ns/org"
  }],
  "rdfs:label": [{
    "@language": "fr",
    "@value": "Organisation"
  }, {
    "@language": "en",
    "@value": "Organization"
  }, {
    "@language": "it",
    "@value": "Organizzazione"
  }, {
    "@language": "es",
    "@value": "organización"
  }],
  "http://www.w3.org/2000/01/rdf-schema#subClassOf": [{
    "@id": "http://xmlns.com/foaf/0.1/Agent"
  }],
  "http://www.w3.org/2002/07/owl#disjointWith": [{
    "@set": [{
      "@id": "http://www.w3.org/ns/org#Role"
    }, {
      "@id": "http://www.w3.org/ns/org#Site"
    }]
  }],
  "http://www.w3.org/2002/07/owl#equivalentClass": [{
    "@id": "http://xmlns.com/foaf/0.1/Organization"
  }],
  "owl:hasKey": [{
    "@id": "org:identifier"
  }],
  "https://ontologize.2wav.com/ontology#stringProperty": {
    "@language": "es",
    "@value": "organización"
  }
};
