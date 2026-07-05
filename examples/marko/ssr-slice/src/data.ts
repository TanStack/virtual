export interface Person {
  id: number
  name: string
  email: string
  role: string
}

// Simulates a server-side data source (a database or upstream API) with a little latency.
// This runs only on the server during SSR. The resolved rows are serialized into the page
// and resume on the client — there is no client-side re-fetch.
export async function fetchPeople(): Promise<Person[]> {
  console.log("fetchPeople ran")
  await new Promise((resolve) => setTimeout(resolve, 40))
  const roles = ["Engineer", "Designer", "PM", "Analyst", "Support"]
  return Array.from({ length: 1000 }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    email: `person${i + 1}@example.com`,
    role: roles[i % roles.length],
  }))
}
