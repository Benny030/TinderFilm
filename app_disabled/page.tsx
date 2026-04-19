import { createClient } from '@/utils/supabase/server';

type Todo = {
  id: number;
  name: string;
};

export default async function Page() {
  let todos: Todo[] | null = null;
  let errorMessage = '';

  try {
    const supabase = createClient();
    const { data, error } = await supabase.from('todos').select();

    if (error) {
      errorMessage = error.message || 'Errore durante il recupero dei dati.';
    } else {
      todos = (data as Todo[]) || [];
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto.';
  }

  return (
    <main style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Todo List</h1>
      {errorMessage ? (
        <div style={{ color: 'red', marginTop: '16px' }}>{errorMessage}</div>
      ) : (
        <ul>
          {todos?.map((todo) => (
            <li key={todo.id}>{todo.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
