import { describe, it, expect } from 'vitest';
import { cleanJsonSchema } from './schema-cleaner.js';

describe('JSON Schema Cleaner', () => {
  it('should remove propertyNames', () => {
    const schema = {
      type: 'object',
      propertyNames: { pattern: '^[a-z]+$' },
      properties: { foo: { type: 'string' } }
    };
    cleanJsonSchema(schema);
    expect(schema).not.toHaveProperty('propertyNames');
    expect(schema).toHaveProperty('properties.foo');
  });

  it('should remove anyOf and oneOf', () => {
    const schema = {
      type: 'object',
      properties: {
        foo: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        bar: { oneOf: [{ type: 'string' }] }
      }
    };
    cleanJsonSchema(schema);
    expect((schema as any).properties.foo).not.toHaveProperty('anyOf');
    expect((schema as any).properties.bar).not.toHaveProperty('oneOf');
  });

  it('should remove validation fields', () => {
    const schema = {
      type: 'string',
      pattern: '^[a-z]+$',
      minLength: 1,
      maximum: 10
    };
    cleanJsonSchema(schema);
    expect(schema).not.toHaveProperty('pattern');
    expect(schema).not.toHaveProperty('minLength');
    expect(schema).not.toHaveProperty('maximum');
  });

  it('should clean [undefined] string values (Cherry Studio artifact)', () => {
    const obj = {
      valid: 'value',
      invalid: '[undefined]',
      nested: {
        arr: ['test', '[undefined]']
      }
    };
    cleanJsonSchema(obj);
    expect(obj).not.toHaveProperty('invalid');
    expect((obj as any).nested.arr).not.toContain('[undefined]');
    expect((obj as any).nested.arr).toContain('test');
  });

  it('should leave normal schema untouched', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' }
      },
      required: ['name']
    };
    const cloned = JSON.parse(JSON.stringify(schema));
    cleanJsonSchema(schema);
    expect(schema).toEqual(cloned);
  });
});
