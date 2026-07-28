const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL || 'http://localhost:3001';
const EMIT_SECRET = process.env.SOCKET_EMIT_SECRET || 'Skystruct-internal-secret';

export async function emitToProject(projectId, event, payload = {}) {
  try {
    const cleanPayload = payload && typeof payload.toJSON === 'function' ? payload.toJSON() : payload;
    
    const response = await fetch(`${SOCKET_SERVER_URL}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: EMIT_SECRET,
        room: `project:${projectId}`,
        event,
        payload: { projectId, ...cleanPayload },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Socket emit failed with status ${response.status}: ${errorData.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`[Socket Error] Failed to emit '${event}' to project:${projectId}:`, error.message);
  }
}

export async function emitToOrg(orgId, event, payload = {}) {
  try {
    const cleanPayload = payload && typeof payload.toJSON === 'function' ? payload.toJSON() : payload;

    const response = await fetch(`${SOCKET_SERVER_URL}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: EMIT_SECRET,
        room: `org:${orgId}`,
        event,
        payload: { orgId, ...cleanPayload },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Socket emit failed with status ${response.status}: ${errorData.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`[Socket Error] Failed to emit '${event}' to org:${orgId}:`, error.message);
  }
}

export async function emitToUser(userId, event, payload = {}) {
  try {
    const cleanPayload = payload && typeof payload.toJSON === 'function' ? payload.toJSON() : payload;

    const response = await fetch(`${SOCKET_SERVER_URL}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: EMIT_SECRET,
        room: `user:${userId}`,
        event,
        payload: { userId, ...cleanPayload },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Socket emit failed with status ${response.status}: ${errorData.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`[Socket Error] Failed to emit '${event}' to user:${userId}:`, error.message);
  }
}
