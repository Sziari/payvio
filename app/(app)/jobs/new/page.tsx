import { PageHeader } from "@/components/ui";
import { JobForm } from "../job-form";

export default function NewJobPage() {
  return (
    <>
      <PageHeader title="Add a job" />
      <JobForm />
    </>
  );
}
