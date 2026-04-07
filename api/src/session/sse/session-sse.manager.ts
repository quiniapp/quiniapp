import { Response } from 'express';

class SessionSSEManager {
  private connections = new Map<string, Response>();

  add(sessionId: string, res: Response): void {
    this.connections.set(sessionId, res);
  }

  remove(sessionId: string): void {
    this.connections.delete(sessionId);
  }

  expire(sessionId: string): void {
    const res = this.connections.get(sessionId);
    if (!res) return;
    try {
      res.write('data: {"type":"session_expired"}\n\n');
      res.end();
    } catch {
      // Connection already closed
    }
    this.connections.delete(sessionId);
  }

  /**
   * Sends a ping to all connections to detect dead ones.
   * Removes dead connections from the map.
   */
  pingAll(): void {
    for (const [sessionId, res] of this.connections) {
      try {
        res.write('data: {"type":"ping"}\n\n');
      } catch {
        this.connections.delete(sessionId);
      }
    }
  }

  getAllSessionIds(): string[] {
    return [...this.connections.keys()];
  }

  size(): number {
    return this.connections.size;
  }
}

export const sseManager = new SessionSSEManager();
