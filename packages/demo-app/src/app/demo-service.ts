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
