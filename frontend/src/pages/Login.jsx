import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AlertWithIcon } from '../components/ui/Alert';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, BrainCircuit, CircuitBoard, Fingerprint, Key, Mail, Network, User } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    setLoaded(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData.name, formData.email, formData.password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const backgroundPatterns = (
    <>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/3 top-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute right-1/3 bottom-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute left-1/2 top-1/2 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-100/50 dark:from-gray-900/50 dark:to-gray-800/50 backdrop-blur-sm"></div>
    </>
  );

  const features = [
    { icon: <BrainCircuit className="w-6 h-6" />, text: "AI-Powered Search" },
    { icon: <Network className="w-6 h-6" />, text: "Knowledge Graph" },
    { icon: <CircuitBoard className="w-6 h-6" />, text: "Smart Links" }
  ];

  const renderFeatures = () => (
    <div className="space-y-6">
      {features.map((feature, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
          className="flex items-center gap-4 text-gray-700 dark:text-gray-300"
        >
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
            {feature.icon}
          </div>
          <span>{feature.text}</span>
        </motion.div>
      ))}
    </div>
  );

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      <AnimatePresence mode="wait">
        {!isLogin && (
          <motion.div
            key="name"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                required
                className="pl-10"
                placeholder="Enter your name"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Email
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail className="h-5 w-5 text-gray-400" />
          </div>
          <Input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="pl-10"
            placeholder="Enter your email"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Key className="h-5 w-5 text-gray-400" />
          </div>
          <Input
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="pl-10"
            placeholder="Enter your password"
            minLength={8}
          />
        </div>
      </div>

      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <Button
          type="submit"
          className="w-full flex items-center justify-center gap-2"
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Please wait...
            </>
          ) : (
            <>
              <Fingerprint className="w-5 h-5" />
              {isLogin ? 'Sign In' : 'Sign Up'}
            </>
          )}
        </Button>
      </motion.div>

      <div className="text-center">
        <motion.button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setError('');
          }}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isLogin
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </motion.button>
      </div>
    </form>
  );

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {backgroundPatterns}
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative w-full max-w-5xl px-4 flex gap-8"
      >
        {/* Left Side - Welcome Message & Features */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex-1 hidden lg:flex flex-col justify-center space-y-8"
        >
          <div className="space-y-4">
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3"
            >
              <Brain className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
              <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
                EchoLink
              </h1>
            </motion.div>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Transform your knowledge into an interactive memory network
            </p>
          </div>

          {renderFeatures()}
        </motion.div>

        {/* Right Side - Auth Form */}
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg p-8 rounded-2xl shadow-2xl space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                {isLogin ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {isLogin ? 'Sign in to continue' : 'Join the knowledge network'}
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <AlertWithIcon variant="destructive">
                  {error}
                </AlertWithIcon>
              </motion.div>
            )}

            {renderForm()}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}