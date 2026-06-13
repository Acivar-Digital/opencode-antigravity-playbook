export interface ExtractedAccount {
  email?: string;
  refreshToken: string;
}

export function extractTokensFromDb(db: any): ExtractedAccount | null {
  try {
    // 1. Try New Format
    let row = db.prepare('SELECT value FROM ItemTable WHERE key = ?')
      .get('antigravityUnifiedStateSync.oauthToken');
      
    if (!row) {
      // 2. Try Old Format
      row = db.prepare('SELECT value FROM ItemTable WHERE key = ?')
        .get('jetskiStateSync.agentManagerInitState');
    }

    if (!row || !row.value) return null;

    // Decode base64
    const decoded = Buffer.from(row.value, 'base64').toString('utf8');

    // Extract Refresh Token (Google refresh tokens always start with "1//")
    // Regex matches 1// followed by alphanumeric, dashes, and underscores
    const tokenMatch = decoded.match(/1\/\/[a-zA-Z0-9_-]+/);
    if (!tokenMatch) return null;

    // Extract Email (Standard email regex on the decoded binary string)
    const emailMatch = decoded.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

    return {
      refreshToken: tokenMatch[0],
      email: emailMatch ? emailMatch[0] : undefined
    };
  } catch (error) {
    // If table doesn't exist or DB is locked
    return null;
  }
}
