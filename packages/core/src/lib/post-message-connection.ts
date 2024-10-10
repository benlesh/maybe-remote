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

export class PostMessageConnection implements ServiceConnection {
  private disposed = false;

  private readonly messageHandlers = new Set<(message: any) => void>();

  private readonly handleMessage = (message: any) => {};

  constructor(private readonly target: PostMessageTarget) {
    target.addEventListener('message', this.handleMessage);
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
    this.target.removeEventListener('message', this.handleMessage);
  }
}
