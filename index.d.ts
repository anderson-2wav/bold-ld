/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2026 2wav, Inc.
 */

export interface LDOptions {
  /** Default JSON-LD context to use for operations */
  context?: Record<string, any>;
  /** Whether to return proxy objects by default from operations */
  proxy?: boolean;
  /** Whether proxy objects should flatten @value and @id objects */
  proxyFlatten?: boolean;
  /** Whether to enable internationalization support for language-tagged values */
  i18n?: boolean;
  /** Default language code for i18n operations */
  lang?: string;
  /** Enable debug logging for operations */
  debug?: boolean;
  /** URI property to use for type information */
  typeUri?: string;
  /** Function to sort @type arrays */
  sortTypesFn?: (types: string[], context: Record<string, any>) => void;
  /** Function to clean up resources after processing */
  cleanupResourceFn?: (resource: Record<string, any>) => void;
  /** Function to determine if a property should be treated as an array */
  isArrayPropertyFn?: (property: string, context?: Record<string, any>) => boolean;
}

export interface CompactOptions {
  /** Do expand the res before compacting (slower but more consistent result) */
  firstExpand?: boolean;
  /** Flatten the res before compacting, rarely needed */
  flatten?: boolean;
  /** Include @context in result */
  showContext?: boolean;
  /** Enforces @container behavior */
  ensureArrayProps?: boolean;
  /** Prevent un-compacted keys or bad characters like "." */
  ensureSafeKeys?: boolean;
  /** Sort @type properties */
  sortTypesFn?: (types: string[], context: Record<string, any>) => void;
  /** Normalize i18n strings */
  normalizeI18N?: boolean;
  /** Normalize @list and @set objects */
  normalizeLists?: boolean;
  /** Return proxy object instead of plain object */
  proxy?: boolean;
}

export interface ExpandOptions {
  /** Flatten the res before expanding, rarely needed */
  flatten?: boolean;
}

export type Resource = Record<string, any>;
export type Context = Record<string, any>;

export interface LDProxy extends Record<string, any> {
  /** Access to the original unaltered JSON-LD object */
  __raw: Resource;
  /** Indicates this is a proxy object */
  __isProxy: true;
}

/**
 * LD - Utility to simplify use of JSON-LD within JS/TS applications
 */
export declare class LD {
  /** Module version */
  version: string;
  /** Configuration options */
  opts: LDOptions;

  /**
   * Create a new LD instance with optional configuration
   */
  constructor(opts?: LDOptions);

  /**
   * Construct a smart proxy for the JSON-LD object
   */
  proxy(doc: Resource, realTarget?: Resource, context?: Context): LDProxy | Resource;

  /**
   * Check if object is a proxy
   */
  isProxy(obj: any): obj is LDProxy;

  /**
   * Turn a proxy and any embedded proxies back into original objects
   */
  unproxy(obj: Resource | Resource[]): Resource | Resource[];

  /**
   * Should property be treated as an array?
   */
  isArrayProperty(property: string, context?: Context): boolean;

  /**
   * Clone an object that might be a proxy
   */
  clone(obj: Resource): Resource;

  /**
   * Expand a resource using provided context
   */
  expand(resource: Resource | Resource[], context?: Context, opts?: ExpandOptions): Promise<Resource[]>;

  /**
   * Compact a resource using provided context
   */
  compact(resource: Resource | Resource[], context?: Context, opts?: CompactOptions): Promise<Resource>;

  /**
   * Compact keys in a resource
   */
  compactKeys(resource: Resource | Resource[], context: Context, opts?: Record<string, any>): Resource[];

  /**
   * Return QName for URI according to prefixes in context
   */
  compactUri(uri: string, context: Context): string;

  /**
   * Return URI for QName according to prefixes in context
   */
  expandQName(qname: string, context: Context): string;

  /**
   * Normalize i18n strings in a resource
   */
  normalizeI18N(resource: Resource, defaultLang?: string, context?: Context): void;

  /**
   * Flatten @list and @set objects into just an array
   */
  normalizeLists(resource: Resource, opts?: Record<string, any>): void;

  /**
   * Get module version
   */
  getVersion(): string;
}

export default LD; 