import { from, scan } from 'rxjs';

export async function getGreeting(name: string) {
  return `Hello, ${name}!`;
}

export async function* iterateProgressiveSums(...numbers: number[]) {
  let sum = 0;
  for (const number of numbers) {
    sum += number;
    yield sum;
  }
}

export function streamSummedValues(...numbers: number[]) {
  return from(numbers).pipe(scan((sum, value) => sum + value, 0));
}
