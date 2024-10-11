// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FormEvent, useEffect, useRef, useState } from 'react';
import type * as DemoService from './demo-service';
import DemoWorker from './demo-worker?worker';

import { createPostMessageClient } from '@maybe-remote/core';
import { rxjsClientPlugin } from '@maybe-remote/rxjs';
import { Subscription } from 'rxjs';

const worker = new DemoWorker();

const client = createPostMessageClient<typeof DemoService>({
  target: worker,
  plugins: [rxjsClientPlugin()],
});

export function App() {
  return (
    <div>
      <TestPromises />

      <TestAsyncIterable />

      <TestRxJSObservables />
    </div>
  );
}

export default App;

export function TestPromises() {
  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState('');

  const greetName = async (e: FormEvent) => {
    e.preventDefault();

    const greeting = await client.getGreeting(name);

    setGreeting(greeting);
  };

  return (
    <div data-testid="promise-test">
      <form onSubmit={greetName}>
        <label htmlFor="name">Name</label>
        <input
          type="text"
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit">Greet</button>
      </form>
      <p data-testid="greeting">{greeting}</p>
    </div>
  );
}

export function TestAsyncIterable() {
  const [values, setValues] = useState('');
  const [sums, setSums] = useState<number[]>([]);

  const sumValues = async (e: FormEvent) => {
    e.preventDefault();

    const valuesToSum = values.split('+').map((v) => parseInt(v.trim()));

    setSums([]);

    for await (const sum of client.iterateProgressiveSums(...valuesToSum)) {
      setSums((prev) => [...prev, sum]);
    }
  };

  return (
    <div data-testid="iterable-test">
      <form onSubmit={sumValues}>
        <label htmlFor="values">Values</label>
        <input
          type="text"
          placeholder="1 + 2 + 3"
          id="values"
          name="values"
          value={values}
          onChange={(e) => setValues(e.target.value)}
        />
        <button type="submit">Sum Via Iterable</button>
      </form>
      <p data-testid="iterable-sums">
        {sums.map((sum, i) => (
          <span key={i}>{sum} </span>
        ))}
      </p>
    </div>
  );
}

export function TestRxJSObservables() {
  const [values, setValues] = useState('');
  const [sums, setSums] = useState<number[]>([]);
  const subscriptionRef = useRef<Subscription | null>(null);

  useEffect(() => {
    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, []);

  const sumValues = (e: FormEvent) => {
    e.preventDefault();

    const valuesToSum = values.split('+').map((v) => parseInt(v.trim()));

    const sums$ = client.whenSummedValuesArePushed(...valuesToSum);

    subscriptionRef.current?.unsubscribe();
    setSums([]);

    subscriptionRef.current = sums$.subscribe((sum) => {
      setSums((prev) => [...prev, sum]);
    });
  };

  return (
    <div data-testId="rxjs-test">
      <form onSubmit={sumValues}>
        <label htmlFor="rxjs-values">Values</label>
        <input
          type="text"
          placeholder="1 + 2 + 3"
          id="rxjs-values"
          name="values"
          value={values}
          onChange={(e) => setValues(e.target.value)}
        />
        <button type="submit">Sum Via Observable</button>
      </form>
      <p data-testid="observable-sums">
        {sums.map((sum, i) => (
          <span key={i}>{sum} </span>
        ))}
      </p>
    </div>
  );
}
