export { createPostMessageService, Service } from './lib/service';
export { createPostMessageClient, createClient } from './lib/client';
export {
  PostMessageConnection,
  type PostMessageTarget,
} from './lib/post-message-connection';
export type {
  ServiceConnection,
  ServiceDefinition,
  TransportMessage,
  ClientPlugin,
  ServicePlugin,
} from './lib/types';
