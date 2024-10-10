import { ServiceConnection } from './types';

export interface PostMessageTarget {
  postMessage(message: any): void;

  addEventListener(
    type: 'message',
    handler: (event: { data: any }) => void
  ): void;

  removeEventListener(
    type: 'message',
    handler: (event: { data: any }) => void
  ): void;
}

export interface NodePostMessageTarget {
  postMessage(message: any): void;

  on(type: 'message', handler: (event: { data: any }) => void): void;

  off(type: 'message', handler: (event: { data: any }) => void): void;
}

export class PostMessageConnection implements ServiceConnection {
  private disposed = false;

  private readonly messageHandlers = new Set<(message: any) => void>();

  private readonly handleMessage = (e: { data: any }) => {
    const data = e.data;
    const message = typeof data === 'string' ? JSON.parse(data) : data;
    const messageHandlers = Array.from(this.messageHandlers);

    for (const handler of messageHandlers) {
      try {
        handler(message);
      } catch (error) {
        if ('reportError' in globalThis) {
          reportError(error);
        } else {
          setTimeout(() => {
            throw error;
          });
        }
      }
    }
  };

  constructor(
    private readonly target: PostMessageTarget | NodePostMessageTarget
  ) {
    if ('addEventListener' in target) {
      target.addEventListener('message', this.handleMessage);
    } else {
      target.on('message', this.handleMessage);
    }
  }

  onMessage(callback: (message: any) => void): () => void {
    this.messageHandlers.add(callback);
    return () => {
      this.messageHandlers.delete(callback);
    };
  }

  send(message: any) {
    this.target.postMessage(message);
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if ('removeEventListener' in this.target) {
      this.target.removeEventListener('message', this.handleMessage);
    } else {
      this.target.off('message', this.handleMessage);
    }
  }
}
