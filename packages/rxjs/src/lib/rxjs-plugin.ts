import {
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

export function rxjsServicePlugin(): ServicePlugin {
  const observables = new Map<string, Observable<any>>();
  const observableSubscriptionIds = new Map<string, Set<string>>();
  const subscriptionObservableIds = new Map<string, string>();
  const subscriptions = new Map<string, Subscription>();

  const trackSubscription = (
    observableId: string,
    subscriptionId: string,
    subscription: Subscription
  ) => {
    const subscriptionIds =
      observableSubscriptionIds.get(observableId) ?? new Set();
    subscriptionIds.add(subscriptionId);
    observableSubscriptionIds.set(observableId, subscriptionIds);
    subscriptions.set(subscriptionId, subscription);
  };

  const untrackSubscription = (subscriptionId: string) => {
    const observableId = subscriptionObservableIds.get(subscriptionId);
    if (observableId) {
      subscriptionObservableIds.delete(subscriptionId);
      const subscriptionIds = observableSubscriptionIds.get(observableId);
      if (subscriptionIds) {
        subscriptionIds.delete(subscriptionId);
        if (subscriptionIds.size === 0) {
          observableSubscriptionIds.delete(observableId);
        }
      }
    }
    subscriptions.delete(subscriptionId);
  };

  const trackObservable = (
    observableId: string,
    observable: Observable<any>
  ) => {
    observables.set(observableId, observable);
  };

  const untrackObservable = (observableId: string) => {
    observables.delete(observableId);
  };

  return ((
    message: RxJSGetObservable | RxJSSubscribe | RxJSUnsubscribe | RxJSGC,
    connection: ServiceConnection,
    serviceDefintion: ServiceDefinition
  ): boolean => {
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

        trackObservable(observableId, observable);

        return true;
      }

      case 'rxjs-subscribe': {
        const { observableId, subscriptionId } = message.payload;
        const observable = observables.get(observableId);

        if (!observable) {
          throw new Error(`Observable with id ${observableId} not found`);
        }

        const subscription = observable.subscribe({
          next(value) {
            connection.send({
              type: 'rxjs-next',
              payload: {
                subscriptionId,
                value,
              },
            });
          },
          error(error) {
            observableSubscriptionIds.get(observableId)?.delete(subscriptionId);
            subscriptions.delete(subscriptionId);
            subscriptionObservableIds.delete(subscriptionId);
            connection.send({
              type: 'rxjs-error',
              payload: {
                subscriptionId,
                error: error instanceof Error ? error.message : error,
              },
            });
          },
          complete() {
            observableSubscriptionIds.get(observableId)?.delete(subscriptionId);
            subscriptions.delete(subscriptionId);
            subscriptionObservableIds.delete(subscriptionId);
            connection.send({
              type: 'rxjs-complete',
              payload: {
                subscriptionId,
              },
            });
          },
        });

        trackSubscription(observableId, subscriptionId, subscription);

        return true;
      }

      case 'rxjs-unsubscribe': {
        const { subscriptionId } = message.payload;
        const subscription = subscriptions.get(subscriptionId);

        if (!subscription) {
          throw new Error(`Subscription with id ${subscriptionId} not found`);
        }

        untrackSubscription(subscriptionId);

        subscription.unsubscribe();
        return true;
      }

      case 'rxjs-gc': {
        const { observableIds } = message.payload;
        observableIds.forEach(untrackObservable);
        return true;
      }
    }

    return false;
  }) as any;
}

export function rxjsClientPlugin() {
  const refs = new Map<string, WeakRef<Observable<any>>>();

  const cleanRefs = (connection: ServiceConnection) => {
    let observableIds: string[] | null = null;
    for (const [subscriptionId, ref] of refs) {
      if (!ref.deref()) {
        refs.delete(subscriptionId);
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
  };

  let scheduledCleanRefs = 0;
  const scheduleCleanRefs = (connection: ServiceConnection) => {
    if (scheduledCleanRefs !== 0 || refs.size === 0) return;

    scheduledCleanRefs = requestIdleCallback(() => {
      scheduledCleanRefs = 0;
      cleanRefs(connection);
    });
  };

  return (method: string, connection: ServiceConnection) => {
    scheduleCleanRefs(connection);

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

        refs.set(subscriptionId, new WeakRef(observable));

        return observable;
      };
    }

    return;
  };
}
