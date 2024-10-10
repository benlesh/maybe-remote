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
}) {
  const { connection, plugins: additionalPlugins = [] } = options;

  const plugins = [...defaultClientPlugins, ...additionalPlugins];

  return new Proxy<Def>({} as Def, {
    get(_target, prop) {
      if (typeof prop === 'string') {
        if (prop === 'dispose' && connection.dispose) {
          return;
        }

        return plugins.find((caller) => caller(prop, connection));
      }

      return undefined;
    },
  });
}
