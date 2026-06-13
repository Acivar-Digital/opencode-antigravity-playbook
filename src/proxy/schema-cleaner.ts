export function cleanJsonSchema(value: any, depth = 0): void {
  if (depth > 10 || !value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    // Clean [undefined] items from array (in place)
    for (let i = value.length - 1; i >= 0; i--) {
      if (value[i] === '[undefined]') {
        value.splice(i, 1);
      } else {
        cleanJsonSchema(value[i], depth + 1);
      }
    }
    return;
  }

  // Value is an object
  const keysToRemove = [
    'propertyNames',
    'anyOf',
    'oneOf',
    'allOf',
    'pattern',
    'minLength',
    'maxLength',
    'minimum',
    'maximum',
    'multipleOf',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'minItems',
    'maxItems',
    'format'
  ];

  for (const key of Object.keys(value)) {
    if (keysToRemove.includes(key)) {
      delete value[key];
      continue;
    }

    if (value[key] === '[undefined]') {
      delete value[key];
      continue;
    }

    cleanJsonSchema(value[key], depth + 1);
  }
}
