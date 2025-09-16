import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, TrendingUp, Search, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSkillsAnalytics } from "@/hooks/useSkillsAnalytics";

const SkillInventoryDashboard = () => {
  const skillsAnalytics = useSkillsAnalytics();

  const inventoryStats = [
    { 
      value: skillsAnalytics.loading ? "..." : skillsAnalytics.totalSkills.toString(), 
      label: "Total Skills", 
      icon: Package, 
      color: "text-blue-600",
      description: "Mapped skills in system"
    },
    { 
      value: skillsAnalytics.loading ? "..." : skillsAnalytics.employeesWithSkills.toString(), 
      label: "Employees with Skills", 
      icon: TrendingUp, 
      color: "text-green-600",
      description: "Have skill assessments"
    },
    { 
      value: skillsAnalytics.loading ? "..." : skillsAnalytics.skillCategories.toString(), 
      label: "Skill Categories", 
      icon: Package, 
      color: "text-purple-600",
      description: "Different skill types"
    },
    { 
      value: skillsAnalytics.loading ? "..." : `${skillsAnalytics.coverageRate}%`, 
      label: "Coverage Rate", 
      icon: TrendingUp, 
      color: "text-orange-600",
      description: "Skills mapped to employees"
    }
  ];

  const skillCategories = [
    { 
      category: "Technical Skills", 
      count: 567, 
      proficiency: "Advanced", 
      demand: "High",
      growth: "+12%"
    },
    { 
      category: "Soft Skills", 
      count: 234, 
      proficiency: "Intermediate", 
      demand: "Medium",
      growth: "+8%"
    },
    { 
      category: "Domain Expertise", 
      count: 345, 
      proficiency: "Expert", 
      demand: "High",
      growth: "+15%"
    },
    { 
      category: "Leadership", 
      count: 123, 
      proficiency: "Intermediate", 
      demand: "Medium",
      growth: "+5%"
    },
    { 
      category: "Certifications", 
      count: 456, 
      proficiency: "Verified", 
      demand: "High",
      growth: "+20%"
    },
  ];

  const topSkills = [
    { skill: "JavaScript", employees: 456, level: "4.2/5", trend: "↗" },
    { skill: "Project Management", employees: 345, level: "3.8/5", trend: "↗" },
    { skill: "Data Analysis", employees: 298, level: "3.9/5", trend: "↗" },
    { skill: "Cloud Computing", employees: 267, level: "3.6/5", trend: "↗" },
    { skill: "Machine Learning", employees: 189, level: "3.4/5", trend: "↗" },
    { skill: "Communication", employees: 543, level: "4.1/5", trend: "→" },
    { skill: "Problem Solving", employees: 487, level: "4.0/5", trend: "↗" },
    { skill: "Agile Methodologies", employees: 234, level: "3.7/5", trend: "↗" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Skill Inventory</h1>
        <p className="text-muted-foreground text-lg">
          Comprehensive mapping of organizational skills and competencies
        </p>
      </div>

      {/* Inventory Stats */}
      <section className="bg-muted/50 rounded-xl p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Skill Inventory Overview</h2>
          <p className="text-muted-foreground">
            Complete view of skills distribution and coverage across the organization
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {inventoryStats.map((stat, index) => (
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
                      {skillsAnalytics.loading && <Loader2 className="h-4 w-4 animate-spin" />}
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

      {/* Search and Filter */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Skill Search & Analysis</h2>
          <p className="text-muted-foreground">
            Search and filter skills to analyze competency gaps and opportunities
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search skills, competencies, or employees..."
                  className="pl-10"
                />
              </div>
              <Button variant="outline" className="flex items-center space-x-2">
                <Filter className="h-4 w-4" />
                <span>Advanced Filters</span>
              </Button>
            </div>

            {skillsAnalytics.totalSkills > 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 text-primary/30" />
                <p className="font-medium">Skills Analysis Available</p>
                <p className="text-sm">Found {skillsAnalytics.totalSkills} skills across {skillsAnalytics.skillCategories} categories</p>
                <p className="text-sm mt-2">{skillsAnalytics.employeesWithSkills} employees have skill assessments</p>
                <div className="mt-4 text-sm">
                  <p>• Use the search above to find specific skills</p>
                  <p>• Export detailed reports from the actions below</p>
                  <p>• View skill gap analysis for workforce planning</p>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="font-medium">No Skills Data</p>
                <p className="text-sm">Add employee skills data to see detailed analysis here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Detailed Skill Analysis */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Detailed Skill Analysis</h2>
          <p className="text-muted-foreground">
            Comprehensive breakdown of skills by category and proficiency level
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            {skillsAnalytics.totalSkills > 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-primary/30" />
                <p className="font-medium">Detailed Skills Breakdown</p>
                <p className="text-sm">Skills analysis will be available with more detailed employee skill data.</p>
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">Current Overview:</p>
                  <p className="text-xs text-muted-foreground">
                    {skillsAnalytics.totalSkills} total skills • {skillsAnalytics.skillCategories} categories • 
                    {skillsAnalytics.coverageRate}% employee coverage
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="font-medium">No Skills Analysis Available</p>
                <p className="text-sm">Add skills master data and employee skill assessments to see detailed breakdown.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Skill Inventory Actions */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-all duration-200 cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-primary" />
              <span>Export Inventory</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Download comprehensive skill inventory reports
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200 cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Skill Gap Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Identify critical skill gaps and requirements
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200 cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="h-5 w-5 text-primary" />
              <span>Skill Mapping</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Map skills to roles and career pathways
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default SkillInventoryDashboard;