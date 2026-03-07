import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile, changePassword, deleteAccount } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Switch } from '../components/ui/Switch';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert';
import { AlertCircle, User, Lock, Bell, Trash2, Mail, Check, X } from 'lucide-react';

export default function Settings() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    notifications: {
      email: true,
      push: false,
      weeklyDigest: true,
    },
    preferences: {
      localFirst: false,
      encryptionEnabled: false,
    },
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ type: '', content: '' });
  
  // Fetch user profile data
  const { data: profile, isLoading } = useQuery('profile', getProfile, {
    enabled: !!user,
    onSuccess: (data) => {
      if (data) {
        setFormData(prev => ({
          ...prev,
          name: data.name || '',
          email: data.email || '',
          notifications: data.notifications || {
            email: true,
            push: false,
            weeklyDigest: true,
          },
          preferences: {
            localFirst: data.preferences?.localFirst || false,
            encryptionEnabled: data.preferences?.encryptionEnabled || false,
          },
        }));
      }
    },
  });
  
  // Update profile mutation
  const updateProfileMutation = useMutation(updateProfile, {
    onSuccess: () => {
      queryClient.invalidateQueries('profile');
      setMessage({ type: 'success', content: 'Profile updated successfully' });
      setTimeout(() => setMessage({ type: '', content: '' }), 5000);
    },
    onError: (error) => {
      setMessage({ 
        type: 'error', 
        content: error.response?.data?.message || 'Failed to update profile' 
      });
    },
  });
  
  // Change password mutation
  const changePasswordMutation = useMutation(changePassword, {
    onSuccess: () => {
      setMessage({ type: 'success', content: 'Password changed successfully' });
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      setTimeout(() => setMessage({ type: '', content: '' }), 5000);
    },
    onError: (error) => {
      setMessage({ 
        type: 'error', 
        content: error.response?.data?.message || 'Failed to change password' 
      });
    },
  });
  
  // Delete account mutation
  const deleteAccountMutation = useMutation(deleteAccount, {
    onSuccess: () => {
      logout();
    },
    onError: (error) => {
      setMessage({ 
        type: 'error', 
        content: error.response?.data?.message || 'Failed to delete account' 
      });
    },
  });
  
  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          [name]: checked,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };
  
  // Handle profile form submission
  const handleProfileSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    updateProfileMutation.mutate({
      name: formData.name,
      email: formData.email,
      notifications: formData.notifications,
      preferences: formData.preferences,
    });
  };
  
  // Handle password change submission
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    
    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    
    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    changePasswordMutation.mutate({
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword,
    });
  };
  
  // Handle account deletion
  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.')) {
      deleteAccountMutation.mutate();
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings, privacy, and data rights.
        </p>
        <div className="mt-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900 border border-yellow-300 text-yellow-900 dark:text-yellow-100 text-sm">
          <strong>GDPR:</strong> You may export or delete your data at any time. All uploads and fragments are under your control. For details, see our <a href="/privacy" className="underline text-blue-700 dark:text-blue-300">Privacy Policy</a>.
        </div>
      </div>
      
      {message.content && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          <AlertTitle>{message.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
          <AlertDescription>
            {message.content}
          </AlertDescription>
        </Alert>
      )}
      
      <Tabs 
        defaultValue="profile" 
        className="space-y-4"
        onValueChange={setActiveTab}
      >
  <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="password">
            <Lock className="h-4 w-4 mr-2" />
            Password
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="danger" className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Danger Zone
          </TabsTrigger>
        </TabsList>
        
  {/* Profile Tab */}
  <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your account's profile information and email address.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleProfileSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter your name"
                    isInvalid={!!errors.name}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Enter your email"
                      className="pl-10"
                      isInvalid={!!errors.email}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                
                <div className="pt-2">
                <div className="space-y-2 pt-4">
                  <Label htmlFor="localFirst">Local-First Mode</Label>
                  <Switch
                    id="localFirst"
                    checked={formData.preferences.localFirst}
                    onCheckedChange={checked => setFormData(prev => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        localFirst: checked,
                      },
                    }))}
                  />
                  <span className="text-xs text-muted-foreground">Keep data local as much as possible for privacy.</span>
                </div>
                <div className="space-y-2 pt-2">
                  <Label htmlFor="encryptionEnabled">Enable Encryption</Label>
                  <Switch
                    id="encryptionEnabled"
                    checked={formData.preferences.encryptionEnabled}
                    onCheckedChange={checked => setFormData(prev => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        encryptionEnabled: checked,
                      },
                    }))}
                  />
                  <span className="text-xs text-muted-foreground">Encrypt your data with a key only you control.</span>
                </div>
                  <p className="text-sm text-muted-foreground">
                    Member since {new Date(profile?.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button 
                  type="submit" 
                  disabled={updateProfileMutation.isLoading}
                >
                  {updateProfileMutation.isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
        
        {/* Password Tab */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Ensure your account is using a long, random password to stay secure.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handlePasswordSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    value={formData.currentPassword}
                    onChange={handleInputChange}
                    placeholder="Enter your current password"
                    isInvalid={!!errors.currentPassword}
                  />
                  {errors.currentPassword && (
                    <p className="text-sm text-destructive">{errors.currentPassword}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    placeholder="Enter your new password"
                    isInvalid={!!errors.newPassword}
                  />
                  {errors.newPassword ? (
                    <p className="text-sm text-destructive">{errors.newPassword}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Use at least 8 characters, one uppercase, one lowercase, and one number.
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm your new password"
                    isInvalid={!!errors.confirmPassword}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button 
                  type="submit" 
                  disabled={changePasswordMutation.isLoading}
                >
                  {changePasswordMutation.isLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
        
        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how you receive notifications.
              </CardDescription>
            </CardHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              updateProfileMutation.mutate({
                notifications: formData.notifications,
              });
            }}>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email notifications about your account activity.
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    name="email"
                    checked={formData.notifications.email}
                    onCheckedChange={(checked) => 
                      handleInputChange({
                        target: {
                          name: 'email',
                          type: 'checkbox',
                          checked,
                        },
                      })
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-notifications">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive push notifications on your device.
                    </p>
                  </div>
                  <Switch
                    id="push-notifications"
                    name="push"
                    checked={formData.notifications.push}
                    onCheckedChange={(checked) => 
                      handleInputChange({
                        target: {
                          name: 'push',
                          type: 'checkbox',
                          checked,
                        },
                      })
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="weekly-digest">Weekly Digest</Label>
                    <p className="text-sm text-muted-foreground">
                      Get a weekly summary of your activity and updates.
                    </p>
                  </div>
                  <Switch
                    id="weekly-digest"
                    name="weeklyDigest"
                    checked={formData.notifications.weeklyDigest}
                    onCheckedChange={(checked) => 
                      handleInputChange({
                        target: {
                          name: 'weeklyDigest',
                          type: 'checkbox',
                          checked,
                        },
                      })
                    }
                  />
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button 
                  type="submit" 
                  disabled={updateProfileMutation.isLoading}
                >
                  {updateProfileMutation.isLoading ? 'Saving...' : 'Save Preferences'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
        
        {/* Danger Zone Tab */}
        <TabsContent value="danger">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                These actions are irreversible. Please be certain.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-destructive p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-medium text-destructive">Delete Account</h4>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all of your data.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleteAccountMutation.isLoading}
                  >
                    {deleteAccountMutation.isLoading ? 'Deleting...' : 'Delete Account'}
                  </Button>
                </div>
                
                {deleteAccountMutation.isError && (
                  <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                    {deleteAccountMutation.error?.message || 'Failed to delete account. Please try again.'}
                  </div>
                )}
              </div>
              
              <div className="rounded-lg border border-destructive/50 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-medium">Export Data</h4>
                    <p className="text-sm text-muted-foreground">
                      Download all your data in a portable format.
                    </p>
                  </div>
                  <Button variant="outline" className="border-destructive/50 text-destructive">
                    Export Data
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
