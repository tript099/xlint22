import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  Users, 
  FileText, 
  Brain, 
  TrendingUp, 
  MessageCircle,
  ArrowRight,
  Zap,
  BarChart3,
  Target,
  Smartphone,
  User
} from "lucide-react";
import { AIChat } from "@/components/AIChat";
import { RoleStandardizationSystem } from "@/components/RoleStandardizationSystem";
import { LiteLLMTest } from "@/components/LiteLLMTest";
import { AIJobDescriptionGeneratorOptimized } from "@/components/AIJobDescriptionGeneratorOptimized";
import { AISkillsAssessmentEnhanced } from "@/components/AISkillsAssessmentEnhanced";
import { EmployeeMobilityPlanningEnhanced } from "@/components/EmployeeMobilityPlanningEnhanced";
import { DevelopmentPathwaysEnhanced } from "@/components/DevelopmentPathwaysEnhanced";
import { EmployeeListDetails } from "@/components/EmployeeListDetails";
import { StandardizedRolesDetails } from "@/components/StandardizedRolesDetails";
import { MappingAccuracyDetails } from "@/components/MappingAccuracyDetails";
import { SkillsListDetails } from "@/components/SkillsListDetails";
import { EmployeeUploadTwoStep } from "@/components/EmployeeUploadTwoStep";
import { EmployeeCareerPathsEnhanced } from "@/components/EmployeeCareerPathsEnhanced";
import { EmployeeMobilityPlanningAI } from "@/components/EmployeeMobilityPlanningAI";
import { DevelopmentPathwaysAI } from "@/components/DevelopmentPathwaysAI";
import BulkRoleAssignment from "@/components/BulkRoleAssignment";
import ApplicationTester from "@/components/ApplicationTester";
import { useAIStats } from "@/components/AIStatsProvider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const Index = () => {
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const aiStats = useAIStats();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const features = [
    {
      id: 'upload',
      title: 'Bulk Role Upload & Standardization',
      description: 'Upload role catalogs and auto-map to XLSMART Standard Roles with industry-aligned job families.',
      icon: Upload,
      badge: 'Core',
      dialogContent: 'upload'
    },
    {
      id: 'jd-generator',
      title: 'AI-Powered JD Generator',
      description: 'Generate job descriptions for every standardized role with in-app chatbot to tweak tone and requirements.',
      icon: FileText,
      badge: 'AI',
      dialogContent: null
    },
    {
      id: 'employee-upload',
      title: 'Employee Upload & AI Assignment',
      description: 'Upload 10,000+ employees and automatically assign roles using AI',
      icon: Users,
      badge: 'AI',
      dialogContent: null
    },
    {
      id: 'assessment',
      title: 'Employee Skill Assessment',
      description: 'Upload employees, match % vs target JD, skill gaps, next role recommendations.',
      icon: Brain,
      badge: 'Analytics',
      dialogContent: null
    },
    {
      id: 'chat',
      title: 'HR AI Assistant',
      description: 'In-app chatbot for HR/editors to tweak job descriptions and get personalized recommendations.',
      icon: MessageCircle,
      badge: 'AI',
      dialogContent: 'chat'
    },
    {
      id: 'career-paths',
      title: 'Employee Career Paths',
      description: 'AI-powered career path planning and progression mapping',
      icon: TrendingUp,
      badge: 'AI',
      dialogContent: null
    },
    {
      id: 'mobility',
      title: 'Employee Mobility & Planning',
      description: 'Level fit analysis, rotation/churn risk assessment, and personalized development plans.',
      icon: Target,
      badge: 'Planning',
      dialogContent: null
    },
    {
      id: 'development',
      title: 'Development Pathways',
      description: 'Personalized development plans with courses, certifications, and projects for career growth.',
      icon: Brain,
      badge: 'Growth',
      dialogContent: null
    }
  ];

  const stats = [
    { value: aiStats.loading ? "..." : aiStats.employees, label: 'Total Employees', icon: Users, color: "text-blue-600" },
    { value: aiStats.loading ? "..." : aiStats.roles, label: 'Standardized Roles', icon: Target, color: "text-cyan-600" },
    { value: aiStats.loading ? "..." : aiStats.accuracy, label: 'Mapping Accuracy', icon: Zap, color: "text-blue-600" },
    { value: aiStats.loading ? "..." : aiStats.skills, label: 'Skills Identified', icon: BarChart3, color: "text-cyan-600" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* XLSMART Header with Official Gradient */}
      <header className="xlsmart-gradient-bg text-white">
          <div className="container mx-auto px-6 py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex flex-col items-center space-y-3">
                  <img 
                    src="/xlsmart-logo.svg" 
                    alt="XLSMART Logo" 
                    className="h-16 w-auto"
                  />
                  <p className="text-white/90 text-lg font-medium text-center">AI-Powered HR Platform by SimplifyAI</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-white/90 text-sm">{user?.email}</span>
                </div>
                <Button 
                  onClick={handleSignOut}
                  variant="outline" 
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  Sign Out
                </Button>
              </div>
            </div>
            
            <div className="mt-12 space-y-4">
              <h2 className="text-3xl font-light">
                Revolutionizing HR with <span className="font-bold text-white">Artificial Intelligence</span>
              </h2>
              <p className="text-white/80 text-xl max-w-3xl leading-relaxed">
                Streamline role standardization, skill assessment, and career development with XLSMART's AI-powered platform built for the telecommunications industry.
              </p>
            </div>
          </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12 space-y-12">
        {/* Features Grid */}
          <section>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Platform Features</h2>
              <p className="text-gray-600 text-lg max-w-3xl mx-auto">
                Comprehensive solutions for modernizing HR operations through AI-driven insights
              </p>
            </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={feature.id} className="xlsmart-card group cursor-pointer relative overflow-hidden hover:scale-105">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-accent/10 rounded-bl-3xl"></div>
                
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="p-4 bg-primary/10 rounded-2xl group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="h-7 w-7 text-primary group-hover:text-primary/80" />
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs font-medium border-2 ${
                        feature.badge === 'AI' ? 'border-accent/30 text-accent bg-accent/10' :
                        feature.badge === 'Core' ? 'border-primary/30 text-primary bg-primary/10' :
                        feature.badge === 'Analytics' ? 'border-purple-500/30 text-purple-600 bg-purple-50' :
                        'border-muted-foreground/30 text-muted-foreground bg-muted/10'
                      }`}
                    >
                      {feature.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold text-card-foreground group-hover:text-primary transition-colors duration-300">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                  
                  {feature.dialogContent ? (
                    <Dialog open={activeDialog === feature.id} onOpenChange={(open) => setActiveDialog(open ? feature.id : null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full group-hover:xlsmart-primary-gradient group-hover:text-white group-hover:border-transparent transition-all duration-300 shadow-sm hover:shadow-md">
                          {feature.id === 'upload' ? 'Upload Role Catalog' : 'Open Assistant'}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className={feature.id === 'upload' ? "max-w-5xl max-h-[80vh] overflow-y-auto" : "max-w-4xl max-h-[80vh] overflow-y-auto"}>
                        <DialogTitle className="sr-only">
                          {feature.id === 'upload' ? 'Role Standardization System' : 'AI Chat Assistant'}
                        </DialogTitle>
                        {feature.id === 'upload' ? <RoleStandardizationSystem /> : <AIChat />}
                      </DialogContent>
                    </Dialog>
                   ) : (
                    <Dialog open={activeDialog === feature.id} onOpenChange={(open) => setActiveDialog(open ? feature.id : null)}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full group-hover:xlsmart-primary-gradient group-hover:text-white group-hover:border-transparent transition-all duration-300 shadow-sm hover:shadow-md"
                        >
                          Learn More
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
                        <DialogTitle className="sr-only">
                          {feature.id === 'jd-generator' ? 'Job Description Generator' :
                           feature.id === 'employee-upload' ? 'Employee Upload System' :
                           feature.id === 'assessment' ? 'Skills Assessment' :
                           feature.id === 'career-paths' ? 'Employee Career Paths' :
                           feature.id === 'mobility' ? 'Employee Mobility Planning' :
                           feature.id === 'development' ? 'Development Pathways' : 'Feature Dialog'}
                        </DialogTitle>
                        {feature.id === 'jd-generator' && <AIJobDescriptionGeneratorOptimized />}
                        {feature.id === 'employee-upload' && <EmployeeUploadTwoStep />}
                        {feature.id === 'assessment' && <AISkillsAssessmentEnhanced />}
                        {feature.id === 'career-paths' && <EmployeeCareerPathsEnhanced />}
                        {feature.id === 'mobility' && <EmployeeMobilityPlanningAI />}
                        {feature.id === 'development' && <DevelopmentPathwaysAI />}
                      </DialogContent>
                    </Dialog>
                   )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Statistics Dashboard */}
        <section className="bg-gray-50 rounded-2xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard Overview</h2>
            <p className="text-gray-600">
              Real-time insights for HR transformation
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card 
                key={index} 
                className="xlsmart-card text-center hover:scale-105 cursor-pointer transition-all duration-300"
                onClick={() => {
                  if (index === 0) {
                    // Employees stat - show employee details
                    setActiveDialog('employee-details');
                  } else if (index === 1) {
                    // Roles stat - show standardized roles details
                    setActiveDialog('roles-details');
                  } else if (index === 2) {
                    // Accuracy stat - show mapping accuracy details
                    setActiveDialog('accuracy-details');
                  } else if (index === 3) {
                    // Skills stat - show skills details
                    setActiveDialog('skills-details');
                  }
                }}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center space-y-3">
                    <div className={`p-4 rounded-2xl bg-gradient-to-br ${
                      index % 2 === 0 ? 'from-primary to-primary/80' : 'from-accent to-accent/80'
                    }`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className={`text-3xl font-bold ${stat.color}`}>
                        {stat.value}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Quick Actions Section */}
        <section className="space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Quick Actions</h2>
            <p className="text-gray-600 text-lg max-w-3xl mx-auto">
              Manage your HR operations efficiently with AI-powered tools
            </p>
          </div>
          <div className="grid gap-6">
            <BulkRoleAssignment />
            <ApplicationTester />
          </div>
        </section>

        {/* CTA Section */}
        <section className="xlsmart-gradient-bg rounded-3xl p-12 text-white text-center shadow-2xl">
          <div className="space-y-6">
            <div>
              <h2 className="text-4xl font-bold mb-6">Ready to Transform Your HR?</h2>
              <p className="text-white/90 text-xl max-w-3xl mx-auto leading-relaxed">
                Join the future of human resources with XLSMART's AI-powered role standardization, skills assessment, and career development planning.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Dialog open={activeDialog === 'quick-upload'} onOpenChange={(open) => setActiveDialog(open ? 'quick-upload' : null)}>
                <DialogTrigger asChild>
                  <Button size="lg" className="xlsmart-button-secondary px-12 py-4 text-lg shadow-2xl">
                    <Upload className="mr-3 h-6 w-6" />
                    Upload Role Catalogs
                  </Button>
                </DialogTrigger>
                      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
                        <DialogTitle className="sr-only">Role Upload Dialog</DialogTitle>
                <RoleStandardizationSystem />
                      </DialogContent>
              </Dialog>
              
              <Dialog open={activeDialog === 'litellm-test'} onOpenChange={(open) => setActiveDialog(open ? 'litellm-test' : null)}>
                <DialogTrigger asChild>
                  <Button size="lg" variant="outline" className="px-12 py-4 text-lg bg-white/10 border-white/30 text-white hover:bg-white/20 hover:scale-105 transition-all shadow-xl backdrop-blur-sm">
                    <MessageCircle className="mr-3 h-6 w-6" />
                    Test LiteLLM Connection
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogTitle className="sr-only">LiteLLM Connection Test</DialogTitle>
                  <LiteLLMTest />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </section>

        {/* Detail Dialogs for Stats */}
        <Dialog open={activeDialog === 'employee-details'} onOpenChange={(open) => setActiveDialog(open ? 'employee-details' : null)}>
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogTitle className="sr-only">Employee Details</DialogTitle>
            <EmployeeListDetails />
          </DialogContent>
        </Dialog>

        <Dialog open={activeDialog === 'roles-details'} onOpenChange={(open) => setActiveDialog(open ? 'roles-details' : null)}>
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogTitle className="sr-only">Standardized Roles Details</DialogTitle>
            <StandardizedRolesDetails />
          </DialogContent>
        </Dialog>

        <Dialog open={activeDialog === 'accuracy-details'} onOpenChange={(open) => setActiveDialog(open ? 'accuracy-details' : null)}>
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogTitle className="sr-only">Mapping Accuracy Details</DialogTitle>
            <MappingAccuracyDetails />
          </DialogContent>
        </Dialog>

        <Dialog open={activeDialog === 'skills-details'} onOpenChange={(open) => setActiveDialog(open ? 'skills-details' : null)}>
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogTitle className="sr-only">Skills Details</DialogTitle>
            <SkillsListDetails />
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Index;