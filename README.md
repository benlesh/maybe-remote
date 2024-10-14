# Maybe-Remote

Utility libraries for simplified and type-safe communication with Workers, SharedWorkers and more.

## Installation

```sh
npm i -S @maybe-remote/core
```

## @maybe-remote/core

By default, maybe-remote will handle both async functions (functions that return a `Promise` or `PromiseLike`) and async generators (or any function that returns an `AsyncIterable`). If you'd like to handle [RxJS](https://rxjs.dev) `Observable` as well, have a look at [`@maybe-remote/rxjs`](#maybe-remote-rxjs)

Basic usage:

**Step 1**: Create your service definition. Basically create any object with some methods on it, or IMO, it's nicer to create a single module file that exports your methods. There are some rules to this:

1. Service functions/methods that return a `Promise` or `PromiseLike` must have a name starting with `get`
2. Service functions/methods that return an `AsyncIterable` must have a name starting with `iterate`.

This is because the `Proxy` that we're using to create the client and forward messages only really has the name of the method to go off of to decide what to return.

```ts
// my-service.ts

export async function getGreeting(name: string, delay = 1000) {
  // add a little delay for some wow factor!! Ooo! Aaaah!!
  await new Promise((resolve) => setTimeout(resolve, delay));
  return `Hello, ${name}!`;
}

export async function* iterateDelayedValues(
  ...delayedValues: { delay: number; value: string }[]
) {
  for (const { delay, value } of delayedValues) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    yield value;
  }
}
```

**Step 2**: Create your service... in this case we'll use a worker. You just need to supply the postMessage target (the thing with `postMessage`, `addEventListener`, and `removeEventListener` on it, like `window`, `globalThis`, `self`, `BroadcastChannel` instance, et al) and the service definition, this is the object with all of your service methods on it from step 1 above.

```ts
// my-worker.ts
import { createPostMessageService } from '@maybe-remote/core';
import * as ServiceDefinition from './my-service.ts';

createPostMessageService({
  target: globalThis,
  def: ServiceDefinition,
});
```

**Step 3**: Start your worker and create your client! With this you'll need to get the _type information_ for your service definition, **but ONLY the type information**.

```ts
// client.ts
import { createPostMessageClient } from '@maybe-remote/core';
import type * as ServiceDefinition from './my-service.ts';

const worker = new Worker('./dist/my-worker.js');

const client = createPostMessageClient<ServiceDefinition>({
  target: worker,
});

async function main() {
  const greeting = await client.getGreeting('World');
  console.log(greeting); // "Hello, World!"

  const delayedValues = [
    { delay: 100, value: 'One' },
    { delay: 1000, value: 'Two' },
    { delay: 10, value: 'Three' },
  ];

  for await (const value of client.iterateDelayedValues(delayedValues)) {
    console.log(value); // Logs the values with delays!
  }
}
```

## @maybe-remote/rxjs

This package is a plugin to provide support for service methods returning RxJS-style observables across thread boundaries.

Assuming you're already using `@maybe-remote/core` as shown above, adding RxJS observables is as follows:

**Step 1**: Install the plugin package and rxjs

```sh
npm i -S @maybe-remote/rxjs rxjs
```

**Step 2**: Write a function that returns an RxJS observable. The method should be prefixed with `when`. For example `whenDataArrives` or the like.

```ts
// my-service.ts
import { interval } from 'rxjs';

export function whenIntervalFires(delay: number) {
  return interval(delay);
}
```

**Step 3**: Add the plugin to the service

```ts
// my-worker.ts
import { createPostMessageService } from '@maybe-remote/core';
import * as ServiceDefinition from './my-service.ts';
import { rxjsServicePlugin } from '@maybe-remote/rxjs';

createPostMessageService({
  target: globalThis,
  def: ServiceDefinition,
  servicePlugins: [rxjsServicePlugin()],
});
```

**Step 4**: Add the plugin to the client

```ts
// client.ts
import { createPostMessageClient } from '@maybe-remote/core';
import type * as ServiceDefinition from './my-service.ts';
import { rxjsClientPlugin } from '@maybe-remote/rxjs';
import { take } from 'rxjs';

const worker = new Worker('./dist/my-worker.js');

const client = createPostMessageClient<ServiceDefinition>({
  target: worker,
  plugins: [rxjsClientPlugin()],
});

// Logs a number once a second for 5 numbers
client.whenInterval(1000).pipe(take(5)).subscribe(console.log);
```
