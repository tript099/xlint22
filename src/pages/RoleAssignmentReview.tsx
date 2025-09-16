import { useParams } from "react-router-dom";
import { EmployeeRoleAssignmentReview } from "@/components/EmployeeRoleAssignmentReview";

export const RoleAssignmentReview = () => {
  const { sessionId } = useParams();

  if (!sessionId) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Error</h1>
          <p className="text-muted-foreground">No session ID provided</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <EmployeeRoleAssignmentReview sessionId={sessionId} />
    </div>
  );
};