import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Search, Star, TrendingUp, Users, Grid3X3, List, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EditSkillDialog } from "@/components/EditSkillDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

interface Skill {
  id: string;
  name: string;
  category?: string;
  proficiency_level?: string;
  description?: string;
  created_at?: string;
  usage_count?: number;
}

export const SkillsListDetails = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [editSkill, setEditSkill] = useState<Skill | null>(null);
  const [deleteSkill, setDeleteSkill] = useState<Skill | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { toast } = useToast();
  const pageSize = 12;

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      const { data, error } = await supabase
        .from('skills_master')
        .select('*')
        .order('name');

      if (error) throw error;
      setSkills(data || []);
    } catch (error) {
      console.error('Error fetching skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [...new Set(skills.map(skill => skill.category).filter(Boolean))];

  const filteredSkills = skills.filter(skill => {
    const matchesSearch = skill.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         skill.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         skill.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || skill.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleDelete = async () => {
    if (!deleteSkill) return;

    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('skills_master')
        .delete()
        .eq('id', deleteSkill.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Skill deleted successfully",
      });
      
      fetchSkills();
      setDeleteSkill(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete skill",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.ceil(filteredSkills.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedSkills = filteredSkills.slice(startIndex, startIndex + pageSize);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4 mb-6">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Skills Inventory</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Skills Inventory</h2>
          <Badge variant="secondary">
            {skills.length} Total Skills
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'card' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('card')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search skills by name, category, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
          >
            All Categories
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Skills Grid or List */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedSkills.map((skill) => (
            <Card key={skill.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <Star className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {skill.name}
                      </CardTitle>
                    </div>
                  </div>
                  {skill.usage_count && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{skill.usage_count}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {skill.category && (
                    <Badge variant="secondary" className="text-xs">
                      {skill.category}
                    </Badge>
                  )}
                  {skill.proficiency_level && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        skill.proficiency_level === 'Expert' ? 'border-green-500 text-green-600' :
                        skill.proficiency_level === 'Advanced' ? 'border-blue-500 text-blue-600' :
                        skill.proficiency_level === 'Intermediate' ? 'border-yellow-500 text-yellow-600' :
                        'border-gray-500 text-gray-600'
                      }`}
                    >
                      {skill.proficiency_level}
                    </Badge>
                  )}
                </div>
                
                {skill.description && (
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {skill.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between pt-2 border-t">
                  {skill.created_at && (
                    <div className="text-xs text-muted-foreground">
                      Added: {new Date(skill.created_at).toLocaleDateString()}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditSkill(skill)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteSkill(skill)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Skill Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Proficiency</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Added</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSkills.map((skill) => (
              <TableRow key={skill.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <Star className="h-3 w-3 text-accent" />
                    </div>
                    <div>
                      <div className="font-medium">{skill.name}</div>
                      {skill.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {skill.description}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {skill.category ? (
                    <Badge variant="secondary" className="text-xs">
                      {skill.category}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {skill.proficiency_level ? (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        skill.proficiency_level === 'Expert' ? 'border-green-500 text-green-600' :
                        skill.proficiency_level === 'Advanced' ? 'border-blue-500 text-blue-600' :
                        skill.proficiency_level === 'Intermediate' ? 'border-yellow-500 text-yellow-600' :
                        'border-gray-500 text-gray-600'
                      }`}
                    >
                      {skill.proficiency_level}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {skill.usage_count ? (
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{skill.usage_count}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell>
                  {skill.created_at ? (
                    <span className="text-sm">{new Date(skill.created_at).toLocaleDateString()}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditSkill(skill)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteSkill(skill)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Edit Dialog */}
      <EditSkillDialog
        open={!!editSkill}
        onOpenChange={(open) => !open && setEditSkill(null)}
        skill={editSkill}
        onSave={fetchSkills}
      />

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteSkill}
        onOpenChange={(open) => !open && setDeleteSkill(null)}
        onConfirm={handleDelete}
        title="Delete Skill"
        description={`Are you sure you want to delete the skill "${deleteSkill?.name}"? This action cannot be undone.`}
        loading={deleteLoading}
      />

      {/* Empty State */}
      {filteredSkills.length === 0 && (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No skills found matching your criteria.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(startIndex + pageSize, filteredSkills.length)} of {filteredSkills.length} skills
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};