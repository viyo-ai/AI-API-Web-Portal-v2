import { Card, CardContent } from "@/components/ui/card";
import { Workflow } from "lucide-react";

export type WorkspaceCommandCenterProps = {
  workspaceId?: number;
  draftIntent?: string;
  draftIntentVersion?: number;
};

export function WorkspaceCommandCenter(_props: WorkspaceCommandCenterProps) {
  return (
    <Card className="border-dashed border-slate-200 bg-white text-slate-700">
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
            <Workflow className="h-5 w-5 text-slate-500" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900">Legacy command center removed</h2>
            <p className="text-sm leading-6 text-slate-600">
              AI-API-Web-Portal-v2 uses the task-first Wrapper LLM workspace in Home instead of the prior terminal, workspace, and command procedure surface.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default WorkspaceCommandCenter;
