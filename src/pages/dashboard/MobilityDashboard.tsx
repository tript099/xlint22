import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmployeeMobilityPlanningAI } from "@/components/EmployeeMobilityPlanningAI";
import { EmployeeMovesHistory } from "@/components/EmployeeMovesHistory";
import { Target, TrendingUp, Users, AlertTriangle, Loader2 } from "lucide-react";
import { useMobilityAnalytics } from "@/hooks/useMobilityAnalytics";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const MobilityDashboard = () => {
  const mobilityAnalytics = useMobilityAnalytics();
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('xlsmart_employees')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get actual high-risk employees from the database
  const getHighRiskEmployees = () => {
    if (!employees.length) return [];
    
    return employees
      .filter(emp => {
        // Calculate risk based on performance rating and other factors
        const performance = emp.performance_rating || 0;
        const experience = emp.years_of_experience || 0;
        const hasStandardRole = !!emp.standard_role_id;
        
        // High risk: low performance OR high experience without standard role
        return performance < 3 || (experience > 5 && !hasStandardRole);
      })
      .slice(0, 10) // Show top 10 high-risk employees
      .map(emp => ({
        name: `${emp.first_name || 'Unknown'} ${emp.last_name || 'Employee'}`,
        position: emp.current_position || 'Unknown Position',
        risk: emp.performance_rating < 2 ? 'High' : emp.performance_rating < 3 ? 'Medium' : 'Low',
        riskColor: emp.performance_rating < 2 ? 'destructive' : emp.performance_rating < 3 ? 'secondary' : 'default'
      }));
  };

  const mobilityStats = [
    { 
      value: mobilityAnalytics.loading ? "..." : `${mobilityAnalytics.mobilityRate}%`, 
      label: "Mobility Rate", 
      icon: Target, 
      color: "text-blue-600",
      description: "Annual internal moves"
    },
    { 
      value: mobilityAnalytics.loading ? "..." : `${mobilityAnalytics.retentionRate}%`, 
      label: "Retention Rate", 
      icon: Users, 
      color: "text-green-600",
      description: "Successful transitions"
    },
    { 
      value: mobilityAnalytics.loading ? "..." : mobilityAnalytics.activePlans.toString(), 
      label: "Active Plans", 
      icon: TrendingUp, 
      color: "text-purple-600",
      description: "Current mobility plans"
    },
    { 
      value: mobilityAnalytics.loading ? "..." : mobilityAnalytics.atRiskEmployees.toString(), 
      label: "At-Risk Employees", 
      icon: AlertTriangle, 
      color: "text-orange-600",
      description: "High turnover risk"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Employee Mobility & Planning</h1>
        <p className="text-muted-foreground text-lg">
          Plan internal mobility, reduce turnover risk, and optimize talent flow
        </p>
      </div>

      {/* Mobility Stats */}
      <section className="bg-muted/50 rounded-xl p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Mobility Analytics</h2>
          <p className="text-muted-foreground">
            Overview of employee mobility and retention metrics
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mobilityStats.map((stat, index) => (
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
                      {mobilityAnalytics.loading && <Loader2 className="h-4 w-4 animate-spin" />}
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

      {/* AI Mobility Planning */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">AI Mobility Planning</h2>
          <p className="text-muted-foreground">
            Analyze mobility opportunities and create strategic movement plans
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-primary" />
              <span>Mobility Planning Engine</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmployeeMobilityPlanningAI />
          </CardContent>
        </Card>
      </section>

      {/* Mobility Insights */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>High-Risk Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading employees...</span>
                </div>
              ) : getHighRiskEmployees().length > 0 ? (
                getHighRiskEmployees().map((employee, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{employee.name}</p>
                      <p className="text-sm text-muted-foreground">{employee.position}</p>
                    </div>
                    <Badge variant={employee.riskColor as any}>
                      {employee.risk} Risk
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No high-risk employees identified</p>
                  <p className="text-sm">All employees appear to be in good standing</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mobility Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-medium text-green-800">Cross-Department Transfer</p>
                <p className="text-sm text-green-600">23 potential matches identified</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-medium text-blue-800">Skill-Based Rotation</p>
                <p className="text-sm text-blue-600">18 development opportunities</p>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="font-medium text-purple-800">Leadership Track</p>
                <p className="text-sm text-purple-600">12 management candidates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Recent Moves History */}
      <section>
        <EmployeeMovesHistory />
      </section>
    </div>
  );
};

export default MobilityDashboard;