/**
 * The life of an input connection, as one value. Each state carries only what is true in
 * that state, so combinations like "connected with no device" or "failed but connected"
 * cannot be represented.
 *
 *   unsupported                          the browser cannot do this at all
 *   idle        -> requesting            nothing connected
 *   requesting  -> connected | failed    waiting on a permission prompt or a device
 *   connected   -> requesting | idle | failed
 *   failed      -> requesting | idle     `message` says why and what to do
 *
 * `notice` on a connected input is something worth telling the player that is not a
 * failure, such as a device switch that fell back to the previous device.
 */
export type Connection<Device> =
  | { status: 'unsupported'; message: string }
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'connected'; device: Device; notice: string | null }
  | { status: 'failed'; message: string };

export function isConnected<Device>(connection: Connection<Device>): boolean {
  return connection.status === 'connected';
}

export function deviceOf<Device>(connection: Connection<Device>): Device | null {
  return connection.status === 'connected' ? connection.device : null;
}

/** The problem to show, if there is one. */
export function failureOf<Device>(connection: Connection<Device>): string | null {
  return connection.status === 'failed' ? connection.message : null;
}
