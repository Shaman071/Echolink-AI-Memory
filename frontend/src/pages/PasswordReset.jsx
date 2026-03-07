import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AlertWithIcon } from '../components/ui/Alert';
import { requestPasswordReset, resetPassword } from '../services/api';

export default function PasswordReset() {
  const [step, setStep] = useState(0); // 0: request, 1: reset
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await requestPasswordReset(email);
      setSuccess('Reset token sent to your email (demo: token shown below)');
      setToken(res.data.token || '');
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset token');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setSuccess('Password reset successful. You may now log in.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-4">Reset Password</h2>
        {error && <AlertWithIcon variant="destructive">{error}</AlertWithIcon>}
        {success && <AlertWithIcon variant="success">{success}</AlertWithIcon>}
        {step === 0 ? (
          <form onSubmit={handleRequest} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Enter your email" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Please wait...' : 'Send Reset Token'}</Button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reset Token</label>
              <Input type="text" value={token} onChange={e => setToken(e.target.value)} required placeholder="Paste token from email" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} placeholder="Enter new password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Please wait...' : 'Reset Password'}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
