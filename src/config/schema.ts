import schema from './schema.json';

const obj = Object.assign({}, schema);
delete (obj as { version?: unknown }).version;
export const MinimalifySchema = obj;
