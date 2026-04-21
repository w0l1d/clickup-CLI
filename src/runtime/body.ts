import { Endpoint, ParamSchema } from '../spec/model';

function zeroForType(type: string | undefined): unknown {
  switch (type) {
    case 'string': return '';
    case 'integer':
    case 'number': return 0;
    case 'boolean': return false;
    case 'array': return [];
    case 'object': return {};
    default: return null;
  }
}

function seedFromSchema(schema: ParamSchema | undefined, depth = 0): unknown {
  if (!schema || depth > 6) return undefined;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;

  if (schema.type === 'object' || schema.properties) {
    const obj: Record<string, unknown> = {};
    const required = schema.required || [];
    const props = schema.properties || {};
    for (const key of required) {
      const sub = props[key];
      const v = seedFromSchema(sub, depth + 1);
      obj[key] = v === undefined ? zeroForType(sub?.type) : v;
    }
    return obj;
  }
  if (schema.type === 'array') {
    const itemSeed = seedFromSchema(schema.items, depth + 1);
    return itemSeed === undefined ? [] : [itemSeed];
  }
  return zeroForType(schema.type);
}

export function seedBody(endpoint: Endpoint): unknown | undefined {
  const rb = endpoint.requestBody;
  if (!rb) return undefined;
  if (rb.example !== undefined) {
    return JSON.parse(JSON.stringify(rb.example));
  }
  const seed = seedFromSchema(rb.schema);
  return seed;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function mergeBody(seed: unknown, override: unknown): unknown {
  if (override === undefined) return seed;
  if (seed === undefined) return override;
  if (isPlainObject(seed) && isPlainObject(override)) {
    const out: Record<string, unknown> = { ...seed };
    for (const [k, v] of Object.entries(override)) {
      out[k] = mergeBody(seed[k], v);
    }
    return out;
  }
  return override;
}
