// auth.js



export class AuthService {
  constructor() {
    this.supabase = null;
    this.initializeSupabase();
  }

  initializeSupabase() {
    const supabaseUrl = 'https://gaywttdsmwuibgeymqct.supabase.co';
    const supabaseKey = 'sb_publishable_8k2CyqOX8gnOUDze7bW2pQ_n1e6KaZf';
    
    console.log('Initializing Supabase with URL:', supabaseUrl);
    
    try {
      this.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
      console.log('Supabase initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
    }
  }

  async getCurrentUser() {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        return null;
      }
      
      console.log('Session data:', session);
      return session?.user || null;
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
      return null;
    }
  }

  async signIn(email, password) {
    try {
      console.log('Signing in user:', email);
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
      }

      console.log('Sign in successful:', data.user.email);
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Unexpected sign in error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  async signUp(name, email, password) {
    try {
      console.log('Signing up user:', email);
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
          },
          // No email confirmation - auto confirm
          emailConfirm: false
        }
      });

      if (error) {
        console.error('Sign up error:', error);
        return { success: false, error: error.message };
      }

      console.log('Sign up successful - User:', data.user);
      console.log('Sign up successful - Session:', data.session);
      
      // With email confirmation disabled, user should be automatically signed in
      return { 
        success: true, 
        user: data.user,
        session: data.session 
      };
    } catch (error) {
      console.error('Unexpected sign up error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  async signOut() {
    try {
      console.log('Signing out user...');
      const { error } = await this.supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      } else {
        console.log('Sign out successful');
      }
    } catch (error) {
      console.error('Error in signOut:', error);
    }
  }

  // Listen for auth state changes
  onAuthStateChange(callback) {
    return this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session);
      callback(event, session);
    });
  }
}

// Test function to verify Supabase connection
async function testSupabaseConnection() {
  try {
    const auth = new AuthService();
    const user = await auth.getCurrentUser();
    console.log('Supabase connection test:', user ? 'Connected with user' : 'Connected, no user');
    return true;
  } catch (error) {
    console.error('Supabase connection failed:', error);
    return false;
  }
}

// Run test when auth.js loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('auth.js loaded, testing Supabase connection...');
  testSupabaseConnection();
});