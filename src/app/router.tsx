import { Navigate, Route, Routes } from "react-router-dom";
import { TeacherOsShell } from "@/features/teacher-os/shell/TeacherOsShell";
import { TodayPage } from "@/features/teacher-os/today/TodayPage";
import { ReviewQueuePage } from "@/features/teacher-os/review/ReviewQueuePage";
import { ReviewDetailPage } from "@/features/teacher-os/review/ReviewDetailPage";
import { PreparePage } from "@/features/teacher-os/prepare/PreparePage";
import { WorkPage } from "@/features/teacher-os/work/WorkPage";
import { ArtifactViewPage } from "@/features/teacher-os/work/ArtifactViewPage";
import { TeachPage } from "@/features/teacher-os/teach/TeachPage";
import { AssignmentDetailPage as TeacherAssignmentDetailPage } from "@/features/teacher-os/teach/AssignmentDetailPage";
import { ExecutionDetailPage } from "@/features/teacher-os/teach/ExecutionDetailPage";
import { AssessPage } from "@/features/teacher-os/assess/AssessPage";
import { ImprovePage } from "@/features/teacher-os/improve/ImprovePage";
import { LibraryPage } from "@/features/teacher-os/library/LibraryPage";
import { LibraryDetailPage } from "@/features/teacher-os/library/LibraryDetailPage";
import { AiAssistantPage } from "@/features/teacher-os/ai-assistant/AiAssistantPage";
import { SettingsPage } from "@/features/teacher-os/settings/SettingsPage";
import { ProviderAggregatorPage } from "@/features/teacher-os/settings/ProviderAggregatorPage";
import { StudentOsShell } from "@/features/student-os/shell/StudentOsShell";
import { StudentHomePage } from "@/features/student-os/home/StudentHomePage";
import { AssignmentsPage } from "@/features/student-os/assignments/AssignmentsPage";
import { AssignmentDetailPage as StudentAssignmentDetailPage } from "@/features/student-os/assignments/AssignmentDetailPage";
import { AttemptPage } from "@/features/student-os/attempts/AttemptPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/teacher-os/today" replace />} />
      <Route path="/student-os" element={<StudentOsShell />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<StudentHomePage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route
          path="assignments/:assignmentId"
          element={<StudentAssignmentDetailPage />}
        />
        <Route path="attempts/:attemptId" element={<AttemptPage />} />
      </Route>
      <Route path="/teacher-os" element={<TeacherOsShell />}>
        <Route index element={<Navigate to="today" replace />} />
        <Route path="today" element={<TodayPage />} />
        <Route path="review" element={<ReviewQueuePage />} />
        <Route
          path="review/:contentId/versions/:versionId"
          element={<ReviewDetailPage />}
        />
        <Route path="prepare" element={<PreparePage />} />
        <Route path="work/:workId" element={<WorkPage />} />
        <Route
          path="work/:workId/artifacts/:contentId/versions/:versionId"
          element={<ArtifactViewPage />}
        />
        <Route path="teach" element={<TeachPage />} />
        <Route
          path="teach/assignments/:assignmentId"
          element={<TeacherAssignmentDetailPage />}
        />
        <Route
          path="teach/executions/:executionId"
          element={<ExecutionDetailPage />}
        />
        <Route path="assess" element={<AssessPage />} />
        <Route path="improve" element={<ImprovePage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="library/:contentId" element={<LibraryDetailPage />} />
        <Route path="ai-assistant" element={<AiAssistantPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="settings/provider-aggregator"
          element={<ProviderAggregatorPage />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/teacher-os/today" replace />} />
    </Routes>
  );
}
