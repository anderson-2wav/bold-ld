/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2026 2wav, Inc.
 *
 * Tests for LD.mongoToJsonld and LD.jsonldToMongo static methods
 */

import { assert } from "chai";
import LD from "../src/LD.js";

describe("LD MongoDB Conversion", function() {
  describe("mongoToJsonld", function() {
    it("should convert top-level _id to @id", function() {
      const input = { _id: "foaf:Person", "rdfs:label": "Person" };
      const result = LD.mongoToJsonld(input);

      assert.equal(result["@id"], "foaf:Person");
      assert.isUndefined(result._id);
      assert.equal(result["rdfs:label"], "Person");
    });

    it("should convert nested _id to @id", function() {
      const input = {
        _id: "foaf:Document",
        "rdfs:isDefinedBy": { _id: "http://xmlns.com/foaf/0.1/" }
      };
      const result = LD.mongoToJsonld(input);

      assert.equal(result["@id"], "foaf:Document");
      assert.equal(result["rdfs:isDefinedBy"]["@id"], "http://xmlns.com/foaf/0.1/");
      assert.isUndefined(result["rdfs:isDefinedBy"]._id);
    });

    it("should handle deeply nested objects", function() {
      const input = {
        _id: "test:resource",
        "owl:equivalentClass": {
          "@type": "owl:Restriction",
          "owl:onProperty": { _id: "test:prop" },
          "owl:someValuesFrom": { _id: "test:class" }
        }
      };
      const result = LD.mongoToJsonld(input);

      assert.equal(result["@id"], "test:resource");
      assert.equal(result["owl:equivalentClass"]["owl:onProperty"]["@id"], "test:prop");
      assert.equal(result["owl:equivalentClass"]["owl:someValuesFrom"]["@id"], "test:class");
    });

    it("should handle arrays", function() {
      const input = {
        _id: "test:resource",
        "rdfs:subClassOf": [
          { _id: "test:parent1" },
          { _id: "test:parent2" }
        ]
      };
      const result = LD.mongoToJsonld(input);

      assert.equal(result["@id"], "test:resource");
      assert.isArray(result["rdfs:subClassOf"]);
      assert.equal(result["rdfs:subClassOf"][0]["@id"], "test:parent1");
      assert.equal(result["rdfs:subClassOf"][1]["@id"], "test:parent2");
    });

    it("should handle array of resources", function() {
      const input = [
        { _id: "test:a", "rdfs:label": "A" },
        { _id: "test:b", "rdfs:label": "B" }
      ];
      const result = LD.mongoToJsonld(input);

      assert.isArray(result);
      assert.equal(result[0]["@id"], "test:a");
      assert.equal(result[1]["@id"], "test:b");
    });

    it("should preserve non-_id properties", function() {
      const input = {
        _id: "test:resource",
        "@type": ["owl:Class"],
        "rdfs:label": "Test",
        "rdfs:comment": "A test resource"
      };
      const result = LD.mongoToJsonld(input);

      assert.deepEqual(result["@type"], ["owl:Class"]);
      assert.equal(result["rdfs:label"], "Test");
      assert.equal(result["rdfs:comment"], "A test resource");
    });

    it("should handle null and primitive values", function() {
      const input = {
        _id: "test:resource",
        "test:null": null,
        "test:string": "hello",
        "test:number": 42,
        "test:boolean": true
      };
      const result = LD.mongoToJsonld(input);

      assert.isNull(result["test:null"]);
      assert.equal(result["test:string"], "hello");
      assert.equal(result["test:number"], 42);
      assert.equal(result["test:boolean"], true);
    });

    it("should skip deep conversion when deep=false", function() {
      const input = {
        _id: "test:resource",
        "rdfs:isDefinedBy": { _id: "http://example.org/" }
      };
      const result = LD.mongoToJsonld(input, { deep: false });

      assert.equal(result["@id"], "test:resource");
      // Nested _id should NOT be converted
      assert.equal(result["rdfs:isDefinedBy"]._id, "http://example.org/");
      assert.isUndefined(result["rdfs:isDefinedBy"]["@id"]);
    });
  });

  describe("jsonldToMongo", function() {
    it("should convert top-level @id to _id", function() {
      const input = { "@id": "foaf:Person", "rdfs:label": "Person" };
      const result = LD.jsonldToMongo(input);

      assert.equal(result._id, "foaf:Person");
      assert.isUndefined(result["@id"]);
    });

    it("should convert nested @id to _id", function() {
      const input = {
        "@id": "foaf:Document",
        "rdfs:isDefinedBy": { "@id": "http://xmlns.com/foaf/0.1/" }
      };
      const result = LD.jsonldToMongo(input);

      assert.equal(result._id, "foaf:Document");
      assert.equal(result["rdfs:isDefinedBy"]._id, "http://xmlns.com/foaf/0.1/");
    });

    it("should be inverse of mongoToJsonld", function() {
      const original = {
        _id: "test:resource",
        "rdfs:isDefinedBy": { _id: "http://example.org/" },
        "rdfs:subClassOf": [{ _id: "test:parent" }]
      };

      const jsonld = LD.mongoToJsonld(original);
      const backToMongo = LD.jsonldToMongo(jsonld);

      assert.deepEqual(backToMongo, original);
    });
  });
});
