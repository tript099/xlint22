import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import BulkRoleAssignment from "@/components/BulkRoleAssignment";
import { Users, Target, Brain, CheckCircle } from "lucide-react";

const BulkRoleAssignmentDashboard = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Bulk Role Assignment</h1>
        <p className="text-muted-foreground">
          Automatically assign standardized roles to employees using AI analysis
        </p>
      </div>

      <Separator />

      {/* How it Works Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            How AI Bulk Role Assignment Works
          </CardTitle>
          <CardDescription>
            Our AI system analyzes employee data and matches them to standardized roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">1. Analyze Employees</h3>
                <p className="text-sm text-muted-foreground">
                  AI reviews employee skills, experience, and current positions
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium">2. Match to Standard Roles</h3>
                <p className="text-sm text-muted-foreground">
                  Compares against standardized role definitions and requirements
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium">3. Assign Best Matches</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically assigns the most suitable standardized role
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Assignment Component */}
      <BulkRoleAssignment />

      {/* Benefits Section */}
      <Card>
        <CardHeader>
          <CardTitle>Benefits of Bulk Role Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2">Time Efficiency</h3>
              <p className="text-sm text-muted-foreground">
                Process hundreds of employees in minutes instead of hours of manual work
              </p>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Consistency</h3>
              <p className="text-sm text-muted-foreground">
                Ensures all employees are assigned to standardized, consistent role definitions
              </p>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">AI-Powered Accuracy</h3>
              <p className="text-sm text-muted-foreground">
                Advanced algorithms ensure optimal matching based on skills and experience
              </p>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Improved Analytics</h3>
              <p className="text-sm text-muted-foreground">
                Better role standardization enables more accurate workforce analytics
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkRoleAssignmentDashboard;