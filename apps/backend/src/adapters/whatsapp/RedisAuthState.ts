import { proto, initAuthCreds, AuthenticationState, AuthenticationCreds, SignalDataSet, SignalDataTypeMap } from '@whiskeysockets/baileys';
import Redis from 'ioredis';

/**
 * Custom Baileys Authentication State that persists to Redis.
 * Ported and adapted from message-sender project for Boti.
 */
export async function useRedisAuthState(userId: string, redis: Redis) {
  const ttl = Number(process.env.REDIS_AUTH_TTL_SECONDS || 60 * 60 * 24 * 30); // Default 30 days
  
  const baseKey = `wa:auth:${userId}`;
  const credsKey = `${baseKey}:creds`;
  const keysKey = (type: string, id: string) => `${baseKey}:keys:${type}:${id}`;

  const replacer = (_key: string, value: any) => {
    if (Buffer.isBuffer(value) || value instanceof Uint8Array || (value && value.type === 'Buffer')) {
      return { type: 'Buffer', data: Array.from(value instanceof Uint8Array ? value : value.data) };
    }
    return value;
  };

  const reviver = (_key: string, value: any) => {
    if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
      return Buffer.from(value.data);
    }
    return value;
  };

  function serialize(value: any) {
    return JSON.stringify(value, replacer);
  }

  function deserialize(raw: string | null, type?: string) {
    if (!raw) return null;
    let parsed;
    try {
      parsed = JSON.parse(raw, reviver);
    } catch {
      return raw;
    }
    
    if (type === 'app-state-sync-key' && parsed) {
      return proto.Message.AppStateSyncKeyData.fromObject(parsed);
    }
    return parsed;
  }

  // Load existing credentials or initialize new ones
  let creds: AuthenticationCreds;
  const existingCredsRaw = await redis.get(credsKey);
  if (existingCredsRaw) {
    creds = deserialize(existingCredsRaw) as AuthenticationCreds;
  } else {
    creds = initAuthCreds();
  }

  const saveCreds = async () => {
    await redis.set(credsKey, serialize(creds), 'EX', ttl);
  };

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type, ids) => {
        const pipeline = redis.pipeline();
        ids.forEach(id => pipeline.get(keysKey(type, id)));
        const results = await pipeline.exec();
        
        const data: { [id: string]: any } = {};
        ids.forEach((id, index) => {
          const [err, result] = results?.[index] || [null, null];
          if (!err && result) {
            data[id] = deserialize(result as string, type);
          }
        });
        return data;
      },
      set: async (data) => {
        const pipeline = redis.pipeline();
        for (const type in data) {
          const category = data[type as keyof SignalDataTypeMap];
          if (!category) continue;

          for (const id in category) {
            const value = (category as any)[id];
            const key = keysKey(type, id);
            if (value) {
              pipeline.set(key, serialize(value), 'EX', ttl);
            } else {
              pipeline.del(key);
            }
          }
        }
        await pipeline.exec();
      }
    }
  };

  const clear = async () => {
    const keys = await redis.keys(`${baseKey}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  };

  return { state, saveCreds, clear };
}
