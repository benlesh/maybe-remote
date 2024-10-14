import { defaultServicePlugins } from './default-plugins';
import {
  type PostMessageTarget,
  PostMessageConnection,
} from './post-message-connection';
import { ServicePlugin, ServiceConnection, ServiceDefinition } from './types';

export function createPostMessageService(options: {
  target: PostMessageTarget;
  def: ServiceDefinition;
  plugins?: ServicePlugin[];
}) {
  const { target, def, plugins = [] } = options;

  const connection = new PostMessageConnection(target);
  return new Service(connection, def, plugins);
}

export class Service {
  private disposed = false;

  private readonly plugins: ServicePlugin[];

  private readonly disposeMessageHandler: () => void;

  private readonly handleMessage = (message: any) => {
    const { connection, serviceDefinition } = this;
    for (const plugin of this.plugins) {
      if (plugin.handleMessage(message, connection, serviceDefinition)) {
        return;
      }
    }
  };

  constructor(
    private readonly connection: ServiceConnection,
    private readonly serviceDefinition: ServiceDefinition,
    plugins: ServicePlugin[]
  ) {
    this.plugins = [...defaultServicePlugins, ...plugins];

    this.disposeMessageHandler = connection.onMessage(this.handleMessage);
  }

  registerHandler(messageHandler: ServicePlugin) {
    this.plugins.push(messageHandler);
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.disposeMessageHandler();
    this.connection.dispose?.();
  }
}
