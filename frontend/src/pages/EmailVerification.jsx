import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AlertWithIcon } from '../components/ui/Alert';
import { requestEmailVerification, verifyEmail } from '../services/api';

export default function EmailVerification() {
  const [step, setStep] = useState(0); // 0: request, 1: verify
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await requestEmailVerification(email);
      setSuccess('Verification token sent to your email (demo: token shown below)');
      setToken(res.data.token || '');
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send verification token');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await verifyEmail(token);
      setSuccess('Email verified successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-4">Verify Email</h2>
        {error && <AlertWithIcon variant="destructive">{error}</AlertWithIcon>}
        {success && <AlertWithIcon variant="success">{success}</AlertWithIcon>}
        {step === 0 ? (
          <form onSubmit={handleRequest} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Enter your email" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Please wait...' : 'Send Verification Token'}</Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Verification Token</label>
              <Input type="text" value={token} onChange={e => setToken(e.target.value)} required placeholder="Paste token from email" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Please wait...' : 'Verify Email'}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
