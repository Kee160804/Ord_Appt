declare module "@supabase/supabase-js" {
  export interface SupabaseClient {
    auth: {
      signInWithPassword: (credentials: { email: string; password: string }) => Promise<{
        data: { user: unknown } | null;
        error: { message?: string } | null;
      }>;
      signUp: (credentials: { email: string; password: string }) => Promise<{
        data: { user: unknown } | null;
        error: { message?: string } | null;
      }>;
    };
    from: <T = unknown>(table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: unknown) => {
          single: () => Promise<{
            data: T | null;
            error: { message?: string } | null;
          }>;
        };
      };
      insert: (rows: T[]) => Promise<{
        data: T[] | null;
        error: { message?: string } | null;
      }>;
    };
    rpc?: (fn: string, params?: unknown) => Promise<{
      data: unknown;
      error: { message?: string } | null;
    }>;
  }

  export function createClient(url: string, key: string, options?: Record<string, unknown>): SupabaseClient;
}
