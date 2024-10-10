import { ServiceConnection, ServiceDefinition } from './types';

export interface AsyncIteratorRequest {
  type: 'async-iterator-request';
  payload: {
    iteratorId: string;
    method: string;
    params: any[];
  };
}

export interface AsyncIteratorNext {
  type: 'async-iterator-next';
  payload: {
    iteratorId: string;
    value: any;
  };
}

export interface AsyncIteratorReturn {
  type: 'async-iterator-return';
  payload: {
    iteratorId: string;
    value?: any;
  };
}

export interface AsyncIteratorThrow {
  type: 'async-iterator-throw';
  payload: {
    iteratorId: string;
    reason: string;
  };
}

export interface AsyncIteratorResult {
  type: 'async-iterator-result';
  payload: {
    iteratorId: string;
    value: any;
    done: boolean;
  };
}

export interface AsyncIteratorError {
  type: 'async-iterator-error';
  payload: {
    iteratorId: string;
    error: string;
  };
}

export function asyncIterationServicePlugin() {
  const iterators = new Map<string, AsyncIterator<any>>();

  return (
    message:
      | AsyncIteratorRequest
      | AsyncIteratorNext
      | AsyncIteratorThrow
      | AsyncIteratorReturn,
    connection: ServiceConnection,
    serviceDefinition: ServiceDefinition
  ) => {
    switch (message.type) {
      case 'async-iterator-request': {
        const { iteratorId, method, params } = message.payload;
        const fn = serviceDefinition[method];

        if (typeof fn !== 'function') {
          connection.send({
            type: 'unknown-method-error',
            payload: {
              method,
            },
          });
          return true;
        }

        const iterator = fn(...params);
        iterators.set(iteratorId, iterator);
        return true;
      }
      case 'async-iterator-next': {
        const { iteratorId, value } = message.payload;
        const iterator = iterators.get(iteratorId);

        if (!iterator) {
          throw new Error('Iterator not found for id: ' + iteratorId);
        }

        iterator.next(value).then(
          ({ value, done }) => {
            if (done) {
              iterators.delete(iteratorId);
            }
            connection.send({
              type: 'async-iterator-result',
              payload: {
                iteratorId,
                value,
                done,
              },
            });
          },
          (error) => {
            iterators.delete(iteratorId);
            connection.send({
              type: 'async-iterator-error',
              payload: {
                iteratorId,
                error: error instanceof Error ? error.message : error,
              },
            });
          }
        );
        return true;
      }
      case 'async-iterator-throw': {
        const { iteratorId, reason } = message.payload;
        const iterator = iterators.get(iteratorId);

        if (!iterator) {
          throw new Error('Iterator not found for id: ' + iteratorId);
        }

        iterators.delete(iteratorId);

        if (typeof iterator.throw !== 'function') {
          throw new Error('Iterator does not support throw');
        }

        iterator.throw(new Error(reason)).then(({ value, done }) => {
          connection.send({
            type: 'async-iterator-result',
            payload: {
              iteratorId,
              value,
              done,
            },
          });
        });

        return true;
      }
      case 'async-iterator-return': {
        const { iteratorId, value } = message.payload;

        const iterator = iterators.get(iteratorId);

        if (!iterator) {
          throw new Error('Iterator not found for id: ' + iteratorId);
        }

        iterators.delete(iteratorId);

        if (typeof iterator.return !== 'function') {
          throw new Error('Iterator does not support return');
        }

        iterator.return(value).then(({ value, done }) => {
          connection.send({
            type: 'async-iterator-result',
            payload: {
              iteratorId,
              value,
              done,
            },
          });
        });

        return true;
      }
    }

    return false;
  };
}

export function asyncIterationClientPlugin(
  method: string,
  connection: ServiceConnection
) {
  if (!method.startsWith('iterate')) {
    return;
  }

  const deferreds: Deferred<IteratorResult<any>>[] = [];

  return (...params: any[]) => {
    const iteratorId = crypto.randomUUID();

    const dispose = connection.onMessage(
      (message: AsyncIteratorResult | AsyncIteratorError) => {
        if (message.type === 'async-iterator-result') {
          if (message.payload.iteratorId === iteratorId) {
            const { value, done } = message.payload;

            if (done) {
              dispose();
              for (const deferred of deferreds) {
                deferred.resolve({
                  value,
                  done,
                });
              }
              deferreds.length = 0;
              return;
            }

            const deferred = deferreds.shift();

            if (!deferred) {
              throw new Error('Unexpected iterator result');
            }

            deferred.resolve({
              value,
              done,
            });
          }
        } else if (message.type === 'async-iterator-error') {
          if (message.payload.iteratorId === iteratorId) {
            for (const deferred of deferreds) {
              deferred.reject(new Error(message.payload.error));
            }
            deferreds.length = 0;
          }
        }
      }
    );

    connection.send({
      type: 'async-iterator-request',
      payload: {
        iteratorId,
        method,
        params,
      },
    });

    return {
      [Symbol.asyncIterator]() {
        return this;
      },

      next(value: any) {
        const deferred = new Deferred<IteratorResult<any>>();
        deferreds.push(deferred);

        connection.send({
          type: 'async-iterator-next',
          payload: {
            iteratorId,
            value,
          },
        });

        return deferred.promise;
      },

      throw(reason: any) {
        const deferred = new Deferred<IteratorResult<any>>();
        deferreds.push(deferred);

        connection.send({
          type: 'async-iterator-throw',
          payload: {
            iteratorId,
            reason: reason instanceof Error ? reason.message : reason,
          },
        });

        return deferred.promise;
      },

      return(value: any) {
        const deferred = new Deferred<IteratorResult<any>>();
        deferreds.push(deferred);

        connection.send({
          type: 'async-iterator-return',
          payload: {
            iteratorId,
            value,
          },
        });

        return deferred.promise;
      },
    };
  };
}

class Deferred<T> {
  promise: Promise<T>;
  resolve!: (value: T) => void;
  reject!: (reason: any) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
