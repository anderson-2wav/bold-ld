/**
 * LD Class TypeScript Declarations
 * JSON-LD utilities for BOLD project
 */

export interface ILD {
  /** Current version of the module */
  readonly version: string;
  
  /**
   * Process a message and return it with an LD prefix
   * @param message - The message to process
   * @returns The processed message with LD prefix
   */
  processMessage(message: any): string;
  
  /**
   * Get the current version of the module
   * @returns The module version string
   */
  getVersion(): string;
  
  /**
   * Create a promise that resolves after the specified delay
   * @param delay - Delay in milliseconds
   * @returns A promise that resolves with a delay message
   */
  delay(delay: number): Promise<string>;

  /**
   * Create a proxy for JSON-LD objects
   * @param doc - The document to proxy
   * @param realTarget - Optional real target
   * @returns A proxy object
   */
  proxy(doc: object, realTarget?: object): ProxyHandler<object>;

  /**
   * Check if an object is a proxy
   * @param obj - The object to check
   * @returns True if the object is a proxy
   */
  isProxy(obj: any): boolean;

  /**
   * Check if a property should be treated as an array
   * @param property - The property name
   * @param opts - Options
   * @returns True if the property should be an array
   */
  isArrayProperty(property: string, opts?: any): boolean;

  /**
   * Turn a proxy and any embedded proxies back into original objects
   * @param obj - The object to unproxy
   * @returns The original object
   */
  unproxy(obj: object | object[]): object;

  /**
   * Clone an object that might be a proxy
   * @param obj - The object to clone
   * @returns A cloned object
   */
  clone(obj: any): any;

  /**
   * Expand a resource, using a provided context
   * @param resource - The resource to expand
   * @param context - The context to use
   * @param opts - Options
   * @returns Promise with expanded resources
   */
  expand(resource: object | object[], context?: object, opts?: { flatten?: boolean }): Promise<object[]>;

  /**
   * Compact a resource or resources, using a provided context
   * @param resource - The resource to compact
   * @param context - The context to use
   * @param opts - Options
   * @returns Promise with compacted resource
   */
  compact(resource: object | object[], context?: object, opts?: {
    firstExpand?: boolean;
    flatten?: boolean;
    showContext?: boolean;
    ensureArrayProps?: boolean;
    ensureSafeKeys?: boolean;
    sortTypesFn?: (types: string[], context: object) => void;
    normalizeI18N?: boolean;
    normalizeLists?: boolean;
    normalizeJSON?: boolean;
    proxy?: boolean;
  }): Promise<object>;

  /**
   * Compact keys in a resource according to context
   * @param resource - The resource to compact
   * @param context - The context to use
   * @param opts - Options
   * @returns Array of compacted resources
   */
  compactKeys(resource: object | object[], context: object, opts?: {
    recursive?: boolean;
    cleanUnsafeKeys?: boolean;
    nsList?: Array<{ re: RegExp; prefix: string }>;
  }): object[];

  /**
   * Return QName for URI according to prefixes in context
   * @param uri - The URI to compact
   * @param context - The context to use
   * @returns The compacted URI
   */
  compactUri(uri: string, context: object): string;

  /**
   * Return URI for QName according to prefixes in context
   * @param qname - The QName to expand
   * @param context - The context to use
   * @returns The expanded URI
   */
  expandQName(qname: string, context: object): string;

  /**
   * Normalize i18n strings in a resource
   * @param resource - The resource to normalize
   * @param defaultLang - The default language
   */
  normalizeI18N(resource: object, defaultLang?: string): void;

  /**
   * Flatten @list and @set objects into just an array
   * @param resource - The resource to normalize
   * @param opts - Options
   */
  normalizeLists(resource: object, opts?: object): void;
}

/**
 * LD class constructor interface
 */
export interface LDConstructor {
  new(): ILD;
}

/**
 * LD class implementation
 */
export declare class LD implements ILD {
  readonly version: string;
  
  constructor(opts?: {
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
  });
  
  processMessage(message: any): string;
  getVersion(): string;
  delay(delay: number): Promise<string>;
  proxy(doc: object, realTarget?: object): ProxyHandler<object>;
  isProxy(obj: any): boolean;
  isArrayProperty(property: string, opts?: any): boolean;
  unproxy(obj: object | object[]): object;
  clone(obj: any): any;
  expand(resource: object | object[], context?: object, opts?: { flatten?: boolean }): Promise<object[]>;
  compact(resource: object | object[], context?: object, opts?: {
    firstExpand?: boolean;
    flatten?: boolean;
    showContext?: boolean;
    ensureArrayProps?: boolean;
    ensureSafeKeys?: boolean;
    sortTypesFn?: (types: string[], context: object) => void;
    normalizeI18N?: boolean;
    normalizeLists?: boolean;
    normalizeJSON?: boolean;
    proxy?: boolean;
  }): Promise<object>;
  compactKeys(resource: object | object[], context: object, opts?: {
    recursive?: boolean;
    cleanUnsafeKeys?: boolean;
    nsList?: Array<{ re: RegExp; prefix: string }>;
  }): object[];
  compactUri(uri: string, context: object): string;
  expandQName(qname: string, context: object): string;
  normalizeI18N(resource: object, defaultLang?: string): void;
  normalizeLists(resource: object, opts?: object): void;
}

/**
 * Default export - the LD class constructor
 */
declare const LD: LDConstructor;

export default LD; 