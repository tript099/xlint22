import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DevelopmentPathwaysAI } from "@/components/DevelopmentPathwaysAI";
import { AILearningDevelopment } from "@/components/AILearningDevelopment";
import { BookOpen, TrendingUp, Clock, Award, Brain, Loader2 } from "lucide-react";
import { useDevelopmentAnalytics } from "@/hooks/useDevelopmentAnalytics";
import { useDevelopmentAnalyticsDetails } from "@/hooks/useDevelopmentAnalyticsDetails";
import { useState } from "react";

const DevelopmentDashboard = () => {
  const developmentAnalytics = useDevelopmentAnalytics();
  const analyticsDetails = useDevelopmentAnalyticsDetails();
  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  const developmentStats = [
    { 
      value: developmentAnalytics.loading ? "..." : developmentAnalytics.learningPaths.toLocaleString(), 
      label: "Learning Paths", 
      icon: BookOpen, 
      color: "text-blue-600",
      description: "Active development plans"
    },
    { 
      value: developmentAnalytics.loading ? "..." : `${developmentAnalytics.completionRate}%`, 
      label: "Completion Rate", 
      icon: TrendingUp, 
      color: "text-green-600",
      description: "Learning objectives met"
    },
    { 
      value: developmentAnalytics.loading ? "..." : developmentAnalytics.avgLearningHours.toString(), 
      label: "Avg Learning Hours", 
      icon: Clock, 
      color: "text-purple-600",
      description: "Per employee/month"
    },
    { 
      value: developmentAnalytics.loading ? "..." : developmentAnalytics.skillsDeveloped.toString(), 
      label: "Skills Developed", 
      icon: Award, 
      color: "text-orange-600",
      description: "New competencies"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Development Pathways</h1>
        <p className="text-muted-foreground text-lg">
          Create personalized learning paths, track skill development progress, and leverage AI insights
        </p>
      </div>

      {/* Development Stats */}
      <section className="bg-muted/50 rounded-xl p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Development Analytics</h2>
          <p className="text-muted-foreground">
            Overview of learning and development metrics
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {developmentStats.map((stat, index) => (
            <Card key={index} className="hover:shadow-md transition-all duration-200 cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${
                    index % 4 === 0 ? 'from-blue-500 to-blue-600' :
                    index % 4 === 1 ? 'from-green-500 to-green-600' :
                    index % 4 === 2 ? 'from-purple-500 to-purple-600' :
                    'from-orange-500 to-orange-600'
                  }`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className={`text-2xl font-bold ${stat.color} flex items-center gap-2`}>
                      {developmentAnalytics.loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {stat.value}
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {stat.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stat.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Main Content Tabs */}
      <Tabs defaultValue="pathways" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-fit">
          <TabsTrigger value="pathways" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Pathways</span>
          </TabsTrigger>
          <TabsTrigger value="ai-insights" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">AI Insights</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai-insights" className="space-y-6 mt-6">
          <AILearningDevelopment />
        </TabsContent>

        <TabsContent value="pathways" className="space-y-6 mt-6">
          {/* AI Development Pathways */}
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">AI Development Pathways</h2>
              <p className="text-muted-foreground">
                Generate personalized learning paths with AI-powered skill gap analysis
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <span>Development Path Generator</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DevelopmentPathwaysAI />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 mt-6">{/* Development Insights */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Popular Learning Tracks
                  {analyticsDetails.loading && <Loader2 className="h-4 w-4 animate-spin" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsDetails.loading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Loading learning tracks...</span>
                    </div>
                  ) : analyticsDetails.popularTracks.length > 0 ? (
                    analyticsDetails.popularTracks.map((track, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{track.name}</p>
                          <p className="text-sm text-muted-foreground">{track.learners} learners</p>
                        </div>
                        <div className={`text-sm ${
                          track.completionRate >= 90 ? 'text-green-600' :
                          track.completionRate >= 70 ? 'text-blue-600' :
                          track.completionRate >= 50 ? 'text-orange-600' :
                          'text-red-600'
                        }`}>
                          {track.completionRate}% completion
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center p-8 text-muted-foreground">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No learning tracks data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Learning Progress
                  {analyticsDetails.loading && <Loader2 className="h-4 w-4 animate-spin" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsDetails.loading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Loading progress data...</span>
                    </div>
                  ) : analyticsDetails.learningProgress.length > 0 ? (
                    analyticsDetails.learningProgress.map((progress, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{progress.category}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-20 h-2 bg-muted rounded-full">
                            <div 
                              className={`h-2 rounded-full ${progress.color}`}
                              style={{ width: `${Math.min(progress.progress, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{progress.progress}%</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center p-8 text-muted-foreground">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No progress data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DevelopmentDashboard;