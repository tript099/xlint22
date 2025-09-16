import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Award, 
  Plus, 
  Clock, 
  TrendingUp, 
  Calendar, 
  CheckCircle, 
  AlertTriangle,
  Users,
  Loader2,
  Shield
} from "lucide-react";
import { useCertifications, useCertificationStats, useAvailableCertifications, usePopularCertifications } from "@/hooks/useCertifications";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const CertificationsDashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const certStats = useCertificationStats(refreshKey);
  const { certifications, loading: certificationsLoading, error, refetch } = useCertifications();
  const { availableCertifications, loading: availableLoading, refetch: refetchAvailable } = useAvailableCertifications();
  const { popularCertifications, loading: popularLoading } = usePopularCertifications();
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [showAddCertDialog, setShowAddCertDialog] = useState(false);
  const [showRenewalDialog, setShowRenewalDialog] = useState(false);
  const [showReportsDialog, setShowReportsDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debug logging
  console.log('Dashboard render:', {
    certStats,
    certificationsCount: certifications?.length,
    availableCertificationsCount: availableCertifications?.length,
    popularCertificationsCount: popularCertifications?.length,
    certificationsLoading,
    availableLoading,
    popularLoading
  });

  // Form state
  const [formData, setFormData] = useState({
    certification_name: '',
    issuing_authority: '',
    description: '',
    external_url: ''
  });

  const handleAddCertification = () => {
    setShowAddCertDialog(true);
  };

  const handleRenewalTracking = () => {
    setShowRenewalDialog(true);
  };

  const handleComplianceReports = () => {
    setShowReportsDialog(true);
  };

  const handleSubmitCertification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Add certification to the available_certifications table using direct query
      const { error } = await supabase
        .from('available_certifications' as any)
        .insert([{
          certification_name: formData.certification_name,
          issuing_authority: formData.issuing_authority || null,
          description: formData.description || null,
          external_url: formData.external_url || null,
          is_active: true
        }]);

      if (error) throw error;

      // Reset form and close dialog
      setFormData({
        certification_name: '',
        issuing_authority: '',
        description: '',
        external_url: ''
      });
      setShowAddCertDialog(false);
      
      // Refresh available certifications list and trigger stats refresh
      refetchAvailable();
      setRefreshKey(prev => prev + 1); // This will trigger stats refresh
      
      alert('Certification added successfully! It will be available for employees to opt into.');
    } catch (error) {
      console.error('Error adding certification:', error);
      alert('Error adding certification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const certificationStats = [
    { 
      value: certStats.loading ? "..." : certStats.activeCertifications.toLocaleString(), 
      label: "Active Certifications", 
      icon: Award, 
      color: "text-blue-600",
      description: "Valid certifications"
    },
    { 
      value: certStats.loading ? "..." : `${certStats.renewalRate}%`, 
      label: "Renewal Rate", 
      icon: TrendingUp, 
      color: "text-green-600",
      description: "On-time renewals"
    },
    { 
      value: certStats.loading ? "..." : certStats.expiringSoon.toString(), 
      label: "Expiring Soon", 
      icon: Calendar, 
      color: "text-orange-600",
      description: "Next 90 days"
    },
    { 
      value: certStats.loading ? "..." : `${certStats.complianceRate}%`, 
      label: "Compliance Rate", 
      icon: Users, 
      color: "text-purple-600",
      description: "Required certifications"
    }
  ];


  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Certifications</h1>
        <p className="text-muted-foreground text-lg">
          Track professional certifications, manage renewals, and ensure compliance
        </p>
      </div>

      {/* Certification Stats */}
      <section className="bg-muted/50 rounded-xl p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Certification Analytics</h2>
          <p className="text-muted-foreground">
            Overview of organizational certification status and compliance
          </p>
        </div>        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {certificationStats.map((stat, index) => (
            <Card key={index} className="hover:shadow-md transition-all duration-200 cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${
                    index % 4 === 0 ? 'from-blue-500 to-blue-600' :
                    index % 4 === 1 ? 'from-green-500 to-green-600' :
                    index % 4 === 2 ? 'from-orange-500 to-orange-600' :
                    'from-purple-500 to-purple-600'
                  }`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className={`text-2xl font-bold ${stat.color} flex items-center gap-2`}>
                      {certStats.loading && <Loader2 className="h-4 w-4 animate-spin" />}
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

      {/* Certification Overview */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Popular Certifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {popularLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading popular certifications...</span>
                </div>
              ) : popularCertifications && popularCertifications.length > 0 ? (
                <div className="space-y-3">
                  {popularCertifications.map((cert, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">
                          {cert.certification_name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {cert.issuing_authority || 'Unknown Authority'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {cert.enrollment_count} enrolled
                        </Badge>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Users className="h-3 w-3 mr-1" />
                          #{index + 1}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="font-medium">No Enrollment Data</p>
                  <p className="text-sm">Popular certifications will appear here once employees start enrolling.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expiring Certifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {certStats.expiringSoon > 0 ? (
                <div className="space-y-3">
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <h3 className="font-medium text-orange-800 mb-2">Action Required</h3>
                    <p className="text-sm text-orange-700">
                      {certStats.expiringSoon} certifications will expire in the next 90 days.
                    </p>
                    <p className="text-xs text-orange-600 mt-1">
                      Review and plan renewal activities to maintain compliance.
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>• Contact employees to schedule renewal training</p>
                    <p>• Update certification tracking systems</p>
                    <p>• Monitor compliance requirements</p>
                  </div>
                </div>
              ) : certifications && certifications.length > 0 ? (
                <div className="text-center p-8 text-green-600">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-green-500/50" />
                  <p className="font-medium">All Clear!</p>
                  <p className="text-sm text-muted-foreground">No certifications expiring in the next 90 days.</p>
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="font-medium">No Expiration Data</p>
                  <p className="text-sm">Add employee certifications to monitor expiry dates.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Recent Certifications */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Recent Certifications</h2>
          <p className="text-muted-foreground">
            Latest employee certifications and achievements
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Active Certifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {certificationsLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading certifications...</span>
              </div>
            ) : (
              <>
                {/* Employee Certifications */}
                {certifications && certifications.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium text-sm mb-3 text-muted-foreground">Employee Certifications</h4>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {certifications.map((cert, index) => (
                        <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm leading-tight mb-1">
                                {cert.certification_name}
                              </h4>
                              <p className="text-xs text-muted-foreground mb-2">
                                {cert.xlsmart_employees?.first_name} {cert.xlsmart_employees?.last_name}
                              </p>
                            </div>
                            <Badge 
                              variant="default"
                              className="text-xs"
                            >
                              Assigned
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Authority:</span>
                              <span>{cert.issuing_authority || 'Not specified'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Department:</span>
                              <span>{cert.xlsmart_employees?.current_department || 'Not specified'}</span>
                            </div>
                            {cert.issue_date && (
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Issued:</span>
                                <span>{new Date(cert.issue_date).toLocaleDateString()}</span>
                              </div>
                            )}
                            {cert.expiry_date && (
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Expires:</span>
                                <span className={
                                  new Date(cert.expiry_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                                    ? 'text-orange-600 font-medium'
                                    : ''
                                }>
                                  {new Date(cert.expiry_date).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="mt-3 flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            <span className="text-xs text-green-600 font-medium">Active</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Certifications */}
                {availableCertifications && availableCertifications.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-3 text-muted-foreground">Available Certifications</h4>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {availableCertifications.map((cert, index) => (
                        <div key={cert.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-blue-50/50">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm leading-tight mb-1">
                                {cert.certification_name}
                              </h4>
                              {cert.description && (
                                <p className="text-xs text-muted-foreground mb-2">
                                  {cert.description}
                                </p>
                              )}
                            </div>
                            <Badge 
                              variant="secondary"
                              className="text-xs"
                            >
                              Available
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Authority:</span>
                              <span>{cert.issuing_authority || 'Not specified'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Added:</span>
                              <span>{new Date(cert.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          
                          <div className="mt-3 flex items-center gap-2">
                            <Award className="h-3 w-3 text-blue-600" />
                            <span className="text-xs text-blue-600 font-medium">Ready for enrollment</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No certifications message */}
                {(!certifications || certifications.length === 0) && 
                 (!availableCertifications || availableCertifications.length === 0) && (
                  <div className="text-center p-8 text-muted-foreground">
                    <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                    <p className="font-medium">No Certifications Found</p>
                    <p className="text-sm">Start by adding certifications that employees can opt into.</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Certification Management */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Certification Management</h2>
          <p className="text-muted-foreground">
            Tools and features for managing organizational certifications
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card 
            className="hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-105"
            onClick={handleAddCertification}
          >
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-primary" />
                <span>Add Certification</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Register new employee certifications and set renewal reminders
              </p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-105"
            onClick={handleRenewalTracking}
          >
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span>Renewal Tracking</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Monitor certification expiry dates and automate renewal notifications
              </p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-105"
            onClick={handleComplianceReports}
          >
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span>Compliance Reports</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Generate compliance reports and track certification requirements
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Add Certification Dialog */}
      <Dialog open={showAddCertDialog} onOpenChange={setShowAddCertDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Add New Certification
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitCertification} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Certification Name */}
              <div className="space-y-2">
                <Label htmlFor="certification_name">Certification Name *</Label>
                <Input
                  id="certification_name"
                  value={formData.certification_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, certification_name: e.target.value }))}
                  placeholder="e.g., AWS Certified Solutions Architect"
                  required
                />
              </div>

              {/* Issuing Authority */}
              <div className="space-y-2">
                <Label htmlFor="issuing_authority">Issuing Authority</Label>
                <Input
                  id="issuing_authority"
                  value={formData.issuing_authority}
                  onChange={(e) => setFormData(prev => ({ ...prev, issuing_authority: e.target.value }))}
                  placeholder="e.g., Amazon Web Services"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the certification..."
                  rows={3}
                />
              </div>

              {/* URL */}
              <div className="space-y-2">
                <Label htmlFor="external_url">Certification URL</Label>
                <Input
                  id="external_url"
                  type="url"
                  value={formData.external_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, external_url: e.target.value }))}
                  placeholder="e.g., https://aws.amazon.com/certification/certified-solutions-architect-associate/"
                />
                <p className="text-xs text-gray-500">Optional: Link to certification information or registration page</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowAddCertDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Certification
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Renewal Tracking Dialog */}
      <Dialog open={showRenewalDialog} onOpenChange={setShowRenewalDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Renewal Tracking
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100">
                      <Calendar className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-600">{certStats.expiringSoon}</p>
                      <p className="text-sm font-medium">Expiring Soon</p>
                      <p className="text-xs text-muted-foreground">Next 90 days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{certStats.renewalRate}%</p>
                      <p className="text-sm font-medium">Renewal Rate</p>
                      <p className="text-xs text-muted-foreground">Last 12 months</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{certStats.activeCertifications}</p>
                      <p className="text-sm font-medium">Active Certs</p>
                      <p className="text-xs text-muted-foreground">Currently valid</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Expiring Certifications List */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Certifications Expiring Soon</h3>
              {certifications && certifications.filter(cert => {
                if (!cert.expiry_date) return false;
                const expiryDate = new Date(cert.expiry_date);
                const now = new Date();
                const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return daysUntilExpiry <= 90 && daysUntilExpiry >= 0;
              }).length > 0 ? (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {certifications.filter(cert => {
                    if (!cert.expiry_date) return false;
                    const expiryDate = new Date(cert.expiry_date);
                    const now = new Date();
                    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return daysUntilExpiry <= 90 && daysUntilExpiry >= 0;
                  }).map((cert, index) => {
                    const expiryDate = new Date(cert.expiry_date!);
                    const now = new Date();
                    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">{cert.certification_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {cert.xlsmart_employees?.first_name} {cert.xlsmart_employees?.last_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={daysUntilExpiry <= 30 ? "destructive" : "secondary"}>
                            {daysUntilExpiry} days left
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Expires: {expiryDate.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-6 bg-green-50 rounded-lg">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="font-medium text-green-800">All Clear!</p>
                  <p className="text-sm text-green-600">No certifications expiring in the next 90 days.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowRenewalDialog(false)}>
                Close
              </Button>
              <Button>
                <Calendar className="h-4 w-4 mr-2" />
                Set Reminders
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compliance Reports Dialog */}
      <Dialog open={showReportsDialog} onOpenChange={setShowReportsDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Compliance Reports
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Compliance Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <Award className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{certStats.totalCertifications}</p>
                      <p className="text-sm font-medium">Total Certs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{certStats.activeCertifications}</p>
                      <p className="text-sm font-medium">Active</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100">
                      <Users className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-600">{certStats.complianceRate}%</p>
                      <p className="text-sm font-medium">Compliance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100">
                      <Calendar className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-600">{certStats.expiringSoon}</p>
                      <p className="text-sm font-medium">At Risk</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Department Breakdown */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Department Compliance Summary</h3>
              {certifications && certifications.length > 0 ? (
                <div className="space-y-3">
                  {(() => {
                    // Group certifications by department
                    const deptStats = certifications.reduce((acc, cert) => {
                      const dept = cert.xlsmart_employees?.current_department || 'Unknown';
                      if (!acc[dept]) {
                        acc[dept] = { total: 0, active: 0, expiring: 0 };
                      }
                      acc[dept].total++;
                      
                      // Check if active (not expired)
                      if (!cert.expiry_date || new Date(cert.expiry_date) > new Date()) {
                        acc[dept].active++;
                      }
                      
                      // Check if expiring soon
                      if (cert.expiry_date) {
                        const expiryDate = new Date(cert.expiry_date);
                        const now = new Date();
                        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysUntilExpiry <= 90 && daysUntilExpiry >= 0) {
                          acc[dept].expiring++;
                        }
                      }
                      
                      return acc;
                    }, {} as Record<string, { total: number; active: number; expiring: number }>);

                    return Object.entries(deptStats).map(([dept, stats]) => {
                      const complianceRate = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
                      
                      return (
                        <div key={dept} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <h4 className="font-medium">{dept}</h4>
                            <p className="text-sm text-muted-foreground">
                              {stats.total} total certifications
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-lg font-bold text-green-600">{stats.active}</p>
                              <p className="text-xs text-muted-foreground">Active</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-orange-600">{stats.expiring}</p>
                              <p className="text-xs text-muted-foreground">Expiring</p>
                            </div>
                            <Badge variant={complianceRate >= 80 ? "default" : complianceRate >= 60 ? "secondary" : "destructive"}>
                              {complianceRate}% compliant
                            </Badge>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="text-center p-6 bg-muted/50 rounded-lg">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-medium">No Compliance Data</p>
                  <p className="text-sm text-muted-foreground">Employee certifications needed to generate compliance reports.</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowReportsDialog(false)}>
                Close
              </Button>
              <Button variant="outline">
                <TrendingUp className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              <Button>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CertificationsDashboard;