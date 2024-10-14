type Teardown = () => void;

export interface ServiceConnection {
  send(message: TransportMessage): void;
  onMessage(callback: (message: any) => void): Teardown;
  dispose?: () => void;
}

export interface TransportMessage {
  type: string;
  payload: unknown;
}

export interface ServiceDefinition {
  [key: string]: (...params: any[]) => any;
}

export interface ServicePlugin {
  handleMessage(
    message: TransportMessage,
    connection: ServiceConnection,
    serviceDefinition: ServiceDefinition
  ): boolean;
}

export interface UnknownMethodError {
  type: 'unknown-method-error';
  payload: {
    method: string;
  };
}

export interface ClientPlugin {
  findHandler(method: string, connection: ServiceConnection): any;
}
