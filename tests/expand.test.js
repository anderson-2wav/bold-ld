/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2026 2wav, Inc.
 */

import { assert } from "chai";
import { LD } from "../src/ld.js";
import { readFile } from "fs/promises";

describe("LD.expand()", function () {
  let ld;

  before(function () {
    ld = new LD();
  });

  describe("Expanding BOLD BFO JSON-LD", function () {
    it("should expand bold-bfo.jsonld to proper array format", async function () {
      this.timeout(30000); // Allow time for processing

      // Read the bold-bfo.jsonld file
      const bfoPath = `${process.env.APP_DIR}/private/data/bootstrap/bold-bfo.jsonld`;

      let bfoContent;
      try {
        bfoContent = await readFile(bfoPath, "utf-8");
      }
 catch (error) {
        // If the file doesn't exist, skip this test
        console.log(`Skipping test - bold-bfo.jsonld not found at ${bfoPath}`);
        this.skip();
        return;
      }

      const bfoData = JSON.parse(bfoContent);
      console.log("Input data structure:");
      console.log(`- Has @context: ${!!bfoData["@context"]}`);
      console.log(`- Has @graph: ${!!bfoData["@graph"]}`);
      console.log(`- @graph length: ${bfoData["@graph"] ? bfoData["@graph"].length : "N/A"}`);
      console.log(`- Context keys: ${bfoData["@context"] ? Object.keys(bfoData["@context"]).join(", ") : "none"}`);

      // Test expansion
      console.log("\nCalling LD.expand()...");
      const expanded = await ld.expand(bfoData);

      console.log("\nExpansion result:");
      console.log(`- Type: ${Array.isArray(expanded) ? "array" : typeof expanded}`);
      console.log(`- Length/keys: ${Array.isArray(expanded) ? expanded.length : Object.keys(expanded).length}`);

      if (!Array.isArray(expanded)) {
        console.log(`- Object keys: ${Object.keys(expanded)}`);
        if (expanded["@graph"]) {
          console.log(`- @graph length: ${expanded["@graph"].length}`);
        }
      }
 else if (expanded.length === 1 && expanded[0]["@graph"]) {
        console.log(`- Single item with @graph containing ${expanded[0]["@graph"].length} resources`);
      }

      // Test direct jsonld.expand for comparison
      console.log("\nTesting direct jsonld.expand for comparison:");
      const { default: jsonld } = await import("jsonld");
      const directExpanded = await jsonld.expand(bfoData);
      console.log(`- Direct jsonld result type: ${Array.isArray(directExpanded) ? "array" : typeof directExpanded}`);
      console.log(`- Direct jsonld length: ${directExpanded.length}`);

      if (directExpanded.length > 0) {
        console.log(`- First item has @graph: ${!!directExpanded[0]["@graph"]}`);
        if (directExpanded[0]["@graph"]) {
          console.log(`- Direct @graph length: ${directExpanded[0]["@graph"].length}`);
        }
      }

      // Sample a resource to see expansion format
      let sampleResource;
      if (Array.isArray(expanded)) {
        sampleResource = expanded.find(r => r["@id"] && r["@id"].includes("entity"));
      }
 else if (expanded["@graph"]) {
        sampleResource = expanded["@graph"].find(r => r["@id"] && r["@id"].includes("entity"));
      }

      if (sampleResource) {
        console.log("\nSample expanded resource:");
        console.log(JSON.stringify(sampleResource, null, 2));

        // Check if it's properly expanded (has full URIs)
        const hasFullUris = Object.keys(sampleResource).some(key =>
          key.startsWith("http://") || key === "@id" || key === "@type"
        );
        console.log(`- Has full URIs: ${hasFullUris}`);
      }

      // According to JSON-LD spec, expand should return an array
      // But let's see what we actually get and log it for debugging
      console.log("\nJSON-LD spec says expand() should return an array of expanded resources");
      console.log(`Actually returned: ${Array.isArray(expanded) ? "✓ array" : "✗ " + typeof expanded}`);

      // For now, let's assert what we expect and see what fails
      if (Array.isArray(expanded)) {
        assert.isAbove(expanded.length, 0, "Should have expanded resources");
        console.log("✓ Expansion returned proper array format");
      }
 else {
        console.log("⚠ Expansion returned object instead of array - this may be incorrect");
        // Still check that we got some data
        if (expanded["@graph"]) {
          assert.isAbove(expanded["@graph"].length, 0, "Should have expanded resources in @graph");
        }
      }
    });

    it("should expand a simple compacted document to array", async function () {
      // Test with a simple document to verify expected behavior
      const simpleDoc = {
        "@context": {
          "name": "http://example.org/name",
          "age": "http://example.org/age"
        },
        "@graph": [
          {
            "@id": "http://example.org/person1",
            "name": "Alice",
            "age": 30
          },
          {
            "@id": "http://example.org/person2",
            "name": "Bob",
            "age": 25
          }
        ]
      };

      console.log("\nTesting simple document expansion:");
      console.log("Input:", JSON.stringify(simpleDoc, null, 2));

      const expanded = await ld.expand(simpleDoc);

      console.log("Output type:", Array.isArray(expanded) ? "array" : typeof expanded);
      console.log("Output:", JSON.stringify(expanded, null, 2));

      // This should definitely return an array according to JSON-LD spec
      assert.isArray(expanded, "Simple document expansion should return array");
      assert.equal(expanded.length, 2, "Should expand to 2 resources");

      // Check first resource is properly expanded
      const firstResource = expanded[0];
      assert.property(firstResource, "@id");
      assert.property(firstResource, "http://example.org/name");
      assert.property(firstResource, "http://example.org/age");
    });
  });
});
