import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, Button, Label, Input } from '../components/UI';
import { GraduationCap, LogIn, Lock } from 'lucide-react';

export function Login() {
  const { login } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(email, password)) {
      setError('Invalid username, email, or password.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/20">
            <GraduationCap className="h-8 w-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">School Management System</h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">Please sign in to access your school portal</p>
        </div>

        <Card className="p-6 shadow-md border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg font-bold">
                {error}
              </div>
            )}
            <div>
              <Label>User ID / Email</Label>
              <Input 
                type="text" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                placeholder="Enter your ID or Email" 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                placeholder="Enter password" 
                className="mt-1" 
              />
            </div>
            <Button type="submit" className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg shadow-sm flex items-center justify-center gap-2">
              <LogIn className="w-4 h-4" />
              Sign In
            </Button>
          </form>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Lock className="w-3.5 h-3.5 text-slate-400" /> Secure Cloud Encrypted Access
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}


