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
  User
} from "lucide-react";
import { AIChat } from "@/components/AIChat";
import { RoleStandardizationSystem } from "@/components/RoleStandardizationSystem";
import { LiteLLMTest } from "@/components/LiteLLMTest";
import { AIJobDescriptionGeneratorEnhanced } from "@/components/AIJobDescriptionGeneratorEnhanced";
import { AISkillsAssessmentEnhanced } from "@/components/AISkillsAssessmentEnhanced";
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

const AnalyticsDashboard = () => {
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const aiStats = useAIStats();

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
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">XLSMART Analytics Dashboard</h1>
        <p className="text-muted-foreground text-lg">
          Monitor your HR platform performance and access key features
        </p>
      </div>

      {/* Statistics Dashboard */}
      <section className="bg-muted/50 rounded-xl p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Dashboard Overview</h2>
          <p className="text-muted-foreground">
            Real-time insights for HR transformation
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card 
              key={index} 
              className="hover:shadow-md cursor-pointer transition-all duration-200"
              onClick={() => {
                if (index === 0) setActiveDialog('employee-details');
                else if (index === 1) setActiveDialog('roles-details');
                else if (index === 2) setActiveDialog('accuracy-details');
                else if (index === 3) setActiveDialog('skills-details');
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${
                    index % 2 === 0 ? 'from-primary to-primary/80' : 'from-primary/80 to-primary/60'
                  }`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${stat.color}`}>
                      {stat.value}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Platform Features */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Platform Features</h2>
          <p className="text-muted-foreground">
            Comprehensive solutions for modernizing HR operations
          </p>
        </div>
      
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card key={feature.id} className="group cursor-pointer hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`text-xs font-medium ${
                      feature.badge === 'AI' ? 'border-primary/30 text-primary bg-primary/10' :
                      'border-muted-foreground/30 text-muted-foreground bg-muted/10'
                    }`}
                  >
                    {feature.badge}
                  </Badge>
                </div>
                <CardTitle className="text-lg font-semibold text-foreground">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
                
                {feature.dialogContent ? (
                  <Dialog open={activeDialog === feature.id} onOpenChange={(open) => setActiveDialog(open ? feature.id : null)}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
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
                      <Button variant="outline" size="sm" className="w-full">
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
                      {feature.id === 'jd-generator' && <AIJobDescriptionGeneratorEnhanced />}
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

      {/* Quick Actions */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Quick Actions</h2>
        <div className="grid gap-4">
          <BulkRoleAssignment />
          <ApplicationTester />
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
          <DialogTitle className="sr-only">Roles Details</DialogTitle>
          <StandardizedRolesDetails />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'accuracy-details'} onOpenChange={(open) => setActiveDialog(open ? 'accuracy-details' : null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">Accuracy Details</DialogTitle>
          <MappingAccuracyDetails />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'skills-details'} onOpenChange={(open) => setActiveDialog(open ? 'skills-details' : null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">Skills Details</DialogTitle>
          <SkillsListDetails />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnalyticsDashboard;