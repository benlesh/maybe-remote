import { ServiceConnection, ServiceDefinition } from './types';

export interface PromiseRequest {
  type: 'promise-request';
  payload: {
    promiseId: string;
    method: string;
    params: any[];
  };
}

export interface PromiseResolved {
  type: 'promise-resolved';
  payload: {
    promiseId: string;
    value: any;
  };
}

export interface PromiseRejected {
  type: 'promise-rejected';
  payload: {
    promiseId: string;
    reason: string;
  };
}

export function promiseServicePlugin(
  message: PromiseRequest,
  connection: ServiceConnection,
  serviceDefintion: ServiceDefinition
) {
  if (message.type === 'promise-request') {
    const { promiseId, method, params } = message.payload;
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

    Promise.resolve(fn(...params)).then(
      (value) => {
        connection.send({
          type: 'promise-resolved',
          payload: {
            promiseId,
            value,
          },
        });
      },
      (reason) => {
        connection.send({
          type: 'promise-rejected',
          payload: {
            promiseId,
            reason: reason instanceof Error ? reason.message : reason,
          },
        });
      }
    );

    return true;
  }

  return false;
}

export function promiseClientPlugin(
  method: string,
  connection: ServiceConnection
) {
  if (method.startsWith('get')) {
    return (...params: any[]) =>
      new Promise((resolve, reject) => {
        const dispose = connection.onMessage(
          (message: PromiseResolved | PromiseRejected) => {
            if (message.type === 'promise-resolved') {
              if (message.payload.promiseId === promiseId) {
                resolve(message.payload.value);
                dispose();
              }
            } else if (message.type === 'promise-rejected') {
              if (message.payload.promiseId === promiseId) {
                reject(new Error(message.payload.reason));
                dispose();
              }
            }
          }
        );

        const promiseId = crypto.randomUUID();

        connection.send({
          type: 'promise-request',
          payload: {
            promiseId,
            method,
            params,
          },
        });
      });
  }

  return;
}
