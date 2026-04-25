import Pusher from "pusher";
import type { PusherChannel } from "./types";

let _pusher: Pusher | null = null;

export function pusher(): Pusher {
  if (_pusher) return _pusher;
  _pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.PUSHER_CLUSTER!,
    useTLS: true,
  });
  return _pusher;
}

export async function publish<T>(
  channel: PusherChannel,
  event: string,
  data: T,
): Promise<void> {
  await pusher().trigger(channel, event, data as object);
}
