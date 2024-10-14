import {
  asyncIterationServicePlugin,
  asyncIterationClientPlugin,
} from './async-iteration-plugin';
import { promiseClientPlugin, promiseServicePlugin } from './promise-plugin';
import { ClientPlugin, ServicePlugin } from './types';

export const defaultServicePlugins: ServicePlugin[] = [
  promiseServicePlugin,
  asyncIterationServicePlugin,
];

export const defaultClientPlugins: ClientPlugin[] = [
  promiseClientPlugin,
  asyncIterationClientPlugin,
];
