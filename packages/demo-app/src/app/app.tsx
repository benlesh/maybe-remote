// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FormEvent, useState } from 'react';
import type * as DemoService from './demo-service';
import DemoWorker from './demo-worker?worker';
import styles from './app.module.css';
import { createPostMessageClient } from '@maybe-remote/core';

const worker = new DemoWorker();

const client = createPostMessageClient<typeof DemoService>({ target: worker });

export function App() {
  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState('');
  const [values, setValues] = useState('');
  const [sums, setSums] = useState<number[]>([]);

  const greetName = async (e: FormEvent) => {
    e.preventDefault();

    const greeting = await client.getGreeting(name);

    setGreeting(greeting);
  };

  const sumValues = async (e: FormEvent) => {
    e.preventDefault();

    const valuesToSum = values.split('+').map((v) => parseInt(v.trim()));

    setSums([]);

    for await (const sum of client.iterateProgressiveSums(...valuesToSum)) {
      setSums((prev) => [...prev, sum]);
    }
  };

  return (
    <div>
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
        <button type="submit">Sum</button>
      </form>
      <p data-testid="sums">
        {sums.map((sum, i) => (
          <span key={i}>{sum} </span>
        ))}
      </p>
    </div>
  );
}

export default App;
