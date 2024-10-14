import { defaultClientPlugins } from './default-plugins';
import {
  PostMessageConnection,
  PostMessageTarget,
} from './post-message-connection';
import { ClientPlugin, ServiceConnection } from './types';

export function createPostMessageClient<Def extends object>(options: {
  target: PostMessageTarget;
  plugins?: ClientPlugin[];
}) {
  const { target, plugins: additionalPlugins = [] } = options;

  const connection = new PostMessageConnection(target);

  return createClient<Def>({
    connection,
    plugins: additionalPlugins,
  });
}

export function createClient<Def extends object>(options: {
  connection: ServiceConnection;
  plugins?: ClientPlugin[];
}): Def & { dispose(): void } {
  const { connection, plugins: additionalPlugins = [] } = options;

  const plugins = [...defaultClientPlugins, ...additionalPlugins];

  return new Proxy<Def & { dispose(): void }>({} as any, {
    get(_target, prop) {
      if (typeof prop === 'string') {
        if (prop === 'dispose') {
          return () => {
            connection.dispose?.();
          };
        }

        for (const plugin of plugins) {
          const handler = plugin.findHandler(prop, connection);
          if (handler !== undefined) {
            return handler;
          }
        }
      }

      return undefined;
    },
  });
}
