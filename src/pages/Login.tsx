import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Brain, Zap, Target, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const { user, signIn, signUp, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'hr_manager' | 'candidate' | 'super_admin'>('hr_manager');

  // Redirect authenticated users to main page
  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsSubmitting(true);
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully."
      });
    }
    setIsSubmitting(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsSubmitting(true);
    const { error } = await signUp(email, password, role);
    
    if (error) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Account Created!",
        description: "Please check your email to verify your account."
      });
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header with XLSMART Branding */}
      <header className="xlsmart-gradient-bg text-white">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
              <img 
                src="/xlsmart-logo.svg" 
                alt="XLSMART Logo" 
                className="h-16 w-auto"
              />
              <p className="text-white/90 text-lg font-medium text-center">AI-Powered HR Platform by SimplifyAI</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Features showcase */}
            <div className="space-y-8">
              <div>
                <h1 className="text-4xl font-bold text-foreground mb-4">
                  Welcome to the Future of HR
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Transform your human resources with AI-powered role standardization, 
                  skills assessment, and career development planning.
                </p>
              </div>

              <div className="grid gap-6">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">AI-Powered Analysis</h3>
                    <p className="text-muted-foreground">
                      Intelligent role standardization and skill mapping powered by advanced AI
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-accent/10 rounded-xl">
                    <Target className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Precision Matching</h3>
                    <p className="text-muted-foreground">
                      Accurate role alignment and career path recommendations
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Lightning Fast</h3>
                    <p className="text-muted-foreground">
                      Process thousands of roles and skills in seconds
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-accent/10 rounded-xl">
                    <Users className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Enterprise Ready</h3>
                    <p className="text-muted-foreground">
                      Built for telecommunications industry standards and scale
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side - Login form */}
            <div className="flex justify-center">
              <Card className="w-full max-w-md shadow-xl border-0 bg-card/50 backdrop-blur-sm">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-2xl font-bold">Access Your Account</CardTitle>
                  <CardDescription>
                    Sign in to continue to SimplifyAI Platform
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="signin" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="signin">Sign In</TabsTrigger>
                      <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="signin" className="space-y-4">
                      <form onSubmit={handleSignIn} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signin-email">Email</Label>
                          <Input
                            id="signin-email"
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signin-password">Password</Label>
                          <Input
                            id="signin-password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="h-11"
                          />
                        </div>
                        <Button 
                          type="submit" 
                          className="w-full h-11 xlsmart-primary-gradient text-white font-medium" 
                          disabled={isSubmitting}
                        >
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Sign In to Platform
                        </Button>
                      </form>
                    </TabsContent>
                    
                    <TabsContent value="signup" className="space-y-4">
                      <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signup-email">Email</Label>
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-password">Password</Label>
                          <Input
                            id="signup-password"
                            type="password"
                            placeholder="Create a password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-role">Role</Label>
                          <Select value={role} onValueChange={(value: 'hr_manager' | 'candidate' | 'super_admin') => setRole(value)}>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select your role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hr_manager">HR Manager</SelectItem>
                              <SelectItem value="candidate">Candidate</SelectItem>
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button 
                          type="submit" 
                          className="w-full h-11 xlsmart-primary-gradient text-white font-medium" 
                          disabled={isSubmitting}
                        >
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Create Account
                        </Button>
                        
                        {/* Quick test login button */}
                        <Button 
                          type="button"
                          variant="outline"
                          className="w-full h-11 mt-2" 
                          onClick={() => {
                            setEmail('test@xlsmart.com');
                            setPassword('test123456');
                          }}
                        >
                          Fill Test Credentials
                        </Button>
                      </form>
                      
                      <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm text-green-700 text-center mb-2">
                          <strong>Testing the Complete Platform:</strong>
                        </p>
                        <ol className="text-xs text-green-600 text-left space-y-1">
                          <li>1. Click "Fill Test Credentials" above</li>
                          <li>2. Click "Create Account" (or "Sign In" if account exists)</li>
                          <li>3. Navigate to "Job Descriptions" in the sidebar</li>
                          <li>4. Test the "Intelligence" tab for JD analysis</li>
                          <li>5. Test the "AI Tester" tab for role assignments</li>
                        </ol>
                        <p className="text-xs text-green-600 text-center mt-2">
                          ✅ Database: 34 job descriptions | ✅ AI: OpenAI API configured | ✅ Functions: All operational
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center text-muted-foreground">
            <p>&copy; 2024 XLSMART. Powered by SimplifyAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Login;