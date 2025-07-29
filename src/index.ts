export interface Env {
  FIREBASE_URL: string;
  FIREBASE_SECRET: string;
}

interface User {
  email: string;
  password: string;
}

interface SignupRequest {
  email: string;
  password: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

class AuthWorker {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  private async makeFirebaseRequest(path: string, method: string = 'GET', data?: any): Promise<any> {
    const url = `${this.env.FIREBASE_URL}${path}.json?auth=${this.env.FIREBASE_SECRET}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`Firebase request failed: ${response.status}`);
    }

    return await response.json();
  }

  private async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.makeFirebaseRequest(`/users/${this.emailToKey(email)}`);
      return user;
    } catch (error) {
      return null;
    }
  }

  private emailToKey(email: string): string {
    // تحويل البريد الإلكتروني إلى مفتاح صالح لـ Firebase
    return email.replace(/[.#$\[\]]/g, '_');
  }

  private async createUser(email: string, password: string): Promise<void> {
    const userData: User = { email, password };
    await this.makeFirebaseRequest(`/users/${this.emailToKey(email)}`, 'PUT', userData);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private createResponse(message: string, status: number): Response {
    return new Response(JSON.stringify({ message }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  async handleSignup(request: Request): Promise<Response> {
    try {
      const body: SignupRequest = await request.json();
      
      // التحقق من وجود البيانات المطلوبة
      if (!body.email || !body.password) {
        return this.createResponse('Email and password are required', 400);
      }

      // التحقق من صحة البريد الإلكتروني
      if (!this.isValidEmail(body.email)) {
        return this.createResponse('Invalid email format', 400);
      }

      // التحقق من طول كلمة المرور
      if (body.password.length < 6) {
        return this.createResponse('Password must be at least 6 characters', 400);
      }

      // التحقق من وجود المستخدم
      const existingUser = await this.getUserByEmail(body.email);
      
      if (existingUser) {
        return this.createResponse('User already exists', 400);
      }

      // إنشاء المستخدم الجديد
      await this.createUser(body.email, body.password);
      
      return this.createResponse('User created successfully ✅', 201);
    } catch (error) {
      console.error('Signup error:', error);
      return this.createResponse('Internal server error', 500);
    }
  }

  async handleLogin(request: Request): Promise<Response> {
    try {
      const body: LoginRequest = await request.json();
      
      // التحقق من وجود البيانات المطلوبة
      if (!body.email || !body.password) {
        return this.createResponse('Email and password are required', 400);
      }

      // التحقق من صحة البريد الإلكتروني
      if (!this.isValidEmail(body.email)) {
        return this.createResponse('Invalid email format', 400);
      }

      // البحث عن المستخدم
      const user = await this.getUserByEmail(body.email);
      
      if (!user || user.password !== body.password) {
        return this.createResponse('Invalid credentials', 401);
      }

      return this.createResponse('Login successful 🎉', 200);
    } catch (error) {
      console.error('Login error:', error);
      return this.createResponse('Internal server error', 500);
    }
  }

  async handleOptions(): Promise<Response> {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const authWorker = new AuthWorker(env);
    const url = new URL(request.url);
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return authWorker.handleOptions();
    }

    // Route handling
    if (method === 'POST' && url.pathname === '/signup') {
      return authWorker.handleSignup(request);
    }

    if (method === 'POST' && url.pathname === '/login') {
      return authWorker.handleLogin(request);
    }

    // Default route
    if (method === 'GET' && url.pathname === '/') {
      return new Response(JSON.stringify({
        message: 'Auth API Server is running! 🚀',
        endpoints: [
          'POST /signup - Create new user',
          'POST /login - User login'
        ]
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({ message: 'Route not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};