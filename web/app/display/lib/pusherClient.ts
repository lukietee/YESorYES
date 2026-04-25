"use client";

import PusherJS from "pusher-js";

let _client: PusherJS | null = null;

export function pusherClient(): PusherJS {
  if (_client) return _client;
  _client = new PusherJS(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  });
  return _client;
}
