import {
  ClientPlugin,
  ServiceConnection,
  ServiceDefinition,
  ServicePlugin,
} from '@maybe-remote/core';
import { Observable, Subscription } from 'rxjs';

export interface RxJSGetObservable {
  type: 'rxjs-get';
  payload: {
    observableId: string;
    method: string;
    params: any[];
  };
}

export interface RxJSSubscribe {
  type: 'rxjs-subscribe';
  payload: {
    observableId: string;
    subscriptionId: string;
  };
}

export interface RxJSUnsubscribe {
  type: 'rxjs-unsubscribe';
  payload: {
    subscriptionId: string;
  };
}

export interface RxJSGC {
  type: 'rxjs-gc';
  payload: {
    observableIds: string[];
  };
}

export interface RxJSNext {
  type: 'rxjs-next';
  payload: {
    subscriptionId: string;
    value: any;
  };
}

export interface RxJSError {
  type: 'rxjs-error';
  payload: {
    subscriptionId: string;
    error: string;
  };
}

export interface RxJSComplete {
  type: 'rxjs-complete';
  payload: {
    subscriptionId: string;
  };
}

export class RxJSServicePlugin implements ServicePlugin {
  private observables = new Map<string, Observable<any>>();
  private observableSubscriptionIds = new Map<string, Set<string>>();
  private subscriptionObservableIds = new Map<string, string>();
  private subscriptions = new Map<string, Subscription>();

  private trackSubscription(
    observableId: string,
    subscriptionId: string,
    subscription: Subscription
  ) {
    const subscriptionIds =
      this.observableSubscriptionIds.get(observableId) ?? new Set();
    subscriptionIds.add(subscriptionId);
    this.observableSubscriptionIds.set(observableId, subscriptionIds);
    this.subscriptions.set(subscriptionId, subscription);
  }

  private untrackSubscription(subscriptionId: string) {
    const observableId = this.subscriptionObservableIds.get(subscriptionId);
    if (observableId) {
      this.subscriptionObservableIds.delete(subscriptionId);
      const subscriptionIds = this.observableSubscriptionIds.get(observableId);
      if (subscriptionIds) {
        subscriptionIds.delete(subscriptionId);
        if (subscriptionIds.size === 0) {
          this.observableSubscriptionIds.delete(observableId);
        }
      }
    }
    this.subscriptions.delete(subscriptionId);
  }

  private trackObservable(observableId: string, observable: Observable<any>) {
    this.observables.set(observableId, observable);
  }

  private untrackObservable(observableId: string) {
    this.observables.delete(observableId);
  }

  handleMessage(
    message: RxJSGetObservable | RxJSSubscribe | RxJSUnsubscribe | RxJSGC,
    connection: ServiceConnection,
    serviceDefintion: ServiceDefinition
  ): boolean {
    switch (message.type) {
      case 'rxjs-get': {
        const { observableId, method, params } = message.payload;

        const fn = serviceDefintion[method];

        if (typeof fn !== 'function') {
          connection.send({
            type: 'unknown-method-error',
            payload: {
              method,
            },
          });
          return true;
        }

        const observable = fn(...params);

        this.trackObservable(observableId, observable);

        return true;
      }

      case 'rxjs-subscribe': {
        const { observableId, subscriptionId } = message.payload;
        const observable = this.observables.get(observableId);

        if (!observable) {
          throw new Error(`Observable with id ${observableId} not found`);
        }

        const subscription = observable.subscribe({
          next: (value) => {
            connection.send({
              type: 'rxjs-next',
              payload: {
                subscriptionId,
                value,
              },
            });
          },
          error: (error) => {
            this.observableSubscriptionIds
              .get(observableId)
              ?.delete(subscriptionId);
            this.subscriptions.delete(subscriptionId);
            this.subscriptionObservableIds.delete(subscriptionId);
            connection.send({
              type: 'rxjs-error',
              payload: {
                subscriptionId,
                error: error instanceof Error ? error.message : error,
              },
            });
          },
          complete: () => {
            this.observableSubscriptionIds
              .get(observableId)
              ?.delete(subscriptionId);
            this.subscriptions.delete(subscriptionId);
            this.subscriptionObservableIds.delete(subscriptionId);
            connection.send({
              type: 'rxjs-complete',
              payload: {
                subscriptionId,
              },
            });
          },
        });

        this.trackSubscription(observableId, subscriptionId, subscription);

        return true;
      }

      case 'rxjs-unsubscribe': {
        const { subscriptionId } = message.payload;
        const subscription = this.subscriptions.get(subscriptionId);

        if (!subscription) {
          throw new Error(`Subscription with id ${subscriptionId} not found`);
        }

        this.untrackSubscription(subscriptionId);

        subscription.unsubscribe();
        return true;
      }

      case 'rxjs-gc': {
        const { observableIds } = message.payload;
        for (const observableId of observableIds) {
          this.untrackObservable(observableId);
        }
        return true;
      }
    }

    return false;
  }
}

export const rxjsServicePlugin = new RxJSServicePlugin();

export class RxJSClientPlugin implements ClientPlugin {
  private refs = new Map<string, WeakRef<Observable<any>>>();

  private cleanRefs(connection: ServiceConnection) {
    let observableIds: string[] | null = null;
    for (const [subscriptionId, ref] of this.refs) {
      if (!ref.deref()) {
        this.refs.delete(subscriptionId);
        observableIds ??= [];
        observableIds.push(subscriptionId);
      }
    }

    if (observableIds) {
      connection.send({
        type: 'rxjs-gc',
        payload: {
          observableIds,
        },
      });
    }
  }

  private scheduledCleanRefs = 0;
  private scheduleCleanRefs(connection: ServiceConnection) {
    if (this.scheduledCleanRefs !== 0 || this.refs.size === 0) return;

    this.scheduledCleanRefs = requestIdleCallback(() => {
      this.scheduledCleanRefs = 0;
      this.cleanRefs(connection);
    });
  }

  findHandler(method: string, connection: ServiceConnection) {
    this.scheduleCleanRefs(connection);

    if (method.startsWith('stream')) {
      return (...params: any[]) => {
        const subscriptionId = crypto.randomUUID();

        connection.send({
          type: 'rxjs-get',
          payload: {
            subscriptionId,
            method,
            params,
          },
        });

        const observable = new Observable<any>((subscriber) => {
          const dispose = connection.onMessage((message) => {
            switch (message.type) {
              case 'rxjs-next': {
                if (message.payload.subscriptionId === subscriptionId) {
                  subscriber.next(message.payload.value);
                }
                return;
              }
              case 'rxjs-error': {
                if (message.payload.subscriptionId === subscriptionId) {
                  subscriber.error(new Error(message.payload.error));
                }
                return;
              }
              case 'rxjs-complete': {
                if (message.payload.subscriptionId === subscriptionId) {
                  subscriber.complete();
                }
                return;
              }
            }
          });

          subscriber.add(() => {
            dispose();
            connection.send({
              type: 'rxjs-unsubscribe',
              payload: {
                subscriptionId,
              },
            });
          });

          connection.send({
            type: 'rxjs-subscribe',
            payload: {
              subscriptionId,
            },
          });
        });

        this.refs.set(subscriptionId, new WeakRef(observable));

        return observable;
      };
    }

    return;
  }
}

export const rxjsClientPlugin = new RxJSClientPlugin();
