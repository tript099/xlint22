import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BarChart3, TrendingUp, Users, AlertTriangle, Target, Calendar, Award, BookOpen } from "lucide-react";
import { useState } from "react";

interface InteractiveMetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: any;
  color: string;
  trend?: string;
  details: any[];
  onClick?: () => void;
}

export const InteractiveMetricCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color, 
  trend, 
  details,
  onClick 
}: InteractiveMetricCardProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer border-0 shadow-lg bg-gradient-to-br from-background to-muted/20 group">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    {trend && (
                      <Badge variant="outline" className="text-xs">
                        {trend}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-foreground">
                    {value}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Icon className="h-5 w-5" />
            <span>{title} - Detailed Analytics</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-primary">{value}</div>
              <p className="text-sm text-muted-foreground">Current Value</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-lg font-bold text-secondary">
                {trend || "Stable"}
              </div>
              <p className="text-sm text-muted-foreground">Trend</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-lg font-bold text-accent">
                {Math.floor(Math.random() * 20 + 80)}%
              </div>
              <p className="text-sm text-muted-foreground">Health Score</p>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="space-y-4">
            <h4 className="font-semibold">Detailed Breakdown</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {details.map((detail, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{detail.label}</span>
                    <Badge variant="outline">{detail.value}</Badge>
                  </div>
                  {detail.progress && (
                    <Progress value={detail.progress} className="h-2" />
                  )}
                  <p className="text-sm text-muted-foreground">{detail.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Items */}
          <div className="space-y-4">
            <h4 className="font-semibold">Recommended Actions</h4>
            <div className="space-y-2">
              {[
                "Review underperforming areas",
                "Implement improvement strategies",
                "Schedule follow-up assessments",
                "Update training programs"
              ].map((action, index) => (
                <div key={index} className="flex items-center space-x-2 p-2 bg-muted/20 rounded">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};