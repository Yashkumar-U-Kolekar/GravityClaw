import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../utils/logger.js';

export interface EpisodicMessage {
  id?: number;
  user_id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface SemanticFact {
  id?: number;
  user_id: number;
  fact: string;
  timestamp?: string;
}

class MemoryDatabase {
  private db: Database.Database;

  constructor(dbPath: string = 'data/gravity_claw.db') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath, {
      verbose: (msg) => logger.debug(`[SQLite] ${msg}`),
    });

    // Performance pragmas
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');

    this.initializeSchema();
  }

  private initializeSchema() {
    // Episodic Memory: raw conversation history
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodic_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Semantic Memory: explicit facts and preferences
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS semantic_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        fact TEXT NOT NULL UNIQUE,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // FTS5 Virtual Table for Semantic Search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS semantic_memory_fts USING fts5(
        fact,
        content='semantic_memory',
        content_rowid='id'
      );
    `);

    // Triggers to keep FTS table synced with semantic_memory
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS semantic_memory_ai AFTER INSERT ON semantic_memory BEGIN
        INSERT INTO semantic_memory_fts(rowid, fact) VALUES (new.id, new.fact);
      END;
      
      CREATE TRIGGER IF NOT EXISTS semantic_memory_ad AFTER DELETE ON semantic_memory BEGIN
        INSERT INTO semantic_memory_fts(semantic_memory_fts, rowid, fact) VALUES('delete', old.id, old.fact);
      END;
      
      CREATE TRIGGER IF NOT EXISTS semantic_memory_au AFTER UPDATE ON semantic_memory BEGIN
        INSERT INTO semantic_memory_fts(semantic_memory_fts, rowid, fact) VALUES('delete', old.id, old.fact);
        INSERT INTO semantic_memory_fts(rowid, fact) VALUES (new.id, new.fact);
      END;
    `);

    logger.info('Memory database schema initialized.');
  }

  // --- Episodic Memory Methods ---

  addEpisodicMessage(message: EpisodicMessage): void {
    const stmt = this.db.prepare(
      'INSERT INTO episodic_memory (user_id, role, content) VALUES (?, ?, ?)'
    );
    stmt.run(message.user_id, message.role, message.content);
  }

  getRecentEpisodicMemory(userId: number, limit: number = 10): EpisodicMessage[] {
    const stmt = this.db.prepare(
      'SELECT role, content FROM (SELECT role, content, timestamp FROM episodic_memory WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?) ORDER BY timestamp ASC'
    );
    return stmt.all(userId, limit) as EpisodicMessage[];
  }

  // --- Semantic Memory Methods ---

  saveSemanticFact(userId: number, fact: string): void {
    try {
      const stmt = this.db.prepare(
        'INSERT INTO semantic_memory (user_id, fact) VALUES (?, ?)'
      );
      stmt.run(userId, fact);
      logger.info(`Saved new semantic fact for user ${userId}`);
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        logger.debug(`Fact already exists: "${fact}"`);
      } else {
        throw err;
      }
    }
  }

  searchSemanticMemory(userId: number, query: string, limit: number = 5): string[] {
    // Sanitize query for FTS5 (escape quotes)
    const sanitizedQuery = query.replace(/"/g, '""');
    
    const stmt = this.db.prepare(`
      SELECT s.fact 
      FROM semantic_memory_fts fts
      JOIN semantic_memory s ON fts.rowid = s.id
      WHERE s.user_id = ? AND semantic_memory_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    
    // Using auto-prefix wildcard for partial matching
    const matchQuery = `"${sanitizedQuery}"*`;
    const rows = stmt.all(userId, matchQuery, limit) as { fact: string }[];
    return rows.map(r => r.fact);
  }

  close(): void {
    logger.info('Closing SQLite connection.');
    this.db.close();
  }
}

export const db = new MemoryDatabase();
