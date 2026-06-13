import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { extractTokensFromDb } from './vscdb-extractor.js';

describe('VSCDB Extractor', () => {
  let db: any;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE ItemTable (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('should extract refresh token from mock protobuf data', () => {
    // A mock refresh token always starts with 1//
    const mockToken = '1//0eMockGoogleRefreshToken-abc123DEF456ghi789jkl';
    const mockEmail = 'test@example.com';
    
    // Create a mock binary payload that looks vaguely like protobuf containing these strings
    // and base64 encode it as the VSCode storage does.
    const rawPayload = `some_proto_garbage\x10${mockEmail}\x1A${mockToken}\x12\x12more_binary`;
    const b64Payload = Buffer.from(rawPayload).toString('base64');

    db.prepare('INSERT INTO ItemTable (key, value) VALUES (?, ?)').run(
      'antigravityUnifiedStateSync.oauthToken', 
      b64Payload
    );

    const result = extractTokensFromDb(db);
    expect(result).not.toBeNull();
    expect(result?.refreshToken).toBe(mockToken);
    expect(result?.email).toBe(mockEmail);
  });

  it('should return null if the token key is missing', () => {
    const result = extractTokensFromDb(db);
    expect(result).toBeNull();
  });

  it('should fallback to old Jetski format if unified format missing', () => {
    const mockToken = '1//0eOldFormatToken-XYZ';
    const rawPayload = `\x1A${mockToken}`;
    const b64Payload = Buffer.from(rawPayload).toString('base64');

    db.prepare('INSERT INTO ItemTable (key, value) VALUES (?, ?)').run(
      'jetskiStateSync.agentManagerInitState', 
      b64Payload
    );

    const result = extractTokensFromDb(db);
    expect(result?.refreshToken).toBe(mockToken);
  });
});
